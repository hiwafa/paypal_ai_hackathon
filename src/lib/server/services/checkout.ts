import "server-only";
import { z } from "zod";
import { getProduct } from "@/lib/domain/catalog";
import type { CheckoutSummary, CreatedOrder } from "@/lib/domain/api";
import { FRAME_SIZES, PRODUCT_IDS, type Order, type OrderLine } from "@/lib/domain/types";
import { HttpError } from "../http";
import { newId } from "../ids";
import { defaultRail, gatewayFor } from "../paypal/gateway";
import { mutate, readDb } from "../store";
import { recordActivity } from "./activity";

export const CartSchema = z.object({
  lines: z
    .array(
      z.object({
        productId: z.enum(PRODUCT_IDS),
        size: z.enum(FRAME_SIZES),
        quantity: z.number().int().min(1).max(3),
      }),
    )
    .min(1)
    .max(6),
  fitNote: z.string().trim().max(120).optional(),
});
export type CartInput = z.infer<typeof CartSchema>;

function summarize(order: Order): CheckoutSummary {
  return {
    number: order.number,
    status: order.status,
    totalCents: order.totalCents,
    payerName: order.customerName,
    captureId: order.captureId ?? null,
    shipTo: order.shipTo ?? null,
    rail: order.rail,
    lines: order.lines,
  };
}

function describeLines(lines: OrderLine[]): string {
  return lines.map((l) => `${l.name} (${l.size})${l.quantity > 1 ? ` ×${l.quantity}` : ""}`).join(", ");
}

/** Prices always come from the catalog; the browser only says what and how many. */
export async function createCheckout(input: CartInput): Promise<CreatedOrder> {
  const merged = new Map<string, OrderLine>();
  for (const line of input.lines) {
    const key = `${line.productId}:${line.size}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity = Math.min(3, existing.quantity + line.quantity);
    } else {
      const product = getProduct(line.productId);
      merged.set(key, {
        productId: product.id,
        name: product.name,
        size: line.size,
        quantity: line.quantity,
        unitCents: product.priceCents,
      });
    }
  }
  const lines = [...merged.values()];
  const totalCents = lines.reduce((sum, l) => sum + l.unitCents * l.quantity, 0);
  const rail = defaultRail();
  const internalId = newId();

  const number = mutate((db) => {
    // Drop abandoned checkouts older than a day so they don't pile up.
    const cutoff = Date.now() - 86_400_000;
    db.orders = db.orders.filter((o) => o.status !== "created" || Date.parse(o.createdAt) > cutoff);
    return `MIRA-${db.nextOrderNumber++}`;
  });

  const paypalOrderId = await gatewayFor(rail).createOrder({
    internalId,
    number,
    lines,
    totalCents,
    fitNote: input.fitNote,
  });

  const order: Order = {
    id: internalId,
    number,
    paypalOrderId,
    rail,
    status: "created",
    lines,
    totalCents,
    feeCents: 0,
    refundedCents: 0,
    customerName: "Pending payer",
    fitNote: input.fitNote,
    createdAt: new Date().toISOString(),
  };
  mutate((db) => {
    db.orders.unshift(order);
  });

  return { paypalOrderId, number, totalCents, rail };
}

// One capture per order at a time, even if the buyer double-clicks.
const globalCaptures = globalThis as typeof globalThis & {
  __crewosCaptures?: Map<string, Promise<CheckoutSummary>>;
};

export function captureCheckout(paypalOrderId: string): Promise<CheckoutSummary> {
  globalCaptures.__crewosCaptures ??= new Map();
  const inflight = globalCaptures.__crewosCaptures.get(paypalOrderId);
  if (inflight) return inflight;

  const work = doCapture(paypalOrderId).finally(() => {
    globalCaptures.__crewosCaptures?.delete(paypalOrderId);
  });
  globalCaptures.__crewosCaptures.set(paypalOrderId, work);
  return work;
}

async function doCapture(paypalOrderId: string): Promise<CheckoutSummary> {
  const order = readDb().orders.find((o) => o.paypalOrderId === paypalOrderId);
  if (!order) throw new HttpError(404, "We couldn't find that order.");
  if (order.status !== "created") return summarize(order);

  const result = await gatewayFor(order.rail).captureOrder(paypalOrderId, order.totalCents);
  const captured =
    result.orderStatus === "COMPLETED" &&
    result.captureId &&
    (result.captureStatus === "COMPLETED" || result.captureStatus === "PENDING");

  if (!captured) {
    mutate((db) => {
      const target = db.orders.find((o) => o.id === order.id);
      if (target) target.status = "failed";
    });
    throw new HttpError(
      422,
      `The payment was not completed (PayPal status: ${result.captureStatus ?? result.orderStatus}).`,
    );
  }

  if (result.amountCents !== order.totalCents) {
    // PayPal is the source of truth for money; we book what was captured.
    console.warn(`[checkout] ${order.number}: captured ${result.amountCents} but expected ${order.totalCents}`);
  }

  const now = new Date().toISOString();
  const summary = describeLines(order.lines);
  const updated = mutate((db) => {
    const target = db.orders.find((o) => o.id === order.id)!;
    target.status = "captured";
    target.captureId = result.captureId!;
    target.feeCents = result.feeCents;
    target.customerName = result.payerName;
    target.customerEmail = result.payerEmail;
    target.shipTo = result.shipTo;
    target.capturedAt = now;
    db.ledger.unshift({
      id: newId(),
      at: now,
      kind: "sale",
      amountCents: result.amountCents,
      feeCents: result.feeCents,
      description: `Sale ${target.number} · ${summary}`,
      counterparty: result.payerName,
      reference: result.captureId!,
      orderNumber: target.number,
      rail: target.rail,
      status: result.captureStatus === "COMPLETED" ? "completed" : "pending",
      confirmedBy: "api",
      handledBy: "penny",
    });
    return { ...target };
  });

  recordActivity({
    kind: "sale",
    actor: "penny",
    title: `Booked sale ${updated.number}`,
    detail: `${summary} · paid with PayPal by ${result.payerName}`,
    amountCents: result.amountCents,
  });

  return summarize(updated);
}
