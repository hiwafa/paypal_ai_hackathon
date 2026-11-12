"use client";

import type { CustomCellRendererProps } from "ag-grid-react";
import { ArrowDownLeft, ArrowUpRight, Check, Clock3, ShieldCheck, Undo2, XCircle } from "lucide-react";
import { RobotAvatar } from "@/components/ui/RobotAvatar";
import { formatMoney, formatSigned } from "@/lib/domain/money";
import { ROBOTS } from "@/lib/domain/robots";
import type { LedgerEntry, LedgerKind, RobotId } from "@/lib/domain/types";

// Cell renderers for the ledger grid. Each one also knows how to draw the
// pinned totals row, which carries a `LedgerTotals` object instead of an entry.

export interface LedgerTotals {
  totals: true;
  count: number;
  amountCents: number;
  feeCents: number;
  netCents: number;
  label: string;
}

export type LedgerRow = LedgerEntry | LedgerTotals;

export function isTotals(row: LedgerRow | undefined): row is LedgerTotals {
  return Boolean(row && "totals" in row);
}

type Props<TValue> = CustomCellRendererProps<LedgerRow, TValue>;

const KINDS: Record<LedgerKind, { label: string; tone: string; Icon: typeof ArrowDownLeft }> = {
  sale: { label: "Sale", tone: "#86efac", Icon: ArrowDownLeft },
  refund: { label: "Refund", tone: "#fda4af", Icon: Undo2 },
  payout: { label: "Payout", tone: "#fcd34d", Icon: ArrowUpRight },
};

export function KindCell({ value }: Props<LedgerKind>) {
  if (!value) return null;
  const { label, tone, Icon } = KINDS[value];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium leading-none"
      style={{ color: tone, background: `${tone}17`, boxShadow: `inset 0 0 0 1px ${tone}26` }}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

export function DescriptionCell({ data }: Props<string>) {
  if (!data) return null;
  if (isTotals(data)) {
    return (
      <span className="flex h-full flex-col justify-center leading-tight">
        <span className="font-semibold text-white">Totals</span>
        <span className="truncate text-[11.5px] text-white/45">
          {data.count} {data.count === 1 ? "entry" : "entries"} · {data.label}
        </span>
      </span>
    );
  }
  return (
    <span className="flex h-full min-w-0 flex-col justify-center leading-tight">
      <span className="truncate text-white/90">{data.description}</span>
      <span className="truncate text-[11.5px] text-white/40">
        {data.counterparty}
        {/* A PayPal ID can be looked up in the sandbox; a sample row's made-up one is just noise. */}
        {data.rail === "paypal" && (
          <>
            {" · "}
            <span className="font-mono text-[11px] text-white/35">{data.reference}</span>
          </>
        )}
      </span>
    </span>
  );
}

export function RobotCell({ value }: Props<RobotId>) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <RobotAvatar id={value} size={22} />
      <span className="text-white/75">{ROBOTS[value].name}</span>
    </span>
  );
}

/** Signed money: green when it comes in, rose when it goes out. */
export function MoneyCell({ value, data }: Props<number>) {
  if (value == null) return null;
  const failed = !isTotals(data) && data?.status === "failed";
  const tone = failed
    ? "text-white/30 line-through"
    : value > 0
      ? "text-penny"
      : value < 0
        ? "text-kai"
        : "text-white/40";
  return (
    <span className={`tabular-nums ${tone} ${isTotals(data) ? "font-semibold" : ""}`}>
      {value === 0 ? "—" : formatSigned(value)}
    </span>
  );
}

export function FeeCell({ value, data }: Props<number>) {
  if (!value) return <span className="text-white/25">—</span>;
  return (
    <span className={`tabular-nums text-white/45 ${isTotals(data) ? "font-semibold" : ""}`}>−{formatMoney(value)}</span>
  );
}

export function StatusCell({ data }: Props<string>) {
  if (!data || isTotals(data)) return null;
  // Sample rows (the seeded week, or the simulator when no keys are set) never
  // touched PayPal, so they make no claim about who confirmed them.
  if (data.rail !== "paypal" && data.status === "completed") {
    return <span className="flex h-full items-center text-[12px] text-white/35">Sample data</span>;
  }
  const rail = data.rail === "paypal" ? "PayPal sandbox" : "Simulator";
  let badge;
  if (data.status === "failed") {
    badge = (
      <span className="inline-flex items-center gap-1 text-kai">
        <XCircle className="size-3.5" aria-hidden /> Failed
      </span>
    );
  } else if (data.status === "pending") {
    badge = (
      <span className="inline-flex items-center gap-1 text-otto">
        <Clock3 className="size-3.5 animate-pulse" aria-hidden /> Pending
      </span>
    );
  } else if (data.confirmedBy === "webhook") {
    badge = (
      <span className="inline-flex items-center gap-1 text-paypal">
        <ShieldCheck className="size-3.5" aria-hidden /> Webhook verified
      </span>
    );
  } else {
    badge = (
      <span className="inline-flex items-center gap-1 text-white/70">
        <Check className="size-3.5" aria-hidden /> Confirmed by API
      </span>
    );
  }
  return (
    <span className="flex h-full flex-col justify-center leading-tight">
      <span className="text-[12.5px]">{badge}</span>
      <span className="text-[11px] text-white/35">{rail}</span>
    </span>
  );
}
