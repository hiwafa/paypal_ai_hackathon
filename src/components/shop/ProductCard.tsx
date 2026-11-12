"use client";

import { Check, ChevronLeft, ChevronRight, ScanFace, ShoppingBag, Undo2 } from "lucide-react";
import { FrameGlyph } from "@/components/ui/FrameGlyph";
import { addFromCounter, tryOnFrame } from "@/lib/client/lumi";
import { useShop } from "@/lib/client/shopStore";
import { SIZE_WIDTH_MM, getProduct } from "@/lib/domain/catalog";
import { formatMoney } from "@/lib/domain/money";

/** Details for the frame in focus on the counter, with try-on and add-to-bag. */
export function ProductCard() {
  const onCounter = useShop((s) => s.onCounter);
  const focused = useShop((s) => s.focused);
  const face = useShop((s) => s.face);
  const panelOpen = useShop((s) => s.mirror !== "closed" || s.bagOpen || s.careOpen);
  const bag = useShop((s) => s.bag);

  if (panelOpen || onCounter.length === 0) return null;
  const current = focused && onCounter.includes(focused) ? focused : onCounter[0];
  const index = onCounter.indexOf(current);
  const product = getProduct(current);
  const inBag = bag.some((line) => line.productId === current);
  const size = face?.recommendedSize ?? "M";
  const suits = face ? product.suits.includes(face.shape) : null;
  const step = (delta: number) =>
    useShop.getState().patch({ focused: onCounter[(index + delta + onCounter.length) % onCounter.length] });

  return (
    <article
      key={current}
      aria-label={`${product.name} details`}
      className="glass-strong fixed bottom-4 right-4 z-40 w-[min(330px,calc(100vw-2rem))] animate-rise rounded-[26px] p-4 max-md:bottom-auto max-md:top-[76px]"
    >
      <div className="flex items-center justify-between text-[10.5px] uppercase tracking-[0.2em] text-white/45">
        <span>On the counter</span>
        {onCounter.length > 1 && (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous frame"
              className="rounded-full p-1 hover:bg-white/10"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            {onCounter.map((id) => (
              <button
                key={id}
                type="button"
                aria-label={`Show ${getProduct(id).name}`}
                onClick={() => useShop.getState().patch({ focused: id })}
                className={`size-1.5 rounded-full transition ${id === current ? "bg-lumi" : "bg-white/25 hover:bg-white/50"}`}
              />
            ))}
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next frame"
              className="rounded-full p-1 hover:bg-white/10"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div className="grid h-14 w-24 shrink-0 place-items-center rounded-2xl bg-white/[0.04]">
          <FrameGlyph product={product} className="w-20" />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="font-display text-[26px] leading-none text-white">{product.name}</h3>
            <span className="text-sm tabular-nums text-gold-300">{formatMoney(product.priceCents)}</span>
          </div>
          <p className="mt-1 truncate text-xs text-white/55">{product.tagline}</p>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-white/70">{product.description}</p>

      <p className="mt-2 text-xs text-white/50">
        {suits === null ? (
          <>
            Size {size} · {SIZE_WIDTH_MM[size]} mm. The mirror can measure your fit.
          </>
        ) : (
          <span className={suits ? "text-lumi" : "text-white/55"}>
            {suits ? `Suits your ${face?.shape} face` : `A bold pick for a ${face?.shape} face`} · size {size},{" "}
            {SIZE_WIDTH_MM[size]} mm
          </span>
        )}
      </p>

      <div className="mt-3.5 flex gap-2">
        <button
          type="button"
          onClick={() => tryOnFrame(current)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-2.5 text-[13px] font-medium text-white transition hover:bg-white/15"
        >
          <ScanFace className="size-4" /> Try on
        </button>
        <button
          type="button"
          onClick={() => addFromCounter(current)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gold-400 px-3 py-2.5 text-[13px] font-semibold text-ink-950 transition hover:bg-gold-300"
        >
          {inBag ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
          {inBag ? "Add another" : `Add · ${size}`}
        </button>
        <button
          type="button"
          onClick={() => useShop.getState().returnFrame(current)}
          aria-label={`Put ${product.name} back on the shelf`}
          title="Put back"
          className="grid size-10 shrink-0 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Undo2 className="size-4" />
        </button>
      </div>
    </article>
  );
}
