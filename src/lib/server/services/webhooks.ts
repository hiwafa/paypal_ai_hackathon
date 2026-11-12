import "server-only";
import { mutate, readDb } from "../store";
import { recordActivity } from "./activity";
import { refreshPayout } from "./payouts";

// PayPal webhook handling. Signature verification happens in the route; by the
// time an event reaches this file it is known to come from PayPal.

export interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource?: Record<string, unknown> & {
    id?: string;
    payout_batch_id?: string;
    batch_header?: { payout_batch_id?: string };
  };
}

export async function handleWebhookEvent(event: PayPalWebhookEvent): Promise<"processed" | "duplicate" | "ignored"> {
  const fresh = mutate((db) => {
    if (db.webhookIds.includes(event.id)) return false;
    db.webhookIds.push(event.id);
    return true;
  });
  if (!fresh) return "duplicate";

  const resourceId = typeof event.resource?.id === "string" ? event.resource.id : null;

  switch (event.event_type) {
    case "PAYMENT.CAPTURE.COMPLETED":
    case "PAYMENT.CAPTURE.REFUNDED": {
      if (!resourceId) return "ignored";
      const entry = readDb().ledger.find((e) => e.reference === resourceId);
      if (!entry) return "ignored";
      mutate((db) => {
        const target = db.ledger.find((e) => e.id === entry.id);
        if (target) {
          target.confirmedBy = "webhook";
          target.status = "completed";
        }
      });
      recordActivity({
        kind: "confirmation",
        actor: "paypal",
        title:
          event.event_type === "PAYMENT.CAPTURE.COMPLETED"
            ? `Webhook confirmed the capture for ${entry.orderNumber ?? entry.reference}`
            : `Webhook confirmed the refund on ${entry.orderNumber ?? entry.reference}`,
        detail: `${event.event_type} · signature verified`,
        amountCents: entry.amountCents,
      });
      return "processed";
    }

    case "PAYMENT.CAPTURE.DENIED":
    case "PAYMENT.CAPTURE.REVERSED": {
      if (!resourceId) return "ignored";
      const entry = readDb().ledger.find((e) => e.reference === resourceId);
      if (!entry) return "ignored";
      mutate((db) => {
        const target = db.ledger.find((e) => e.id === entry.id);
        if (target) target.status = "failed";
      });
      recordActivity({
        kind: "warning",
        actor: "paypal",
        title: `PayPal reported ${event.event_type.split(".").pop()?.toLowerCase()} on ${entry.orderNumber ?? entry.reference}`,
        detail: "Penny marked the ledger entry as failed",
      });
      return "processed";
    }

    default: {
      if (event.event_type.startsWith("PAYMENT.PAYOUTS")) {
        const batchId =
          event.resource?.batch_header?.payout_batch_id ??
          (typeof event.resource?.payout_batch_id === "string" ? event.resource.payout_batch_id : null);
        if (!batchId) return "ignored";
        await refreshPayout(batchId, "webhook");
        return "processed";
      }
      return "ignored";
    }
  }
}
