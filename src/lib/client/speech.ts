import type { RobotId } from "@/lib/domain/types";

// Text-to-speech for the robots, using the browser's own voices.
//
// The current mouth level lives in a plain mutable object rather than React
// state, so the 3D robots can read it every frame without re-rendering.

interface VoiceProfile {
  preferred: string[];
  pitch: number;
  rate: number;
}

const VOICES: Record<RobotId, VoiceProfile> = {
  lumi: {
    preferred: ["Samantha", "Microsoft Aria", "Microsoft Jenny", "Google US English", "Ava", "Allison"],
    pitch: 1.12,
    rate: 1.0,
  },
  penny: {
    preferred: ["Karen", "Microsoft Sonia", "Google UK English Female", "Moira", "Serena"],
    pitch: 1.04,
    rate: 1.0,
  },
  otto: {
    preferred: ["Daniel", "Microsoft Ryan", "Microsoft Guy", "Google UK English Male", "Alex", "Fred"],
    pitch: 0.92,
    rate: 0.98,
  },
  kai: {
    preferred: ["Tessa", "Microsoft Michelle", "Microsoft Ana", "Google US English", "Fiona", "Victoria"],
    pitch: 1.18,
    rate: 1.02,
  },
};

export const mouth = {
  /** 0..1, bumped on every spoken word and decayed by the robot each frame. */
  level: 0,
  speaking: false,
  speaker: null as RobotId | null,
};

const speakerListeners = new Set<() => void>();

/** Lets UI outside the 3D scene follow who is talking (see useSpeaker). */
export function subscribeSpeaker(listener: () => void): () => void {
  speakerListeners.add(listener);
  return () => speakerListeners.delete(listener);
}

function setSpeaker(speaker: RobotId | null) {
  mouth.speaking = speaker !== null;
  mouth.speaker = speaker;
  speakerListeners.forEach((listener) => listener());
}

let muted = false;
let voices: SpeechSynthesisVoice[] = [];
let finishCurrent: (() => void) | null = null;

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

if (typeof window !== "undefined" && synth()) {
  const load = () => (voices = synth()!.getVoices());
  load();
  synth()!.addEventListener?.("voiceschanged", load);
}

function pickVoice(profile: VoiceProfile): SpeechSynthesisVoice | null {
  for (const name of profile.preferred) {
    const match = voices.find((v) => v.name.includes(name) && v.lang.toLowerCase().startsWith("en"));
    if (match) return match;
  }
  return voices.find((v) => v.lang === "en-US") ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
}

// The boutique and the back office often run side by side in one browser,
// and they share its speech engine: cancel() in one window also cuts off a
// robot talking in the other. So windows take turns. Each tells the others
// how long it will talk, and a line that comes up meanwhile waits its turn.
const turns =
  typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel("crewos-voices") : null;
const windowId = Math.random().toString(36).slice(2);
/** When each other window that is talking expects to finish (epoch ms). */
const talkers = new Map<string, number>();
/** This window's line in the engine, if any. */
let voiced: SpeechSynthesisUtterance | null = null;
/** This window's next line, waiting for the others to finish. */
let waiting: { start: () => void; timer?: number } | null = null;

function announce(until: number) {
  turns?.postMessage({ id: windowId, until });
}

function othersTalkUntil(): number {
  const now = Date.now();
  let latest = 0;
  for (const [id, until] of talkers) {
    if (until <= now) talkers.delete(id);
    else latest = Math.max(latest, until);
  }
  return latest;
}

/** Starts the waiting line as soon as no other window is talking. */
function takeTurn() {
  if (!waiting) return;
  window.clearTimeout(waiting.timer);
  const busyUntil = othersTalkUntil();
  if (busyUntil > 0) {
    waiting.timer = window.setTimeout(takeTurn, busyUntil - Date.now());
    return;
  }
  const { start } = waiting;
  waiting = null;
  start();
}

if (turns) {
  turns.addEventListener("message", (event: MessageEvent<{ id: string; until: number }>) => {
    const { id, until } = event.data;
    if (until > 0) talkers.set(id, until);
    else talkers.delete(id);
    takeTurn();
  });
  window.addEventListener("pagehide", () => {
    if (voiced) announce(0);
  });
}

export function setMuted(value: boolean) {
  muted = value;
  if (value) stopSpeaking();
}

/**
 * Call from inside a click handler. Safari and iOS only allow speech that
 * starts from a user gesture, so we "open" the voice with a silent utterance.
 */
export function unlockSpeech() {
  const engine = synth();
  if (!engine) return;
  const silent = new SpeechSynthesisUtterance(" ");
  silent.volume = 0;
  engine.speak(silent);
}

/** Silences this window's robots. A robot talking in another window carries on. */
export function stopSpeaking() {
  if (waiting) {
    window.clearTimeout(waiting.timer);
    waiting = null;
  }
  if (voiced) synth()?.cancel();
  finishCurrent?.();
}

interface SpeakOptions {
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * Speaks `text` as `speaker`. When muted (or unsupported) the robot still
 * "talks" visually for about as long as the sentence would take. If a robot
 * in another window is talking, the line waits for it to finish.
 */
export function speak(text: string, speaker: RobotId, options: SpeakOptions = {}) {
  stopSpeaking();
  const engine = muted ? null : synth();
  const utterance = engine ? new SpeechSynthesisUtterance(text) : null;
  // Roughly how long the voice takes to say it, and a generous ceiling for
  // when the browser never reports the end (amounts and names run slower).
  const spokenMs = 900 + text.length * 62;
  const ceilingMs = spokenMs * 1.5 + 2_000;
  let done = false;
  let safety: number | undefined;
  let pulse: number | undefined;

  const finish = () => {
    if (done) return;
    done = true;
    window.clearTimeout(safety);
    window.clearInterval(pulse);
    if (utterance && voiced === utterance) {
      voiced = null;
      announce(0);
    }
    setSpeaker(null);
    if (finishCurrent === finish) finishCurrent = null;
    options.onEnd?.();
  };
  finishCurrent = finish;

  const begin = () => {
    if (done) return;
    // Some browsers occasionally drop `onend`; never leave a robot talking forever.
    window.clearTimeout(safety);
    safety = window.setTimeout(finish, ceilingMs);
    // Fallback rhythm for voices that never fire word boundaries.
    pulse = window.setInterval(() => {
      if (mouth.speaking) mouth.level = Math.max(mouth.level, 0.55 + Math.random() * 0.45);
    }, 170);
    mouth.level = 1;
    setSpeaker(speaker);
    options.onStart?.();
  };

  if (!engine || !utterance) {
    begin();
    window.setTimeout(finish, Math.min(14_000, spokenMs));
    return;
  }

  const profile = VOICES[speaker];
  const voice = pickVoice(profile);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? "en-US";
  utterance.pitch = profile.pitch;
  utterance.rate = profile.rate;
  utterance.onstart = begin;
  utterance.onboundary = () => {
    mouth.level = 1;
  };
  utterance.onend = finish;
  utterance.onerror = finish;

  waiting = {
    start: () => {
      voiced = utterance;
      announce(Date.now() + ceilingMs);
      // Until the voice starts, leave room for another window's line that
      // reached the engine first; begin() then sets the usual limit.
      safety = window.setTimeout(finish, ceilingMs + 15_000);
      engine.speak(utterance);
    },
  };
  takeTurn();
}
