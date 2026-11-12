import type { Approval, LedgerEntry, SupplierBill } from "./types";

// KPI math shared by the browser (which knows the owner's time zone) and the
// server (AI briefing and crew tools).

export interface PeriodStats {
  salesCents: number;
  orders: number;
  refundsCents: number;
  payoutsCents: number;
  feesCents: number;
  /** Cash in minus cash out (sales − refunds − payouts − fees). */
  netCents: number;
}

export interface Kpis {
  today: PeriodStats;
  week: PeriodStats;
  pendingApprovals: number;
  pendingApprovalsCents: number;
  openBillsCents: number;
  billsDueSoon: number;
}

export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** Calendar day ("2026-11-05") of a timestamp in the given time zone. */
export function dayKey(value: string | Date, timeZone: string): string {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(timeZone, formatter);
  }
  return formatter.format(typeof value === "string" ? new Date(value) : value);
}

function emptyStats(): PeriodStats {
  return { salesCents: 0, orders: 0, refundsCents: 0, payoutsCents: 0, feesCents: 0, netCents: 0 };
}

function add(stats: PeriodStats, entry: LedgerEntry) {
  if (entry.status === "failed") return;
  if (entry.kind === "sale") {
    stats.salesCents += entry.amountCents;
    stats.orders += 1;
    stats.feesCents += entry.feeCents;
  } else if (entry.kind === "refund") {
    stats.refundsCents += Math.abs(entry.amountCents);
  } else {
    stats.payoutsCents += Math.abs(entry.amountCents);
  }
  stats.netCents = stats.salesCents - stats.refundsCents - stats.payoutsCents - stats.feesCents;
}

export function computeKpis(input: {
  ledger: readonly LedgerEntry[];
  approvals: readonly Approval[];
  bills: readonly SupplierBill[];
  now: Date;
  timeZone: string;
}): Kpis {
  const { ledger, approvals, bills, now, timeZone } = input;
  const today = dayKey(now, timeZone);
  const weekDays = new Set<string>();
  for (let i = 0; i < 7; i++) weekDays.add(dayKey(new Date(now.getTime() - i * 86_400_000), timeZone));

  const todayStats = emptyStats();
  const weekStats = emptyStats();
  for (const entry of ledger) {
    const day = dayKey(entry.at, timeZone);
    if (day === today) add(todayStats, entry);
    if (weekDays.has(day)) add(weekStats, entry);
  }

  const pending = approvals.filter((a) => a.status === "pending");
  const open = bills.filter((b) => b.status !== "paid");
  const soon = new Date(now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10);

  return {
    today: todayStats,
    week: weekStats,
    pendingApprovals: pending.length,
    pendingApprovalsCents: pending.reduce((sum, a) => sum + a.amountCents, 0),
    openBillsCents: open.reduce((sum, b) => sum + b.amountCents, 0),
    billsDueSoon: open.filter((b) => b.dueDate <= soon).length,
  };
}
