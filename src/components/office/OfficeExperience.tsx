"use client";

import { CircleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useOfficeFeed } from "@/hooks/useOfficeFeed";
import { refreshOffice } from "@/lib/client/office";
import { useOffice } from "@/lib/client/officeStore";
import { unlockSpeech } from "@/lib/client/speech";
import { ActivityFeed } from "./ActivityFeed";
import { ApprovalsTray } from "./ApprovalsTray";
import { BriefingCard } from "./BriefingCard";
import { CrewConsole } from "./CrewConsole";
import { KpiStrip } from "./KpiStrip";
import { LedgerPanel } from "./LedgerPanel";
import { OfficeHeader } from "./OfficeHeader";

// WebGL loads in the browser only; the rest of the office renders right away.
const CrewRoom = dynamic(() => import("./scene/CrewRoom"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-white/[0.02]" aria-hidden />,
});

function LoadError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="glass mx-4 mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 text-[13px] text-white/80 xl:mx-5"
    >
      <CircleAlert className="size-4 shrink-0 text-kai" />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={() => void refreshOffice()}
        className="h-8 rounded-full bg-white/[0.08] px-3 text-[12.5px] text-white transition hover:bg-white/[0.14]"
      >
        Try again
      </button>
    </div>
  );
}

/** Maryam's back office: the crew room, the books and everything waiting for her. */
export function OfficeExperience() {
  useOfficeFeed();
  const loadError = useOffice((s) => s.loadError);

  useEffect(() => {
    void refreshOffice();
    // Browsers only let a page speak after a user gesture, so the first
    // click anywhere opens the crew's voices.
    const unlock = () => unlockSpeech();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  return (
    <main className="relative min-h-dvh bg-ink-950 xl:h-dvh xl:overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(60%_45%_at_25%_0%,rgb(232_201_142/0.07),transparent_70%),radial-gradient(40%_40%_at_95%_100%,rgb(196_181_253/0.06),transparent_70%)]"
      />
      <div className="relative mx-auto flex min-h-dvh max-w-[1840px] flex-col xl:h-dvh">
        <OfficeHeader />
        {loadError && <LoadError message={loadError} />}

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:px-5 xl:pb-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="scrollbar-thin flex min-h-0 min-w-0 flex-col gap-4 xl:overflow-y-auto">
            <section
              aria-label="The crew room"
              className="glass relative h-[clamp(230px,21vw,350px)] shrink-0 overflow-hidden rounded-[26px]"
            >
              <CrewRoom />
            </section>
            <KpiStrip />
            <LedgerPanel />
          </div>

          <aside className="scrollbar-thin flex min-h-0 min-w-0 flex-col gap-4 xl:overflow-y-auto xl:pr-1">
            <CrewConsole />
            <BriefingCard />
            <ApprovalsTray />
            <ActivityFeed />
          </aside>
        </div>
      </div>
    </main>
  );
}
