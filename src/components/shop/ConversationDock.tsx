"use client";

import { ArrowUp, History, Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RobotAvatar } from "@/components/ui/RobotAvatar";
import { useListen } from "@/hooks/useListen";
import { talkToLumi } from "@/lib/client/lumi";
import { useShop } from "@/lib/client/shopStore";
import type { ChatTurn } from "@/lib/domain/stylist";

const STATUS: Record<string, string> = {
  idle: "Online",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking",
};

function lastIndex(turns: ChatTurn[], role: ChatTurn["role"]): number {
  for (let i = turns.length - 1; i >= 0; i--) if (turns[i].role === role) return i;
  return -1;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-2" aria-label="Lumi is thinking">
      {[0, 1, 2].map((i) => (
        <span key={i} className="typing-dot size-1.5 rounded-full bg-lumi" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

/** Lumi's latest line, the customer's input and quick replies. */
export function ConversationDock() {
  const entered = useShop((s) => s.entered);
  const turns = useShop((s) => s.turns);
  const suggestions = useShop((s) => s.suggestions);
  const busy = useShop((s) => s.busy);
  const activity = useShop((s) => s.activity);
  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const send = useCallback((text: string) => {
    const clean = text.trim().slice(0, 600);
    if (!clean || useShop.getState().busy) return;
    setDraft("");
    void talkToLumi({ role: "customer", text: clean });
  }, []);

  const voice = useListen(send);

  // Lumi tilts her head and listens while the microphone is open.
  useEffect(() => {
    const shop = useShop.getState();
    if (voice.listening) shop.patch({ activity: "listening" });
    else if (shop.activity === "listening") shop.patch({ activity: "idle" });
  }, [voice.listening]);

  if (!entered) return null;

  const lumiAt = lastIndex(turns, "lumi");
  const customerAt = lastIndex(turns, "customer");
  const lumiLine = lumiAt >= 0 ? turns[lumiAt].text : "";
  // Show the customer's words only when they belong to Lumi's current line.
  const customerLine = customerAt > lumiAt || customerAt === lumiAt - 1 ? turns[customerAt]?.text : null;

  return (
    <section
      aria-label="Conversation with Lumi"
      className="fixed bottom-4 left-4 z-40 flex w-[min(460px,calc(100vw-2rem))] animate-rise flex-col gap-2"
    >
      {historyOpen && <Transcript turns={turns} />}

      <div className="glass-strong rounded-[26px] p-4">
        <div className="flex items-start gap-3">
          <RobotAvatar id="lumi" size={42} active={activity === "listening"} speaking={activity === "speaking"} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
              <span className="font-semibold text-lumi">Lumi</span>
              <span aria-live="polite">{STATUS[activity] ?? "Online"}</span>
              <button
                type="button"
                onClick={() => setHistoryOpen((open) => !open)}
                aria-expanded={historyOpen}
                className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 normal-case tracking-normal text-white/45 transition hover:bg-white/10 hover:text-white"
              >
                <History className="size-3.5" /> History
              </button>
            </div>
            {customerLine && <p className="mt-1.5 truncate text-[13px] text-white/45">You: {customerLine}</p>}
            {busy ? (
              <TypingDots />
            ) : (
              <p className="mt-1 line-clamp-4 text-[15px] leading-relaxed text-white/90" aria-live="polite">
                {lumiLine}
              </p>
            )}
          </div>
        </div>

        {suggestions.length > 0 && !busy && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => send(suggestion)}
                className="rounded-full border border-lumi/25 bg-lumi/[0.07] px-3 py-1.5 text-[12.5px] text-lumi transition hover:border-lumi/50 hover:bg-lumi/15"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          {voice.supported && (
            <button
              type="button"
              onClick={voice.listening ? voice.stop : voice.start}
              disabled={busy}
              aria-label={voice.listening ? "Stop listening" : "Talk to Lumi"}
              className={`relative grid size-10 shrink-0 place-items-center rounded-full transition disabled:opacity-40 ${
                voice.listening ? "bg-lumi text-ink-950" : "bg-white/[0.07] text-white/80 hover:bg-white/15"
              }`}
            >
              {voice.listening && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-lumi/40" />}
              {voice.listening ? <Square className="relative size-3.5 fill-current" /> : <Mic className="size-4" />}
            </button>
          )}
          <input
            value={voice.listening ? voice.interim : draft}
            onChange={(event) => setDraft(event.target.value)}
            readOnly={voice.listening}
            maxLength={600}
            placeholder={voice.listening ? "Listening…" : "Ask Lumi anything…"}
            aria-label="Message to Lumi"
            className="h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 text-[14px] text-white placeholder:text-white/35 focus:border-lumi/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Send"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-400 text-ink-950 transition hover:bg-gold-300 disabled:bg-white/10 disabled:text-white/30"
          >
            <ArrowUp className="size-4" />
          </button>
        </form>
        {voice.error && <p className="mt-2 text-xs text-kai">{voice.error} You can type instead.</p>}
      </div>
    </section>
  );
}

function Transcript({ turns }: { turns: ChatTurn[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [turns.length]);

  return (
    <div className="glass-strong scrollbar-thin max-h-[38vh] animate-rise overflow-y-auto rounded-[22px] p-3">
      {turns.length === 0 && <p className="p-2 text-sm text-white/45">Nothing said yet.</p>}
      <ol className="flex flex-col gap-2">
        {turns.map((turn, i) => (
          <li
            key={i}
            className={
              turn.role === "customer"
                ? "ml-8 self-end rounded-2xl rounded-br-md bg-gold-400/15 px-3 py-2 text-[13px] text-gold-200"
                : turn.role === "lumi"
                  ? "mr-8 self-start rounded-2xl rounded-bl-md bg-white/[0.06] px-3 py-2 text-[13px] text-white/85"
                  : "self-center px-2 text-center text-[11px] text-white/40"
            }
          >
            {turn.text}
          </li>
        ))}
      </ol>
      <div ref={end} />
    </div>
  );
}
