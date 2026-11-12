import "server-only";
import { computeKpis, dayKey, type PeriodStats } from "@/lib/domain/kpis";
import { formatMoney } from "@/lib/domain/money";
import { describeDamage } from "@/lib/domain/policy";
import { defaultRail } from "../paypal/gateway";
import { readDb } from "../store";

// Facts the AI crew reasons over. Amounts are pre-formatted strings so the
// model never has to do cents arithmetic.

function period(stats: PeriodStats) {
  return {
    sales: formatMoney(stats.salesCents),
    orders: stats.orders,
    refunds: formatMoney(stats.refundsCents),
    supplier_payouts: formatMoney(stats.payoutsCents),
    paypal_fees: formatMoney(stats.feesCents),
    net_cash: formatMoney(stats.netCents),
  };
}

export function businessFacts(timeZone: string) {
  const db = readDb();
  const now = new Date();
  const kpis = computeKpis({ ledger: db.ledger, approvals: db.approvals, bills: db.bills, now, timeZone });
  const weekAgo = now.getTime() - 7 * 86_400_000;

  const unitsByFrame = new Map<string, number>();
  for (const order of db.orders) {
    if (!order.capturedAt || Date.parse(order.capturedAt) < weekAgo) continue;
    for (const line of order.lines) {
      unitsByFrame.set(line.name, (unitsByFrame.get(line.name) ?? 0) + line.quantity);
    }
  }
  const bestSellers = [...unitsByFrame.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([frame, units]) => ({ frame, units }));

  return {
    today: dayKey(now, timeZone),
    time_zone: timeZone,
    payment_rail: defaultRail() === "paypal" ? "PayPal sandbox" : "simulated (no PayPal keys yet)",
    today_totals: period(kpis.today),
    last_7_days: period(kpis.week),
    best_sellers_7_days: bestSellers,
    pending_approvals: db.approvals
      .filter((a) => a.status === "pending")
      .map((a) => ({ id: a.id, title: a.title, amount: formatMoney(a.amountCents), requested_by: a.requestedBy })),
    open_supplier_bills: db.bills
      .filter((b) => b.status !== "paid")
      .map((b) => ({
        id: b.id,
        supplier: b.supplierName,
        invoice: b.invoiceNumber,
        description: b.description,
        amount: formatMoney(b.amountCents),
        due: b.dueDate,
        status: b.status,
      })),
    recent_claims: db.claims
      .filter((c) => Date.parse(c.createdAt) >= weekAgo)
      .slice(0, 5)
      .map((c) => ({
        order: c.orderNumber,
        damage: describeDamage(c.assessment.damageType),
        outcome: c.decision.action,
        refund: formatMoney(c.decision.refundCents),
        status: c.status,
      })),
  };
}

export type BusinessFacts = ReturnType<typeof businessFacts>;
