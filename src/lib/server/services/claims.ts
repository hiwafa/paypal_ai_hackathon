import "server-only";
import { z } from "zod";
import { claimReply, damageFinding, decideClaim, describeDamage } from "@/lib/domain/policy";
import type { Claim } from "@/lib/domain/types";
import { assessClaim } from "../ai/claims";
import { autoRefundLimitCents } from "../env";
import { HttpError } from "../http";
import { newId } from "../ids";
import { mutate, readDb } from "../store";
import { recordActivity } from "./activity";
import { requestRefundApproval } from "./approvals";
import { executeRefund } from "./refunds";

// ~3.7 MB of image data once decoded. The browser downsizes photos well below this.
const MAX_PHOTO_BASE64 = 5_000_000;
const MAX_THUMB_DATA_URL = 60_000;

export const ClaimSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^MIRA-\d{4,6}$/, "Order numbers look like MIRA-1015"),
  message: z.string().trim().min(3).max(600),
  photo: z.object({
    mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    base64: z
      .string()
      .min(100)
      .max(MAX_PHOTO_BASE64)
      .regex(/^[A-Za-z0-9+/=]+$/, "Photo must be base64"),
  }),
  thumbnail: z
    .string()
    .max(MAX_THUMB_DATA_URL)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
});
export type ClaimInput = z.infer<typeof ClaimSchema>;

export async function fileClaim(input: ClaimInput): Promise<Claim> {
  const order = readDb().orders.find((o) => o.number === input.orderNumber);
  if (!order) throw new HttpError(404, `We couldn't find order ${input.orderNumber}.`);
  if (order.status === "created" || order.status === "failed") {
    throw new HttpError(409, `${order.number} was never paid, so there is nothing to claim.`);
  }

  const productSummary = order.lines.map((l) => `${l.name} (size ${l.size})`).join(", ");
  const { assessment, assessedBy } = await assessClaim({
    orderNumber: order.number,
    productSummary,
    message: input.message,
    photo: input.photo,
  });
  const decision = decideClaim({ assessment, order, autoRefundLimitCents: autoRefundLimitCents() });
  const firstName = order.customerName.split(" ")[0] || "there";
  const sawPhoto = assessedBy === "claude";

  const claim: Claim = {
    id: newId(),
    orderId: order.id,
    orderNumber: order.number,
    customerName: order.customerName,
    message: input.message,
    photoThumb: input.thumbnail,
    assessment,
    decision,
    status:
      decision.action === "auto_refund"
        ? "resolved"
        : decision.action === "owner_approval"
          ? "awaiting_owner"
          : decision.action === "need_better_photo"
            ? "needs_info"
            : "declined",
    reply: claimReply(assessment, decision, firstName, sawPhoto),
    assessedBy,
    createdAt: new Date().toISOString(),
  };
  mutate((db) => {
    db.claims.unshift(claim);
  });

  recordActivity({
    kind: "claim",
    actor: "kai",
    title: `Reviewed a photo claim on ${order.number}`,
    detail: `${assessment.summary} Policy: ${decision.policyRule}`,
  });

  const patch: Partial<Claim> = {};
  if (decision.action === "auto_refund") {
    try {
      const refund = await executeRefund({
        orderId: order.id,
        amountCents: decision.refundCents,
        reason: `care claim, ${describeDamage(assessment.damageType)}`,
        idempotencyKey: claim.id,
        actor: "kai",
      });
      patch.refundId = refund.refundId;
    } catch (error) {
      console.error("[claims] Automatic refund failed", error);
      patch.status = "failed";
      patch.reply = `Thanks, ${firstName}. ${damageFinding(assessment, sawPhoto)}, but the refund didn't go through just now. I've flagged it to Maryam so she can fix it today.`;
      recordActivity({
        kind: "warning",
        actor: "kai",
        title: `Automatic refund on ${order.number} failed`,
        detail: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } else if (decision.action === "owner_approval") {
    const approval = requestRefundApproval({
      order,
      amountCents: decision.refundCents,
      reason: `care claim, ${describeDamage(assessment.damageType)}`,
      requestedBy: "kai",
      claimId: claim.id,
    });
    patch.approvalId = approval.id;
  }

  return mutate((db) => {
    const target = db.claims.find((c) => c.id === claim.id)!;
    Object.assign(target, patch);
    return { ...target };
  });
}
