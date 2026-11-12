"use client";

import { Volume2, X } from "lucide-react";
import { RobotAvatar } from "@/components/ui/RobotAvatar";
import { modelLabel } from "@/components/ui/ModeBadges";
import { useOffice } from "@/lib/client/officeStore";
import { speak } from "@/lib/client/speech";

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.2em]" style={{ color: tone }}>
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-[12.5px] leading-snug text-white/75">
            <span className="mt-[7px] size-1 shrink-0 rounded-full" style={{ background: tone }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Penny's daily briefing, written from the books and read aloud. */
export function BriefingCard() {
  const briefing = useOffice((s) => s.briefing);
  const model = useOffice((s) => s.state?.config.ai.model ?? null);
  if (!briefing) return null;

  return (
    <section aria-labelledby="briefing-title" className="glass animate-rise rounded-[26px] p-4">
      <header className="flex items-start gap-3">
        <RobotAvatar id="penny" size={34} />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] uppercase tracking-[0.2em] text-penny">
            Daily briefing ·{" "}
            {new Date(briefing.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <h2 id="briefing-title" className="mt-0.5 font-display text-[22px] leading-tight text-white">
            {briefing.headline}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => speak(briefing.spoken, "penny")}
          aria-label="Read the briefing aloud"
          className="grid size-8 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Volume2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => useOffice.getState().patch({ briefing: null })}
          aria-label="Close the briefing"
          className="grid size-8 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="mt-3 space-y-3">
        <List title="Highlights" items={briefing.highlights} tone="#86efac" />
        <List title="Watch out" items={briefing.watchouts} tone="#fcd34d" />
        <List title="Next steps" items={briefing.nextSteps} tone="#c4b5fd" />
      </div>
      <p className="mt-3 text-[11px] text-white/35">
        {briefing.source === "claude"
          ? `Written by Claude ${modelLabel(model)} from the ledger; every number comes from the books.`
          : "Offline summary from the ledger. Add an Anthropic key for Penny's own words."}
      </p>
    </section>
  );
}
