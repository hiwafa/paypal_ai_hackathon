"use client";

import type { CrewAction } from "@/lib/domain/crew";
import { formatMoney } from "@/lib/domain/money";
import { isRobot, type RobotGesture } from "@/lib/domain/robots";
import type { ActivityItem, Approval, RobotId } from "@/lib/domain/types";
import { ApiError, api } from "./api";
import { useOffice, type Stage } from "./officeStore";
import { mouth, setMuted, speak } from "./speech";

// The back office's behaviour: loading data, reacting to the live feed, the
// crew acting out each event in the 3D room, and the owner's commands.
// Robots only ever propose money movements; approvals are decided here, by
// an explicit owner action (a click, or a spoken "approve"), never by the AI.

/** How long one robot holds the stage before the next event plays. */
const STAGE_MS = 3200;
const MAX_QUEUED = 6;

const fail = (error: unknown, fallback: string) => (error instanceof ApiError ? error.message : fallback);

// --- Data -------------------------------------------------------------------

let refreshing = false;
let refreshAgain = false;
let refreshTimer: number | undefined;

/** Loads the office state. Calls made while a load is running are folded into one more load. */
export async function refreshOffice(): Promise<void> {
  if (refreshing) {
    refreshAgain = true;
    return;
  }
  refreshing = true;
  try {
    do {
      refreshAgain = false;
      const state = await api.officeState();
      useOffice.getState().patch({ state, loadError: null });
    } while (refreshAgain);
  } catch (error) {
    // Keep showing the last good data; only an empty office shows the error.
    if (!useOffice.getState().state) {
      useOffice.getState().patch({ loadError: fail(error, "The back office couldn't load. Is the server running?") });
    }
  } finally {
    refreshing = false;
  }
}

/** Coalesces bursts of live events into a single reload. */
export function refreshSoon(delayMs = 250) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => void refreshOffice(), delayMs);
}

// --- Live feed and the crew room --------------------------------------------

const queue: Stage[] = [];
let stageTimer: number | undefined;
/** When the owner last heard a robot answer them; events stay quiet right after. */
let lastAnswerAt = 0;

function performerFor(item: ActivityItem): { robot: RobotId; gesture: RobotGesture } | null {
  switch (item.kind) {
    case "sale":
      return { robot: "penny", gesture: "stamp" };
    case "confirmation":
      // Penny reconciles whatever PayPal confirms.
      return { robot: "penny", gesture: "stamp" };
    case "payout":
      return { robot: "otto", gesture: "celebrate" };
    case "refund":
      return { robot: item.actor === "otto" ? "otto" : "kai", gesture: "present" };
    case "claim":
      return { robot: "kai", gesture: "present" };
    case "approval":
      // The owner's own decisions don't need acting out; the result does.
      return isRobot(item.actor) ? { robot: item.actor, gesture: "present" } : null;
    case "warning":
      return { robot: isRobot(item.actor) ? item.actor : "penny", gesture: "none" };
    case "briefing":
    case "info":
      return null;
  }
}

/** What a robot says out loud when it acts out an event, if anything. */
function lineFor(stage: Stage): string | null {
  const { item } = stage;
  switch (item.kind) {
    case "sale":
      return `${item.title}. ${formatMoney(item.amountCents ?? 0)} came in through PayPal.`;
    case "refund":
    case "payout":
    case "claim":
    case "warning":
      return `${item.title}.`;
    case "approval":
      return `${item.title}. It needs your approval.`;
    default:
      return null;
  }
}

function playNext() {
  window.clearTimeout(stageTimer);
  const next = queue.shift();
  const office = useOffice.getState();
  if (!next) {
    office.patch({ stage: null });
    return;
  }
  next.at = performance.now();
  office.patch({ stage: next });

  // Narrate only when nobody is talking and the owner isn't mid-conversation.
  const line = lineFor(next);
  const quiet = !mouth.speaking && !office.thinking && performance.now() - lastAnswerAt > 6000;
  if (line && quiet) speak(line, next.robot);
  stageTimer = window.setTimeout(playNext, STAGE_MS);
}

/** The robot that has the floor right now: talking, thinking, or acting out an event. */
export function robotInFocus(): RobotId | null {
  if (mouth.speaking && mouth.speaker) return mouth.speaker;
  const office = useOffice.getState();
  return office.thinking ?? office.stage?.robot ?? null;
}

/** Handles one item from the live feed. */
export function receiveActivity(item: ActivityItem) {
  const office = useOffice.getState();
  const state = office.state;
  if (state?.activity.some((a) => a.id === item.id)) return;
  if (state) office.patch({ state: { ...state, activity: [item, ...state.activity].slice(0, 80) } });

  const performer = performerFor(item);
  if (performer) {
    queue.push({ ...performer, item, at: 0 });
    if (queue.length > MAX_QUEUED) queue.splice(0, queue.length - MAX_QUEUED);
    if (!office.stage) playNext();
  }
  refreshSoon();
}

// --- The owner talking to the crew ------------------------------------------

function answer(robot: RobotId, text: string, source: "claude" | "offline" | null, actions: CrewAction[] = []) {
  lastAnswerAt = performance.now();
  useOffice.getState().patch({ reply: { robot, text, source, actions } });
  speak(text, robot);
}

/** Which robot will most likely take a request, so it can look thoughtful meanwhile. */
export function guessActor(text: string): RobotId {
  const t = text.toLowerCase();
  if (/\b(pay|payouts?|bills?|invoices?|suppliers?|settle)\b/.test(t)) return "otto";
  if (/\b(refunds?|claims?|returns?|broken|scratch\w*|customers?)\b/.test(t)) return "kai";
  return "penny";
}

