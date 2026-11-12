import "server-only";
import { formatMoney } from "@/lib/domain/money";
import type { Approval, Order, RobotId } from "@/lib/domain/types";
import { HttpError } from "../http";
import { newId } from "../ids";
import { mutate, readDb } from "../store";
import { recordActivity } from "./activity";
import { sendSupplierPayout } from "./payouts";
import { executeRefund } from "./refunds";
import { shortDate } from "@/lib/domain/words";

// Human-in-the-loop: robots can only request money movements. Nothing here
// pays anyone until the owner decides, except refunds the care policy already
// pre-authorises (those never come through this file).

export function requestSupplierPayout(billId: string, reason: string): Approval {
  const outcome = mutate((db) => {
    const bill = db.bills.find((b) => b.id === billId);
    if (!bill) throw new HttpError(404, `No bill with id ${billId}.`);
    const existing = db.approvals.find((a) => a.billId === billId && a.status === "pending");
    if (existing) return { approval: existing, supplier: bill.supplierName, created: false };
    if (bill.status !== "open" && bill.status !== "failed") {
      throw new HttpError(
        409,
        `INV ${bill.invoiceNumber} is ${bill.status.replace("_", " ")}, so there is nothing to pay.`,
      );
    }
    const approval: Approval = {
      id: newId(),
      kind: "supplier_payout",
      status: "pending",
      title: `Pay ${bill.supplierName} · INV ${bill.invoiceNumber}`,
      reason: reason.trim() || `${bill.description}, due ${shortDate(bill.dueDate)}.`,
      amountCents: bill.amountCents,
      requestedBy: "otto",
      billId: bill.id,
      createdAt: new Date().toISOString(),
    };
    bill.status = "awaiting_approval";
    db.approvals.unshift(approval);
    return { approval, supplier: bill.supplierName, created: true };
  });

  if (outcome.created) {
    recordActivity({
      kind: "approval",
      actor: "otto",
      title: `Prepared a ${formatMoney(outcome.approval.amountCents)} payout to ${outcome.supplier}`,
      detail: "Waiting for Maryam's approval",
      amountCents: -outcome.approval.amountCents,
    });
  }
  return outcome.approval;
}

export function requestRefundApproval(input: {
  order: Pick<Order, "id" | "number" | "totalCents" | "refundedCents">;
  amountCents: number;
  reason: string;
  requestedBy: RobotId;
  claimId?: string;
}): Approval {
  const { order, amountCents, reason, requestedBy, claimId } = input;
  const remaining = order.totalCents - order.refundedCents;
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > remaining) {
    throw new HttpError(400, `Refund must be between $0.01 and ${formatMoney(remaining)} for ${order.number}.`);
  }
  const approval: Approval = {
    id: newId(),
    kind: "refund",
    status: "pending",
    title: `Refund ${formatMoney(amountCents)} on ${order.number}`,
    reason,
    amountCents,
    requestedBy,
    orderId: order.id,
    claimId,
    createdAt: new Date().toISOString(),
  };
  mutate((db) => {
    db.approvals.unshift(approval);
  });
  recordActivity({
    kind: "approval",
    actor: requestedBy,
    title: `Asked Maryam to approve a ${formatMoney(amountCents)} refund`,
    detail: `${order.number} · ${reason}`,
    amountCents: -amountCents,
  });
  return approval;
}

const globalLocks = globalThis as typeof globalThis & { __crewosApprovalLocks?: Set<string> };

export async function decideApproval(
  id: string,
  decision: "approve" | "reject",
  via: "click" | "voice",
): Promise<Approval> {
  globalLocks.__crewosApprovalLocks ??= new Set();
  const locks = globalLocks.__crewosApprovalLocks;
  if (locks.has(id)) throw new HttpError(409, "This approval is already being processed.");
  locks.add(id);
  try {
    return await decide(id, decision, via);
  } finally {
    locks.delete(id);
  }
}

async function decide(id: string, decision: "approve" | "reject", via: "click" | "voice"): Promise<Approval> {
  const approval = readDb().approvals.find((a) => a.id === id);
  if (!approval) throw new HttpError(404, "That approval no longer exists.");
  if (approval.status !== "pending") throw new HttpError(409, `This request was already ${approval.status}.`);

  const update = (patch: Partial<Approval>) =>
    mutate((db) => {
      const target = db.approvals.find((a) => a.id === id)!;
      Object.assign(target, patch);
      return { ...target };
    });

  const decidedAt = new Date().toISOString();
  const how = via === "voice" ? "by voice" : "in the back office";

  if (decision === "reject") {
    mutate((db) => {
      const bill = approval.billId ? db.bills.find((b) => b.id === approval.billId) : undefined;
      if (bill && bill.status === "awaiting_approval") bill.status = "open";
      const claim = approval.claimId ? db.claims.find((c) => c.id === approval.claimId) : undefined;
      if (claim && claim.status === "awaiting_owner") claim.status = "declined";
    });
    recordActivity({
      kind: "approval",
      actor: "owner",
      title: `Declined: ${approval.title}`,
      detail: `Decided ${how}`,
    });
    return update({ status: "rejected", decidedAt, decidedVia: via });
  }

  recordActivity({
    kind: "approval",
    actor: "owner",
    title: `Approved: ${approval.title}`,
    detail: `Decided ${how}`,
    amountCents: -approval.amountCents,
  });

  try {
    let resultRef: string;
    if (approval.kind === "supplier_payout") {
      resultRef = await sendSupplierPayout(approval);
    } else {
      const refund = await executeRefund({
        orderId: approval.orderId!,
        amountCents: approval.amountCents,
        reason: approval.reason,
        idempotencyKey: approval.id,
        actor: "kai",
        approvedByOwner: true,
      });
      resultRef = refund.refundId;
      mutate((db) => {
        const claim = approval.claimId ? db.claims.find((c) => c.id === approval.claimId) : undefined;
        if (claim) {
          claim.status = "resolved";
          claim.refundId = refund.refundId;
        }
      });
    }
    return update({ status: "executed", decidedAt, decidedVia: via, resultRef });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    mutate((db) => {
      const bill = approval.billId ? db.bills.find((b) => b.id === approval.billId) : undefined;
      if (bill && bill.status === "awaiting_approval") bill.status = "failed";
    });
    recordActivity({
      kind: "warning",
      actor: approval.requestedBy,
      title: `Couldn't complete: ${approval.title}`,
      detail: message,
    });
    return update({ status: "failed", decidedAt, decidedVia: via, error: message });
  }
}
