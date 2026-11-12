import { formatMoney, percentOf } from "./money";
import type { ClaimAssessment, ClaimDecision, DamageType, Order } from "./types";

// The care policy is deliberately plain code, not AI. The model describes what
// it sees in the photo; these rules decide what happens to the money.

export const CARE_POLICY = {
  windowDays: 30,
  minConfidence: 0.6,
  /** Goodwill refund for cosmetic issues the customer can live with. */
  minorRefundRate: 0.15,
  /** Refunds at or below this amount are paid instantly, without the owner. */
  defaultAutoRefundLimitCents: 2500,
};

const MINOR_DAMAGE: ReadonlySet<DamageType> = new Set(["scratched_lens", "loose_screw"]);
const STRUCTURAL_DAMAGE: ReadonlySet<DamageType> = new Set(["broken_hinge", "cracked_frame", "bent_temple"]);

export interface ClaimPolicyInput {
  assessment: ClaimAssessment;
  order: Pick<Order, "totalCents" | "refundedCents" | "capturedAt" | "createdAt">;
  autoRefundLimitCents: number;
  now?: Date;
}

export function decideClaim({
  assessment,
  order,
  autoRefundLimitCents,
  now = new Date(),
}: ClaimPolicyInput): ClaimDecision {
  const purchasedAt = new Date(order.capturedAt ?? order.createdAt);
  const ageDays = (now.getTime() - purchasedAt.getTime()) / 86_400_000;
  if (ageDays > CARE_POLICY.windowDays) {
    return {
      action: "decline",
      refundCents: 0,
      policyRule: `Outside the ${CARE_POLICY.windowDays}-day care window.`,
    };
  }

  const remaining = order.totalCents - order.refundedCents;
  if (remaining <= 0) {
    return { action: "decline", refundCents: 0, policyRule: "This order is already fully refunded." };
  }

  const unclear =
    !assessment.damageVisible ||
    assessment.damageType === "none" ||
    assessment.damageType === "unclear" ||
    assessment.confidence < CARE_POLICY.minConfidence;
  if (unclear) {
    return {
      action: "need_better_photo",
      refundCents: 0,
      policyRule: "Damage must be clearly visible before any refund.",
    };
  }

  const structural = STRUCTURAL_DAMAGE.has(assessment.damageType) || assessment.severity === "severe";

  if (!structural && (MINOR_DAMAGE.has(assessment.damageType) || assessment.severity === "minor")) {
    const refund = Math.min(remaining, percentOf(order.totalCents, CARE_POLICY.minorRefundRate));
    const automatic = refund <= autoRefundLimitCents;
    return {
      action: automatic ? "auto_refund" : "owner_approval",
      refundCents: refund,
      policyRule: automatic
        ? `Cosmetic damage: ${Math.round(CARE_POLICY.minorRefundRate * 100)}% goodwill refund, under the ${formatMoney(autoRefundLimitCents)} instant-refund limit.`
        : `Cosmetic damage: ${Math.round(CARE_POLICY.minorRefundRate * 100)}% goodwill refund, above the instant limit, so the owner decides.`,
    };
  }

  return {
    action: remaining <= autoRefundLimitCents ? "auto_refund" : "owner_approval",
    refundCents: remaining,
    policyRule:
      remaining <= autoRefundLimitCents
        ? "Structural defect within 30 days: full refund, under the instant limit."
        : "Structural defect within 30 days: full refund once the owner approves.",
  };
}

const DAMAGE_LABEL: Record<DamageType, string> = {
  scratched_lens: "a scratched lens",
  loose_screw: "a loose screw",
  bent_temple: "a bent temple arm",
  broken_hinge: "a broken hinge",
  cracked_frame: "a cracked frame",
  none: "no visible damage",
  unclear: "nothing I can judge clearly",
};

export function describeDamage(type: DamageType): string {
  return DAMAGE_LABEL[type];
}

/** What Kai says it found. Without vision (no API key) Kai only read the note, and says so. */
export function damageFinding(assessment: ClaimAssessment, sawPhoto: boolean): string {
  const damage = describeDamage(assessment.damageType);
  return sawPhoto ? `I can see ${damage}` : `From your note, it sounds like ${damage}`;
}

/** What Kai says to the customer once the policy has decided. */
export function claimReply(
  assessment: ClaimAssessment,
  decision: ClaimDecision,
  customerFirstName: string,
  sawPhoto: boolean,
): string {
  const finding = damageFinding(assessment, sawPhoto);
  switch (decision.action) {
    case "auto_refund":
      return `Thanks, ${customerFirstName}. ${finding}. Under our care policy that's a ${formatMoney(decision.refundCents)} refund, and I've just sent it back to your PayPal account.`;
    case "owner_approval":
      return `Thanks, ${customerFirstName}. ${finding}. I've recommended a ${formatMoney(decision.refundCents)} refund and asked Maryam to approve it. You'll hear from us shortly.`;
    case "need_better_photo":
      return `Sorry, ${customerFirstName}, I can't see the problem clearly in this photo. Could you try again in good light, close to the damaged part?`;
    case "decline":
      return `I've checked your order, ${customerFirstName}. ${decision.policyRule} I've passed your note to Maryam in case she can help further.`;
  }
}
