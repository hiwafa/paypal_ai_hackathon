"use client";

import { Check, Minus, Plus, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { FrameGlyph } from "@/components/ui/FrameGlyph";
import { RobotAvatar } from "@/components/ui/RobotAvatar";
import { api } from "@/lib/client/api";
import { useRuntimeConfig } from "@/lib/client/config";
import { celebratePayment, say } from "@/lib/client/lumi";
import { useShop } from "@/lib/client/shopStore";
import type { CheckoutSummary } from "@/lib/domain/api";
import { SIZE_WIDTH_MM, getProduct } from "@/lib/domain/catalog";
import { formatMoney } from "@/lib/domain/money";
import { FRAME_SIZES, type CartLine, type FaceProfile } from "@/lib/domain/types";
import { PayPalCheckout } from "./PayPalCheckout";

function fitNoteFor(face: FaceProfile | null): string | undefined {
  if (!face) return undefined;
  const width = face.widthMm ? `, ${face.widthMm} mm wide` : "";
  return `Mirror fit: ${face.shape} face${width}, size ${face.recommendedSize}`;
}

export default function BagDrawer() {
  const bag = useShop((s) => s.bag);
  const lastOrder = useShop((s) => s.lastOrder);
  const close = useCallback(() => useShop.getState().openPanel(null), []);

  if (lastOrder && bag.length === 0) {
    return (
      <Drawer title="Thank you" subtitle={`Order ${lastOrder.number}`} onClose={close}>
        <Receipt order={lastOrder} />
      </Drawer>
    );
  }
  return <Bag lines={bag} onClose={close} />;
}

function Bag({ lines, onClose }: { lines: CartLine[]; onClose: () => void }) {
  const face = useShop((s) => s.face);
  const config = useRuntimeConfig();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalCents = lines.reduce((sum, line) => sum + getProduct(line.productId).priceCents * line.quantity, 0);
  const count = lines.reduce((n, line) => n + line.quantity, 0);

  const createOrder = async () => {
    setError(null);
    setPaying(true);
    try {
      return await api.createOrder(useShop.getState().bag, fitNoteFor(useShop.getState().face));
    } finally {
      setPaying(false);
    }
  };

  const capture = async (paypalOrderId: string) => {
    setPaying(true);
    try {
      const summary = await api.captureOrder(paypalOrderId);
      celebratePayment(summary);
    } finally {
      setPaying(false);
    }
  };

  if (lines.length === 0) {
    return (
      <Drawer title="Your bag" onClose={onClose} icon={<ShoppingBag className="size-5 text-gold-300" />}>
        <div className="flex flex-col items-center py-14 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-white/[0.05]">
            <ShoppingBag className="size-6 text-white/40" />
          </div>
          <p className="mt-4 font-display text-2xl text-white">Your bag is empty</p>
          <p className="mt-1 max-w-[16rem] text-sm text-white/50">
            Ask Lumi for ideas, or pick a frame from the shelves.
          </p>
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer
      title="Your bag"
      subtitle={`${count} ${count === 1 ? "frame" : "frames"} · free shipping`}
      icon={<ShoppingBag className="size-5 text-gold-300" />}
      onClose={onClose}
      footer={
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-white/55">Total</span>
            <span className="font-display text-3xl tabular-nums text-white">{formatMoney(totalCents)}</span>
          </div>
          {error && (
            <p role="alert" className="rounded-2xl bg-kai/10 px-3 py-2 text-sm text-kai">
              {error}
            </p>
          )}
          <PayPalCheckout
            totalCents={totalCents}
            disabled={paying}
            createOrder={createOrder}
            capture={capture}
            onCancel={() => say("No problem, your bag is saved whenever you're ready.", "caring")}
            onError={setError}
          />
          <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-white/40">
            <ShieldCheck className="mt-px size-3.5 shrink-0" />
            {config?.paypal.mode === "sandbox"
              ? "PayPal sandbox: use a sandbox buyer account. Prices are checked on our server."
              : "Simulator mode: no real money moves. Prices are checked on our server."}
          </p>
        </div>
      }
    >
      <ul className="space-y-2.5">
        {lines.map((line) => (
          <BagLine key={`${line.productId}-${line.size}`} line={line} recommended={face?.recommendedSize} />
        ))}
      </ul>

      {face && (
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-lumi/15 bg-lumi/[0.06] px-3 py-2.5 text-[12.5px] text-white/70">
          <RobotAvatar id="lumi" size={26} />
          <span>
            Fitted in the mirror: <span className="text-lumi">{face.shape}</span> face
            {face.widthMm ? `, about ${face.widthMm} mm wide` : ""}. Size {face.recommendedSize} recommended.
          </span>
        </div>
      )}

      <dl className="mt-5 space-y-1.5 text-sm">
        <div className="flex justify-between text-white/55">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{formatMoney(totalCents)}</dd>
        </div>
        <div className="flex justify-between text-white/55">
          <dt>Shipping</dt>
          <dd>Free</dd>
        </div>
      </dl>
    </Drawer>
  );
}

function BagLine({ line, recommended }: { line: CartLine; recommended?: CartLine["size"] }) {
  const product = getProduct(line.productId);
  const { setQuantity, setSize } = useShop.getState();

  return (
    <li className="flex gap-3 rounded-2xl bg-white/[0.035] p-3">
      <div className="grid h-14 w-20 shrink-0 place-items-center rounded-xl bg-white/[0.04]">
        <FrameGlyph product={product} className="w-16" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-xl leading-none text-white">{product.name}</span>
          <span className="text-sm tabular-nums text-white/85">{formatMoney(product.priceCents * line.quantity)}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-white/45">{product.tagline}</p>
        <div className="mt-2.5 flex items-center gap-2">
          <div role="radiogroup" aria-label="Frame size" className="flex rounded-full bg-white/[0.06] p-0.5">
            {FRAME_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={line.size === size}
                title={`${size}: ${SIZE_WIDTH_MM[size]} mm${size === recommended ? " · recommended" : ""}`}
                onClick={() => setSize(line.productId, line.size, size)}
                className={`relative h-7 w-8 rounded-full text-xs font-medium transition ${
                  line.size === size ? "bg-white text-ink-950" : "text-white/60 hover:text-white"
                }`}
              >
                {size}
                {size === recommended && (
                  <span className="absolute -top-0.5 right-0.5 size-1.5 rounded-full bg-lumi" aria-hidden />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-full bg-white/[0.06] p-0.5">
            <button
              type="button"
              aria-label="One fewer"
              onClick={() => setQuantity(line.productId, line.size, line.quantity - 1)}
              className="grid size-7 place-items-center rounded-full text-white/70 hover:bg-white/10"
            >
              <Minus className="size-3" />
            </button>
            <span className="w-5 text-center text-xs tabular-nums">{line.quantity}</span>
            <button
              type="button"
              aria-label="One more"
              disabled={line.quantity >= 3}
              onClick={() => setQuantity(line.productId, line.size, line.quantity + 1)}
              className="grid size-7 place-items-center rounded-full text-white/70 hover:bg-white/10 disabled:opacity-30"
            >
              <Plus className="size-3" />
            </button>
          </div>
          <button
            type="button"
            aria-label={`Remove ${product.name}`}
            onClick={() => setQuantity(line.productId, line.size, 0)}
            className="ml-auto grid size-7 place-items-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-kai"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

function Receipt({ order }: { order: CheckoutSummary }) {
  const firstName = order.payerName.split(" ")[0] || "friend";
  const rows: Array<[string, string, boolean?]> = [
    ["Order", order.number],
    ["Total", formatMoney(order.totalCents)],
    ["Paid via", order.rail === "paypal" ? "PayPal sandbox" : "PayPal simulator"],
    ["Transaction ID", order.captureId ?? "Pending", true],
  ];
  if (order.shipTo) rows.push(["Ships to", order.shipTo]);

  return (
    <div className="flex flex-col items-center pt-4 text-center">
      <div className="grid size-16 animate-rise place-items-center rounded-full bg-penny/15 text-penny">
        <Check className="size-8" strokeWidth={2.5} />
      </div>
      <h3 className="mt-4 font-display text-4xl text-white">Paid with PayPal</h3>
      <p className="mt-1.5 text-sm text-white/60">Thank you, {firstName}. Your frames are on their way.</p>

      <dl className="mt-6 w-full space-y-2 rounded-2xl bg-white/[0.035] p-4 text-left text-sm">
        {rows.map(([label, value, mono]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-white/45">{label}</dt>
            <dd title={value} className={`truncate text-right text-white ${mono ? "font-mono text-xs leading-5" : ""}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <ul className="mt-3 w-full space-y-1.5">
        {order.lines.map((line) => (
          <li
            key={`${line.productId}-${line.size}`}
            className="flex items-center gap-3 rounded-2xl bg-white/[0.035] px-3 py-2"
          >
            <FrameGlyph product={getProduct(line.productId)} className="w-12" />
            <span className="flex-1 text-left text-sm text-white">
              {line.name}{" "}
              <span className="text-white/45">
                · size {line.size} × {line.quantity}
              </span>
            </span>
            <span className="text-sm tabular-nums text-white/75">{formatMoney(line.unitCents * line.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex w-full items-start gap-2.5 rounded-2xl border border-kai/15 bg-kai/[0.06] p-3 text-left text-[13px] text-white/70">
        <RobotAvatar id="kai" size={28} />
        <span>Anything wrong with your frames later? Find me at the care desk with your order number.</span>
      </div>

      <button
        type="button"
        onClick={() => useShop.getState().patch({ lastOrder: null, bagOpen: false })}
        className="mt-5 w-full rounded-full bg-gold-400 py-3 text-sm font-semibold text-ink-950 transition hover:bg-gold-300"
      >
        Keep browsing
      </button>
    </div>
  );
}