const APPROVE =
  /^(?:(?:yes|yeah|yep|ok(?:ay)?|sure|great|perfect|good)[\s,.!]+)?(?:please\s+)?(?:approve[ds]?|go ahead|do it|send it|pay (?:it|them)|confirm(?:ed)?|accept(?:ed)?)\b/;
const BARE_YES = /^(?:yes|yeah|yep|sure|ok(?:ay)?)(?:\s+please)?[.!]*$/;
const REJECT =
  /^(?:(?:no|nope)[\s,.!]+)?(?:please\s+)?(?:decline[ds]?|reject(?:ed)?|cancel|don't|do not|hold (?:it|off)|not now)\b/;

/** "Approve it", "yes, go ahead", "decline" → a decision; anything else is a command. */
export function approvalIntent(text: string, recentRequest: boolean): "approve" | "reject" | null {
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/^(?:otto|kai|penny|crew)[\s,]+/, "");
  if (clean.length > 70) return null;
  if (APPROVE.test(clean) || (recentRequest && BARE_YES.test(clean))) return "approve";
  if (REJECT.test(clean)) return "reject";
  return null;
}

/** Picks the approval the owner means: the one whose title they mention, else the newest. */
function pickApproval(text: string, pending: Approval[]): Approval | undefined {
  const words = text.toLowerCase().match(/[a-z0-9-]{4,}/g) ?? [];
  return pending.find((a) => words.some((word) => a.title.toLowerCase().includes(word))) ?? pending[0];
}

/** Everything the owner types or says goes through here. */
export async function sayToCrew(raw: string, via: "voice" | "typed"): Promise<void> {
  const text = raw.trim().slice(0, 400);
  const office = useOffice.getState();
  if (text.length < 2 || office.thinking) return;
  office.patch({ lastOwnerTurn: { text, via }, commandError: null });

  const pending = (office.state?.approvals ?? []).filter((a) => a.status === "pending");
  const recent = pending.length > 0 && Date.now() - Date.parse(pending[0].createdAt) < 3 * 60_000;
  const intent = pending.length ? approvalIntent(text, recent) : null;
  const target = intent ? pickApproval(text, pending) : undefined;
  if (intent && target) {
    await decide(target.id, intent, via === "voice" ? "voice" : "click");
    return;
  }
  await runCommand(text);
}

async function runCommand(text: string) {
  const office = useOffice.getState();
  office.patch({ thinking: guessActor(text) });
  try {
    const reply = await api.command(text);
    const view = reply.actions.findLast((action) => action.kind === "ledger_view")?.view;
    useOffice.getState().patch({ thinking: null, ...(view ? { view } : {}) });
    answer(reply.actor, reply.reply, reply.source, reply.actions);
    if (reply.actions.some((action) => action.kind === "payout_request" || action.kind === "refund_request")) {
      refreshSoon(0);
    }
  } catch (error) {
    useOffice.getState().patch({
      thinking: null,
      commandError: fail(error, "The crew didn't catch that. Please try again."),
    });
  }
}

// --- Approvals --------------------------------------------------------------

export async function decide(id: string, decision: "approve" | "reject", via: "click" | "voice"): Promise<void> {
  const office = useOffice.getState();
  if (office.deciding.includes(id)) return;
  const approval = office.state?.approvals.find((a) => a.id === id);
  office.patch({ deciding: [...office.deciding, id], approvalError: null });

  if (approval) {
    const what = approval.kind === "supplier_payout" ? "payout" : "refund";
    const line =
      decision === "approve"
        ? `Thank you, Maryam. Sending the ${formatMoney(approval.amountCents)} ${what} through PayPal now.`
        : `Okay, I've held the ${what} back. Nothing was sent.`;
    // A spoken decision gets a spoken answer; a click is acknowledged quietly.
    if (via === "voice") answer(approval.requestedBy, line, null);
    else useOffice.getState().patch({ reply: { robot: approval.requestedBy, text: line, source: null, actions: [] } });
  }

  try {
    const { approval: updated } = await api.decide(id, decision, via);
    const state = useOffice.getState().state;
    if (state) {
      useOffice.getState().patch({
        state: { ...state, approvals: state.approvals.map((a) => (a.id === id ? updated : a)) },
      });
    }
    if (updated.status === "failed") {
      useOffice.getState().patch({ approvalError: updated.error ?? "PayPal didn't accept this one." });
    }
  } catch (error) {
    useOffice.getState().patch({ approvalError: fail(error, "That decision didn't go through. Please try again.") });
  } finally {
    useOffice.getState().patch({ deciding: useOffice.getState().deciding.filter((x) => x !== id) });
    refreshSoon(0);
  }
}

// --- Briefing, voices and demo reset ----------------------------------------

export async function fetchBriefing(): Promise<void> {
  const office = useOffice.getState();
  if (office.briefingLoading) return;
  office.patch({ briefingLoading: true, thinking: "penny", commandError: null });
  try {
    const briefing = await api.briefing();
    useOffice.getState().patch({ briefing });
    lastAnswerAt = performance.now();
    speak(briefing.spoken, "penny");
  } catch (error) {
    useOffice.getState().patch({ commandError: fail(error, "Penny couldn't put the briefing together just now.") });
  } finally {
    useOffice.getState().patch({ briefingLoading: false, thinking: null });
  }
}

export function setOfficeMuted(muted: boolean) {
  setMuted(muted);
  useOffice.getState().patch({ muted });
}

/** Restores the seeded week, e.g. right before recording a demo. */
export async function resetDemo(): Promise<void> {
  await api.resetDemo();
  queue.length = 0;
  window.clearTimeout(stageTimer);
  useOffice.getState().patch({
    view: null,
    reply: null,
    lastOwnerTurn: null,
    briefing: null,
    stage: null,
    commandError: null,
    approvalError: null,
  });
  await refreshOffice();
}
