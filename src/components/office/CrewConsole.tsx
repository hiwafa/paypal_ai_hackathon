"use client";

import { ArrowUp, CircleAlert, Mic, MicOff, Newspaper } from "lucide-react";
import { useMemo, useState } from "react";
import { RobotAvatar } from "@/components/ui/RobotAvatar";
import { modelLabel } from "@/components/ui/ModeBadges";
import { useListen } from "@/hooks/useListen";
import { useSpeaker } from "@/hooks/useSpeaker";
import { fetchBriefing, sayToCrew } from "@/lib/client/office";
import { useOffice } from "@/lib/client/officeStore";
import { ROBOTS } from "@/lib/domain/robots";

function TypingDots({ tone }: { tone: string }) {
  return (
    <span className="inline-flex items-center gap-1 py-1.5" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-dot size-1.5 rounded-full"
          style={{ background: tone, animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

/** Quick commands that match the shop's current state, so a visitor can click through the story. */
function useSuggestions(): string[] {
  const state = useOffice((s) => s.state);
  return useMemo(() => {
    if (!state) return [];
    const suggestions: string[] = [];
    if (state.approvals.some((a) => a.status === "pending")) suggestions.push("Approve it");
    suggestions.push("How are we doing today?");
    const bill = state.bills
      .filter((b) => b.status === "open" || b.status === "failed")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    if (bill) suggestions.push(`Pay ${bill.supplierName}`);
    suggestions.push("Show this week's refunds");
    return suggestions.slice(0, 3);
  }, [state]);
}

/** Maryam talks to the crew here: typed or spoken, with one-click suggestions. */
export function CrewConsole() {
  const reply = useOffice((s) => s.reply);
  const owner = useOffice((s) => s.lastOwnerTurn);
  const thinking = useOffice((s) => s.thinking);
  const error = useOffice((s) => s.commandError);
  const briefingLoading = useOffice((s) => s.briefingLoading);
  const model = useOffice((s) => s.state?.config.ai.model ?? null);
  const suggestions = useSuggestions();
  const talking = useSpeaker();
  const [draft, setDraft] = useState("");

  const send = (text: string, via: "voice" | "typed") => {
    const clean = text.trim();
    if (!clean || useOffice.getState().thinking) return;
    setDraft("");
    void sayToCrew(clean, via);
  };
  const voice = useListen((text) => send(text, "voice"));

  const speaker = thinking ?? reply?.robot ?? "penny";
  const profile = ROBOTS[speaker];

  return (
    <section aria-labelledby="console-title" className="glass-strong rounded-[26px] p-4">
      <header className="flex items-center gap-2">
        <h2 id="console-title" className="text-[13px] font-semibold text-white">
          Talk to your crew
        </h2>
        <button
          type="button"
          onClick={() => void fetchBriefing()}
          disabled={briefingLoading || thinking !== null}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full bg-penny/15 px-3 text-[12px] font-medium text-penny transition hover:bg-penny/25 disabled:opacity-50"
        >
          <Newspaper className="size-3.5" /> {briefingLoading ? "Penny is writing…" : "Daily briefing"}
        </button>
      </header>

      <div className="mt-3 rounded-2xl bg-white/[0.035] p-3.5">
        {owner && (
          <p className="mb-2 flex items-center gap-1.5 truncate text-[12.5px] text-white/45">
            {owner.via === "voice" && <Mic className="size-3 shrink-0" aria-label="Said aloud" />}
            You: {owner.text}
          </p>
        )}
        <div className="flex gap-3">
          <RobotAvatar id={speaker} size={38} active={thinking !== null} speaking={talking === speaker} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/40">
              <span className="font-semibold" style={{ color: profile.accent }}>
                {profile.name}
              </span>
              {profile.role}
              {reply?.source && !thinking && (
                <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 normal-case tracking-normal text-white/45">
                  {reply.source === "claude" ? `Claude ${modelLabel(model)}` : "Offline brain"}
                </span>
              )}
            </p>
            {thinking ? (
              <TypingDots tone={profile.accent} />
            ) : (
              <p className="mt-1 text-[14px] leading-relaxed text-white/90" aria-live="polite">
                {reply?.text ??
                  "Hi Maryam. Ask us anything about the shop's money, or tell Otto which supplier to pay. Nothing leaves without your OK."}
              </p>
            )}
            {!thinking && reply && reply.actions.some((a) => a.kind !== "lookup") && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {reply.actions
                  .filter((a) => a.kind !== "lookup")
                  .map((action, i) => (
                    <li
                      key={`${action.kind}-${i}`}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-white/70"
                    >
                      {action.kind === "ledger_view" ? "On the ledger: " : "Waiting for you: "}
                      {action.label}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-[12.5px] text-kai">
          <CircleAlert className="size-3.5" /> {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={thinking !== null}
            onClick={() => send(suggestion, "typed")}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-white/75 transition hover:border-gold-400/40 hover:text-white disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft, "typed");
        }}
      >
        {voice.supported && (
          <button
            type="button"
            onClick={voice.listening ? voice.stop : voice.start}
            aria-pressed={voice.listening}
            aria-label={voice.listening ? "Stop listening" : "Speak to the crew"}
            className={`relative grid size-11 shrink-0 place-items-center rounded-full transition ${
              voice.listening ? "bg-owner text-ink-950" : "bg-white/[0.07] text-white/80 hover:bg-white/[0.12]"
            }`}
          >
            {voice.listening && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-owner/50" />}
            {voice.listening ? <MicOff className="relative size-4" /> : <Mic className="size-4" />}
          </button>
        )}
        <input
          value={voice.listening ? voice.interim || "Listening…" : draft}
          onChange={(event) => setDraft(event.target.value)}
          readOnly={voice.listening}
          maxLength={400}
          placeholder="Ask Penny, Otto or Kai…"
          aria-label="Message to the crew"
          className="h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 text-[14px] text-white placeholder:text-white/30 focus:border-owner/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() || thinking !== null}
          aria-label="Send"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-400 text-ink-950 transition hover:bg-gold-300 disabled:bg-white/10 disabled:text-white/30"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
      {voice.error && <p className="mt-1.5 text-[12px] text-kai">{voice.error}</p>}
    </section>
  );
}
