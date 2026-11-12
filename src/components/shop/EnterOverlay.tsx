"use client";

import { Camera, Volume2 } from "lucide-react";
import { greet } from "@/lib/client/lumi";
import { useShop } from "@/lib/client/shopStore";
import { unlockSpeech } from "@/lib/client/speech";
import { STORE } from "@/lib/domain/catalog";

/** Lumi greets after gliding to the counter, so the wave lands on camera. */
const GREETING_DELAY_MS = 1500;

function enter() {
  unlockSpeech(); // browsers only allow speech that starts from a click
  useShop.getState().enter();
  window.setTimeout(() => {
    if (useShop.getState().turns.length === 0) greet();
  }, GREETING_DELAY_MS);
}

/**
 * The shop door. Entering is a real click, which also unlocks Lumi's voice.
 */
export function EnterOverlay() {
  const entered = useShop((s) => s.entered);

  return (
    <div
      aria-hidden={entered}
      className={`fixed inset-0 z-50 grid place-items-center bg-gradient-to-b from-ink-950/20 via-ink-950/50 to-ink-950/90 transition-opacity duration-700 ${
        entered ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="max-w-xl px-6 text-center">
        <p className="animate-rise text-[11px] uppercase tracking-[0.38em] text-gold-300/80">
          {STORE.name} · {STORE.city}
        </p>
        <h1 className="mt-5 animate-rise font-display text-5xl leading-[1.04] text-white [animation-delay:120ms] sm:text-6xl">
          Frames that fit <em className="text-gradient-gold">your</em> face.
        </h1>
        <p className="mx-auto mt-5 max-w-md animate-rise text-[15px] leading-relaxed text-white/65 [animation-delay:240ms]">
          Lumi, our robot stylist, reads your face shape in the magic mirror, picks frames that suit you and checks you
          out with PayPal.
        </p>
        <button
          type="button"
          onClick={enter}
          disabled={entered}
          className="mt-9 animate-rise rounded-full bg-gold-400 px-8 py-3.5 text-[15px] font-semibold text-ink-950 shadow-[0_10px_40px_-10px_rgba(232,201,142,0.7)] transition [animation-delay:360ms] hover:bg-gold-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-300"
        >
          Enter the boutique
        </button>
        <div className="mt-6 flex animate-rise flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-white/45 [animation-delay:480ms]">
          <span className="inline-flex items-center gap-1.5">
            <Volume2 className="size-3.5" /> Sound on: Lumi talks
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Camera className="size-3.5" /> Camera only in the mirror, and it stays on your device
          </span>
        </div>
      </div>
    </div>
  );
}
