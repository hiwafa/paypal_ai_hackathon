"use client";

import { RotateCcw, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ModeBadges } from "@/components/ui/ModeBadges";
import { resetDemo, setOfficeMuted } from "@/lib/client/office";
import { useOffice } from "@/lib/client/officeStore";
import { STORE } from "@/lib/domain/catalog";

/** Restores the seeded week; asks once before wiping what the visitor did. */
function ResetDemo() {
  const [step, setStep] = useState<"idle" | "confirm" | "busy" | "failed">("idle");

  const reset = async () => {
    setStep("busy");
    try {
      await resetDemo();
      setStep("idle");
    } catch {
      setStep("failed");
    }
  };

  if (step === "confirm" || step === "busy") {
    return (
      <span className="glass inline-flex h-10 items-center gap-1 rounded-full pl-3.5 pr-1 text-[13px] text-white/75">
        Restore the demo week?
        <button
          type="button"
          onClick={() => void reset()}
          disabled={step === "busy"}
          className="ml-1 h-8 rounded-full bg-gold-400 px-3 text-[12.5px] font-semibold text-ink-950 transition hover:bg-gold-300 disabled:opacity-60"
        >
          {step === "busy" ? "Resetting…" : "Reset"}
        </button>
        <button
          type="button"
          onClick={() => setStep("idle")}
          disabled={step === "busy"}
          className="h-8 rounded-full px-3 text-[12.5px] text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setStep("confirm")}
      title="Restore the seeded week of sales, refunds and bills"
      className="glass inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-sm text-white/75 transition hover:text-white"
    >
      <RotateCcw className="size-4" />
      <span className="hidden sm:inline">{step === "failed" ? "Reset failed, retry" : "Reset demo"}</span>
    </button>
  );
}

export function OfficeHeader() {
  const config = useOffice((s) => s.state?.config ?? null);
  const muted = useOffice((s) => s.muted);

  return (
    <header className="flex flex-wrap items-center gap-3 px-4 pt-4 xl:px-5">
      <Link href="/" className="glass flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4">
        <span className="grid size-9 place-items-center rounded-full bg-gold-400/15 font-display text-xl italic text-gold-300">
          M
        </span>
        <span className="leading-tight">
          <span className="block font-display text-[19px] text-white">{STORE.name}</span>
          <span className="block text-[10px] uppercase tracking-[0.22em] text-white/45">Back office · CrewOS</span>
        </span>
      </Link>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <ModeBadges config={config} className="mr-1 hidden lg:inline-flex" />
        <ResetDemo />
        <button
          type="button"
          onClick={() => setOfficeMuted(!muted)}
          aria-label={muted ? "Unmute the crew" : "Mute the crew"}
          aria-pressed={muted}
          className="glass grid size-10 place-items-center rounded-full text-white/80 transition hover:text-white"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <Link
          href="/shop"
          target="_blank"
          className="glass inline-flex h-10 items-center rounded-full px-4 text-sm text-white/85 transition hover:text-white"
        >
          Open the boutique ↗
        </Link>
      </div>
    </header>
  );
}
