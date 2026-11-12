import "server-only";
import { getProduct, SUPPLIERS } from "@/lib/domain/catalog";
import { formatMoney } from "@/lib/domain/money";
import type { ActivityItem, FrameSize, LedgerEntry, Order, ProductId, SupplierBill } from "@/lib/domain/types";
import { newId, simulatedId } from "./ids";
import type { Db } from "./store";

// A week of believable history so the back office never opens empty. Every
// seeded record is on the "simulated" rail and is labelled that way in the UI;
// only what happens live in the demo touches the PayPal sandbox.

/** Bump when the stored shape changes; older files are then reseeded. */
export const DB_VERSION = 3;

interface HistoricSale {
  daysAgo: number;
  time: [number, number];
  customer: string;
  lines: Array<[ProductId, FrameSize]>;
}

const HISTORY: HistoricSale[] = [
  { daysAgo: 6, time: [10, 12], customer: "Ines Duarte", lines: [["harbor", "M"]] },
  { daysAgo: 6, time: [16, 40], customer: "Tomas Reis", lines: [["atlas", "L"]] },
  { daysAgo: 5, time: [11, 5], customer: "Leila Haddad", lines: [["vega", "S"]] },
  {
    daysAgo: 5,
    time: [18, 22],
    customer: "Noah Becker",
    lines: [
      ["solstice", "L"],
      ["pebble", "L"],
    ],
  },
  { daysAgo: 4, time: [9, 48], customer: "Amara Okafor", lines: [["kite", "M"]] },
  { daysAgo: 4, time: [14, 31], customer: "Jonas Weber", lines: [["ridge", "M"]] },
  { daysAgo: 3, time: [12, 15], customer: "Priya Nair", lines: [["mesa", "M"]] },
  { daysAgo: 3, time: [17, 2], customer: "Mateo Silva", lines: [["juniper", "M"]] },
  { daysAgo: 2, time: [10, 37], customer: "Yuki Tanaka", lines: [["pebble", "S"]] },
  {
    daysAgo: 2,
    time: [15, 54],
    customer: "Zoe Martin",
    lines: [
      ["vega", "M"],
      ["atlas", "M"],
    ],
  },
  { daysAgo: 1, time: [11, 26], customer: "Omar Khalil", lines: [["solstice", "M"]] },
  { daysAgo: 1, time: [19, 8], customer: "Elena Rossi", lines: [["harbor", "S"]] },
  { daysAgo: 0, time: [9, 41], customer: "Lucas Moreau", lines: [["kite", "M"]] },
];

/** PayPal's standard US checkout rate, used only for simulated captures. */
export function simulatedFee(totalCents: number): number {
  return Math.round(totalCents * 0.0349) + 49;
}

function at(now: Date, daysAgo: number, [hour, minute]: [number, number]): Date {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  // Never place seeded history in the future (e.g. seeding at 7am).
  const latest = new Date(now.getTime() - 25 * 60_000);
  return date > latest ? latest : date;
}

