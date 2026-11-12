"use client";

import { LifeBuoy, ShoppingBag, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ModeBadges } from "@/components/ui/ModeBadges";
import { useRuntimeConfig } from "@/lib/client/config";
import { useShop, type Panel } from "@/lib/client/shopStore";
import { STORE } from "@/lib/domain/catalog";
import { plural } from "@/lib/domain/words";

function togglePanel(panel: Panel) {
  const shop = useShop.getState();
  const open = panel === "bag" ? shop.bagOpen : panel === "care" ? shop.careOpen : shop.mirror !== "closed";
  shop.openPanel(open ? null : panel);
}

function PillButton({
  onClick,
  label,
  icon,
  badge,
}: {
  onClick: () => void;
  label: string;
  icon: ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // The visible label is hidden on phones, so the name lives here too.
      aria-label={badge ? `${label}, ${plural(badge, "item")}` : label}
      className="glass relative inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-sm text-white/85 transition hover:text-white"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {badge ? (
        <span className="grid min-w-5 place-items-center rounded-full bg-gold-400 px-1 text-[11px] font-semibold text-ink-950">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function ShopHeader() {
  const config = useRuntimeConfig();
  const bagCount = useShop((s) => s.bag.reduce((n, line) => n + line.quantity, 0));
  const muted = useShop((s) => s.muted);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-3 p-4">
      <Link href="/" className="glass pointer-events-auto flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4">
        <span className="grid size-9 place-items-center rounded-full bg-gold-400/15 font-display text-xl italic text-gold-300">
          M
        </span>
        <span className="leading-tight">
          <span className="block font-display text-[19px] text-white">{STORE.name}</span>
          <span className="block text-[10px] uppercase tracking-[0.22em] text-white/45">
            {STORE.city} · run by CrewOS
          </span>
        </span>
      </Link>

      <div className="pointer-events-auto flex items-center gap-2">
        <ModeBadges config={config} className="mr-1 hidden lg:inline-flex" />
        <PillButton onClick={() => togglePanel("care")} label="Care" icon={<LifeBuoy className="size-4" />} />
        <PillButton
          onClick={() => togglePanel("bag")}
          label="Bag"
          icon={<ShoppingBag className="size-4" />}
          badge={bagCount}
        />
        <button
          type="button"
          onClick={() => useShop.getState().patch({ muted: !muted })}
          aria-label={muted ? "Unmute Lumi" : "Mute Lumi"}
          aria-pressed={muted}
          className="glass grid size-10 place-items-center rounded-full text-white/80 transition hover:text-white"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>
    </header>
  );
}
