"use client";

import { Download, Search, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { localTimeZone } from "@/lib/client/api";
import { useOffice } from "@/lib/client/officeStore";
import type { LedgerGridHandle } from "./ledger/LedgerGrid";

const LedgerGrid = dynamic(() => import("./ledger/LedgerGrid"), {
  ssr: false,
  loading: () => <GridSkeleton />,
});

function GridSkeleton() {
  return (
    <div className="space-y-2 p-4" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-xl bg-white/[0.035]" />
      ))}
    </div>
  );
}

const TIME_ZONE = localTimeZone();

/** The ledger card: search, the crew's current view, CSV export and the grid itself. */
export function LedgerPanel() {
  const entries = useOffice((s) => s.state?.ledger);
  const view = useOffice((s) => s.view);
  const [search, setSearch] = useState("");
  const grid = useRef<LedgerGridHandle | null>(null);

  return (
    <section
      aria-labelledby="ledger-title"
      className="glass flex min-h-[420px] flex-col overflow-hidden rounded-[26px] xl:min-h-[320px] xl:flex-1"
    >
      <header className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-4">
        <div className="mr-auto">
          <h2 id="ledger-title" className="font-display text-[26px] leading-none text-white">
            Ledger
          </h2>
          <p className="mt-1 text-xs text-white/45">Every PayPal capture, refund and payout, booked by Penny.</p>
        </div>
        <label className="relative">
          <span className="sr-only">Search the ledger</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/35" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search orders, people, IDs"
            className="h-9 w-56 rounded-full border border-white/10 bg-white/[0.04] pl-8 pr-3 text-[13px] text-white placeholder:text-white/30 focus:border-gold-400/50 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => grid.current?.exportCsv()}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.07] px-3.5 text-[13px] text-white/80 transition hover:bg-white/[0.12] hover:text-white"
        >
          <Download className="size-3.5" /> Export CSV
        </button>
      </header>

      {view && (
        <div className="mx-5 mb-3 flex animate-rise items-center gap-2 rounded-2xl border border-penny/20 bg-penny/[0.06] px-3 py-2 text-[13px]">
          <Sparkles className="size-3.5 shrink-0 text-penny" />
          <span className="text-white/55">Penny&apos;s view:</span>
          <span className="truncate font-medium text-white">{view.title}</span>
          <button
            type="button"
            onClick={() => useOffice.getState().patch({ view: null })}
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white/55 transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-3.5" /> Show everything
          </button>
        </div>
      )}

      <div className="relative min-h-0 flex-1 border-t border-white/[0.06]">
        {entries ? (
          <LedgerGrid
            entries={entries}
            view={view}
            search={search}
            timeZone={TIME_ZONE}
            onReady={(handle) => {
              grid.current = handle;
            }}
          />
        ) : (
          <GridSkeleton />
        )}
      </div>
    </section>
  );
}
