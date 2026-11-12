"use client";

import { useMemo, type ReactNode } from "react";
import { localTimeZone } from "@/lib/client/api";
import { useOffice } from "@/lib/client/officeStore";
import { computeKpis } from "@/lib/domain/kpis";
import { formatMoney } from "@/lib/domain/money";

function Tile({ label, value, note, tone }: { label: string; value: ReactNode; note: ReactNode; tone: string }) {
  return (
    <div className="glass relative overflow-hidden rounded-[22px] px-4 py-3.5">
      <span
        aria-hidden
        className="absolute -right-6 -top-8 size-24 rounded-full opacity-25 blur-2xl"
        style={{ background: tone }}
      />
      <p className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-1.5 font-display text-[30px] leading-none tabular-nums text-white">{value}</p>
      <p className="mt-1.5 truncate text-xs text-white/50">{note}</p>
    </div>
  );
}

/** Today's money at a glance. "Today" follows the owner's own time zone. */
export function KpiStrip() {
  const state = useOffice((s) => s.state);
  const kpis = useMemo(
    () =>
      state
        ? computeKpis({
            ledger: state.ledger,
            approvals: state.approvals,
            bills: state.bills,
            now: new Date(),
            timeZone: localTimeZone(),
          })
        : null,
    [state],
  );

  if (!kpis) {
    return (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[98px] animate-pulse rounded-[22px] bg-white/[0.04]" />
        ))}
      </div>
    );
  }

  const { today, week } = kpis;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Tile
        label="Sales today"
        value={formatMoney(today.salesCents)}
        note={`${today.orders} ${today.orders === 1 ? "order" : "orders"} · ${formatMoney(today.feesCents)} PayPal fees`}
        tone="#86efac"
      />
      <Tile
        label="Net cash · 7 days"
        value={formatMoney(week.netCents)}
        note={`${formatMoney(week.salesCents)} in · ${formatMoney(week.refundsCents + week.payoutsCents)} out`}
        tone="#e8c98e"
      />
      <Tile
        label="Waiting for you"
        value={kpis.pendingApprovals}
        note={
          kpis.pendingApprovals
            ? `${formatMoney(kpis.pendingApprovalsCents)} ready to approve`
            : "Nothing needs your OK"
        }
        tone="#c4b5fd"
      />
      <Tile
        label="Supplier bills"
        value={formatMoney(kpis.openBillsCents)}
        note={kpis.billsDueSoon ? `${kpis.billsDueSoon} due within 3 days` : "None due in the next 3 days"}
        tone="#fcd34d"
      />
    </div>
  );
}
