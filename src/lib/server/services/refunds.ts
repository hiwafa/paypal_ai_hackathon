import "server-only";
import { formatMoney } from "@/lib/domain/money";
import type { RobotId } from "@/lib/domain/types";
import { HttpError } from "../http";
import { newId } from "../ids";
import { gatewayFor } from "../paypal/gateway";
import { mutate } from "../store";
import { recordActivity } from "./activity";

export interface RefundRequest {
  orderId: string;
  amountCents: number;
  reason: string;
  /** Stable key (claim or approval id) so a retried refund is never paid twice. */
  idempotencyKey: string;
  actor: RobotId;
  approvedByOwner?: boolean;
}

export async function executeRefund(request: RefundRequest): Promise<{ refundId: string; status: string }> {
  const { orderId, amountCents, reason, idempotencyKey, actor } = request;
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new HttpError(400, "Refund amount must be a positive number of cents.");
  }

  // Reserve the amount first so two refunds can't race past the order total.
  const order = mutate((db) => {
    const target = db.orders.find((o) => o.id === orderId);
    if (!target || !target.captureId) throw new HttpError(404, "That order has no captured payment to refund.");
    const remaining = target.totalCents - target.refundedCents;
    if (amountCents > remaining) {
      throw new HttpError(409, `Only ${formatMoney(remaining)} is left to refund on ${target.number}.`);
    }
    target.refundedCents += amountCents;
    return { ...target };
  });

  let result: { refundId: string; status: string };
  try {
    result = await gatewayFor(order.rail).refund({
      captureId: order.captureId!,
      amountCents,
      noteToPayer: `Mira Eyewear: ${reason}`,
      requestId: `mira-refund-${idempotencyKey}`,
    });
  } catch (error) {
    mutate((db) => {
      const target = db.orders.find((o) => o.id === orderId);
      if (target) target.refundedCents -= amountCents;
    });
    throw error;
  }

  const now = new Date().toISOString();
  mutate((db) => {
    const target = db.orders.find((o) => o.id === orderId)!;
    target.status = target.refundedCents >= target.totalCents ? "refunded" : "partially_refunded";
    db.ledger.unshift({
      id: newId(),
      at: now,
      kind: "refund",
      amountCents: -amountCents,
      feeCents: 0,
      description: `Refund ${target.number} · ${reason}`,
      counterparty: target.customerName,
      reference: result.refundId,
      orderNumber: target.number,
      rail: target.rail,
      status: result.status === "COMPLETED" ? "completed" : "pending",
      confirmedBy: "api",
      handledBy: actor,
    });
  });

  recordActivity({
    kind: "refund",
    actor,
    title: `Refunded ${formatMoney(amountCents)} on ${order.number}`,
    detail: request.approvedByOwner
      ? `${reason} · approved by Maryam`
      : `${reason} · instant refund under the care policy`,
    amountCents: -amountCents,
  });

  return result;
}
