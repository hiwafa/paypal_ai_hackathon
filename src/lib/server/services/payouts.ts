import "server-only";
import { SUPPLIERS } from "@/lib/domain/catalog";
import { formatMoney } from "@/lib/domain/money";
import type { Approval } from "@/lib/domain/types";
import { getPayPalConfig } from "../env";
import { HttpError } from "../http";
import { newId } from "../ids";
import { defaultRail, gatewayFor } from "../paypal/gateway";
import { mutate, readDb } from "../store";
import { recordActivity } from "./activity";

// Statuses PayPal uses for a payout item that will never arrive.
const FAILED_ITEM = new Set(["FAILED", "RETURNED", "BLOCKED", "DENIED", "REFUNDED", "REVERSED"]);
const FAILED_BATCH = new Set(["DENIED", "CANCELED"]);

/** Sends an approved supplier payout through PayPal Payouts. */
export async function sendSupplierPayout(approval: Approval): Promise<string> {
  const bill = readDb().bills.find((b) => b.id === approval.billId);
  if (!bill) throw new HttpError(404, "The bill for this payout no longer exists.");
  if (bill.status === "paid" || bill.status === "processing") {
    throw new HttpError(409, `${bill.supplierName} INV ${bill.invoiceNumber} is already ${bill.status}.`);
  }

  const supplier = SUPPLIERS.find((s) => s.id === bill.supplierId);
  const rail = defaultRail();
  // Sandbox payouts only reach sandbox accounts, so they go to the configured receiver.
  const receiver =
    (rail === "paypal" ? getPayPalConfig()?.payoutReceiver : null) ?? supplier?.email ?? "supplier@example.com";

  const result = await gatewayFor(rail).createPayout({
    senderBatchId: `MIRA-PO-${approval.id}`,
    senderItemId: bill.id,
    receiver,
    amountCents: bill.amountCents,
    note: `Mira Eyewear payment for INV ${bill.invoiceNumber}: ${bill.description}`,
  });

  const now = new Date().toISOString();
  mutate((db) => {
    const target = db.bills.find((b) => b.id === bill.id)!;
    target.status = "processing";
    target.payoutBatchId = result.batchId;
    target.rail = rail;
    db.ledger.unshift({
      id: newId(),
      at: now,
      kind: "payout",
      amountCents: -bill.amountCents,
      feeCents: 0,
      description: `Payout · ${bill.supplierName} · INV ${bill.invoiceNumber}`,
      counterparty: bill.supplierName,
      reference: result.batchId,
      rail,
      status: "pending",
      confirmedBy: "api",
      handledBy: "otto",
    });
  });

  recordActivity({
    kind: "payout",
    actor: "otto",
    title: `Sent ${formatMoney(bill.amountCents)} to ${bill.supplierName}`,
    detail: `PayPal Payouts batch ${result.batchId} · ${result.batchStatus.toLowerCase()}`,
    amountCents: -bill.amountCents,
  });

  schedulePayoutChecks(result.batchId);
  return result.batchId;
}

/** Polls a few times in case webhooks aren't configured (e.g. running locally). */
function schedulePayoutChecks(batchId: string) {
  for (const delay of [5_000, 15_000, 45_000, 120_000]) {
    setTimeout(() => {
      refreshPayout(batchId, "api").catch((error) => console.error("[payouts] Status check failed", error));
    }, delay).unref?.();
  }
}

/** Pulls the latest status of a payout batch and settles the bill and ledger. */
export async function refreshPayout(batchId: string, via: "api" | "webhook"): Promise<void> {
  const bill = readDb().bills.find((b) => b.payoutBatchId === batchId);
  if (!bill || !bill.rail || bill.status === "paid" || bill.status === "failed") return;

  const status = await gatewayFor(bill.rail).getPayout(batchId);
  const itemStatus = status.itemStatus ?? "";

  if (status.batchStatus === "SUCCESS" && itemStatus === "SUCCESS") {
    const settled = mutate((db) => {
      const target = db.bills.find((b) => b.id === bill.id);
      if (!target || target.status === "paid") return false;
      target.status = "paid";
      target.paidAt = new Date().toISOString();
      const entry = db.ledger.find((e) => e.reference === batchId);
      if (entry) {
        entry.status = "completed";
        entry.confirmedBy = via;
      }
      return true;
    });
    if (settled) {
      recordActivity({
        kind: "confirmation",
        actor: via === "webhook" ? "paypal" : "penny",
        title: `PayPal confirmed the payout to ${bill.supplierName}`,
        detail:
          via === "webhook"
            ? "Verified webhook · ledger reconciled"
            : "Status checked via Payouts API · ledger reconciled",
        amountCents: -bill.amountCents,
      });
    }
    return;
  }

  if (FAILED_ITEM.has(itemStatus) || FAILED_BATCH.has(status.batchStatus)) {
    mutate((db) => {
      const target = db.bills.find((b) => b.id === bill.id);
      if (target) target.status = "failed";
      const entry = db.ledger.find((e) => e.reference === batchId);
      if (entry) entry.status = "failed";
    });
    recordActivity({
      kind: "warning",
      actor: "otto",
      title: `Payout to ${bill.supplierName} did not go through`,
      detail: `PayPal status: ${itemStatus || status.batchStatus}`,
    });
    return;
  }

  if (itemStatus === "UNCLAIMED") {
    const firstTime = mutate((db) => {
      const entry = db.ledger.find((e) => e.reference === batchId);
      if (!entry || entry.description.endsWith("(unclaimed)")) return false;
      entry.description = `${entry.description} (unclaimed)`;
      return true;
    });
    if (firstTime) {
      recordActivity({
        kind: "warning",
        actor: "otto",
        title: `${bill.supplierName} hasn't claimed the payout yet`,
        detail: "In the sandbox, set PAYPAL_PAYOUT_RECEIVER to a sandbox personal account.",
      });
    }
  }
}