function addDays(now: Date, days: number): string {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function createSeedData(now: Date): Db {
  const orders: Order[] = [];
  const ledger: LedgerEntry[] = [];
  const activity: ActivityItem[] = [];
  let number = 1001;

  for (const sale of HISTORY) {
    const when = at(now, sale.daysAgo, sale.time).toISOString();
    const lines = sale.lines.map(([productId, size]) => {
      const product = getProduct(productId);
      return { productId, name: product.name, size, quantity: 1, unitCents: product.priceCents };
    });
    const totalCents = lines.reduce((sum, l) => sum + l.unitCents * l.quantity, 0);
    const order: Order = {
      id: newId(),
      number: `MIRA-${number++}`,
      paypalOrderId: simulatedId(),
      captureId: simulatedId(),
      rail: "simulated",
      status: "captured",
      lines,
      totalCents,
      feeCents: simulatedFee(totalCents),
      refundedCents: 0,
      customerName: sale.customer,
      createdAt: when,
      capturedAt: when,
    };
    orders.push(order);
    const summary = lines.map((l) => `${l.name} (${l.size})`).join(", ");
    ledger.push({
      id: newId(),
      at: when,
      kind: "sale",
      amountCents: totalCents,
      feeCents: order.feeCents,
      description: `Sale ${order.number} · ${summary}`,
      counterparty: sale.customer,
      reference: order.captureId!,
      orderNumber: order.number,
      rail: "simulated",
      status: "completed",
      confirmedBy: "api",
      handledBy: "penny",
    });
    activity.push({
      id: newId(),
      at: when,
      kind: "sale",
      actor: "penny",
      title: `Booked sale ${order.number}`,
      detail: `${summary} · ${sale.customer}`,
      amountCents: totalCents,
    });
  }

  // A small goodwill refund Kai handled automatically earlier in the week.
  const refunded = orders[5];
  const refundCents = Math.round(refunded.totalCents * 0.15);
  const refundAt = new Date(new Date(refunded.capturedAt!).getTime() + 26 * 3_600_000).toISOString();
  refunded.refundedCents = refundCents;
  refunded.status = "partially_refunded";
  ledger.push({
    id: newId(),
    at: refundAt,
    kind: "refund",
    amountCents: -refundCents,
    feeCents: 0,
    description: `Refund ${refunded.number} · scratched lens (15% goodwill)`,
    counterparty: refunded.customerName,
    reference: simulatedId(),
    orderNumber: refunded.number,
    rail: "simulated",
    status: "completed",
    confirmedBy: "api",
    handledBy: "kai",
  });
  activity.push({
    id: newId(),
    at: refundAt,
    kind: "refund",
    actor: "kai",
    title: `Refunded ${formatMoney(refundCents)} on ${refunded.number}`,
    detail: "Scratched lens · instant refund under the care policy",
    amountCents: -refundCents,
  });

  // Last month's packaging invoice, already paid by Otto after approval.
  const packaging = SUPPLIERS.find((s) => s.id === "box-and-bow")!;
  const paidAt = at(now, 5, [9, 15]).toISOString();
  const paidBill: SupplierBill = {
    id: newId(),
    supplierId: packaging.id,
    supplierName: packaging.name,
    invoiceNumber: "BB-1121",
    description: "September packaging restock",
    amountCents: 12000,
    dueDate: addDays(now, -4),
    status: "paid",
    payoutBatchId: simulatedId(),
    rail: "simulated",
    paidAt,
  };
  ledger.push({
    id: newId(),
    at: paidAt,
    kind: "payout",
    amountCents: -paidBill.amountCents,
    feeCents: 0,
    description: `Payout · ${paidBill.supplierName} · INV ${paidBill.invoiceNumber}`,
    counterparty: paidBill.supplierName,
    reference: paidBill.payoutBatchId!,
    rail: "simulated",
    status: "completed",
    confirmedBy: "api",
    handledBy: "otto",
  });
  activity.push({
    id: newId(),
    at: paidAt,
    kind: "payout",
    actor: "otto",
    title: `Paid ${paidBill.supplierName}`,
    detail: `INV ${paidBill.invoiceNumber} · approved by Maryam`,
    amountCents: -paidBill.amountCents,
  });

  const supplier = (id: string) => SUPPLIERS.find((s) => s.id === id)!;
  const openBills: SupplierBill[] = [
    {
      id: newId(),
      supplierId: "lens-lab",
      supplierName: supplier("lens-lab").name,
      invoiceNumber: "LL-2291",
      description: "Polarised lens stock, 40 pairs",
      amountCents: 64000,
      dueDate: addDays(now, 2),
      status: "open",
    },
    {
      id: newId(),
      supplierId: "acetate-atelier",
      supplierName: supplier("acetate-atelier").name,
      invoiceNumber: "AA-0817",
      description: "12 hand-polished acetate fronts",
      amountCents: 118000,
      dueDate: addDays(now, 6),
      status: "open",
    },
    {
      id: newId(),
      supplierId: "box-and-bow",
      supplierName: supplier("box-and-bow").name,
      invoiceNumber: "BB-1182",
      description: "Gift boxes and cleaning cloths, 200 sets",
      amountCents: 9500,
      dueDate: addDays(now, 9),
      status: "open",
    },
  ];

  const byNewest = (a: { at: string }, b: { at: string }) => b.at.localeCompare(a.at);
  return {
    version: DB_VERSION,
    nextOrderNumber: number,
    orders: orders.reverse(),
    ledger: ledger.sort(byNewest),
    approvals: [],
    bills: [...openBills, paidBill],
    claims: [],
    activity: activity.sort(byNewest),
    webhookIds: [],
  };
}
