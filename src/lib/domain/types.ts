// Shared domain types. Everything here is plain data so it can travel between
// the server, the browser and the JSON store without translation.

export const PRODUCT_IDS = [
  "solstice",
  "harbor",
  "vega",
  "atlas",
  "juniper",
  "kite",
  "mesa",
  "ridge",
  "pebble",
] as const;
export type ProductId = (typeof PRODUCT_IDS)[number];

export const FACE_SHAPES = ["oval", "round", "square", "heart", "oblong"] as const;
export type FaceShape = (typeof FACE_SHAPES)[number];

export const FRAME_SIZES = ["S", "M", "L"] as const;
export type FrameSize = (typeof FRAME_SIZES)[number];

export type FrameKind = "sun" | "optical";
export type FrameStyle =
  "aviator" | "round" | "cat-eye" | "rectangle" | "round-metal" | "hexagon" | "oversized" | "browline" | "soft-square";

/** Everything the 3D renderer needs to draw a frame procedurally. */
export interface FrameLook {
  material: "acetate" | "metal";
  /** Surface of acetate frames; metal is always polished. */
  finish?: "gloss" | "matte" | "crystal";
  frameColor: string;
  accentColor?: string;
  lensTint: string;
  lensOpacity: number;
  pattern?: "tortoise";
  /** Relative width on the face; 1 means "spans the temples". */
  fitScale: number;
}

export interface Product {
  id: ProductId;
  name: string;
  tagline: string;
  description: string;
  kind: FrameKind;
  style: FrameStyle;
  priceCents: number;
  suits: FaceShape[];
  look: FrameLook;
}

export type RobotId = "lumi" | "penny" | "otto" | "kai";
export type Actor = RobotId | "owner" | "paypal" | "customer";

/** Which payment rail processed a record: the real PayPal sandbox or the local simulator. */
export type PaymentRail = "paypal" | "simulated";

export interface OrderLine {
  productId: ProductId;
  name: string;
  size: FrameSize;
  quantity: number;
  unitCents: number;
}

export type OrderStatus = "created" | "captured" | "partially_refunded" | "refunded" | "failed";

export interface Order {
  id: string;
  number: string;
  paypalOrderId: string;
  captureId?: string;
  rail: PaymentRail;
  status: OrderStatus;
  lines: OrderLine[];
  totalCents: number;
  feeCents: number;
  refundedCents: number;
  customerName: string;
  customerEmail?: string;
  shipTo?: string;
  fitNote?: string;
  createdAt: string;
  capturedAt?: string;
}

export type LedgerKind = "sale" | "refund" | "payout";
export type Confirmation = "pending" | "api" | "webhook";

export interface LedgerEntry {
  id: string;
  at: string;
  kind: LedgerKind;
  /** Signed: money in is positive, money out is negative. */
  amountCents: number;
  feeCents: number;
  description: string;
  counterparty: string;
  reference: string;
  orderNumber?: string;
  rail: PaymentRail;
  status: "completed" | "pending" | "failed";
  confirmedBy: Confirmation;
  handledBy: RobotId;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  email: string;
}

export type BillStatus = "open" | "awaiting_approval" | "processing" | "paid" | "failed";

export interface SupplierBill {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  description: string;
  amountCents: number;
  dueDate: string;
  status: BillStatus;
  payoutBatchId?: string;
  rail?: PaymentRail;
  paidAt?: string;
}

export type ApprovalKind = "supplier_payout" | "refund";
export type ApprovalStatus = "pending" | "rejected" | "executed" | "failed";

export interface Approval {
  id: string;
  kind: ApprovalKind;
  status: ApprovalStatus;
  title: string;
  reason: string;
  amountCents: number;
  requestedBy: RobotId;
  billId?: string;
  orderId?: string;
  claimId?: string;
  createdAt: string;
  decidedAt?: string;
  decidedVia?: "click" | "voice";
  resultRef?: string;
  error?: string;
}

export const DAMAGE_TYPES = [
  "scratched_lens",
  "loose_screw",
  "bent_temple",
  "broken_hinge",
  "cracked_frame",
  "none",
  "unclear",
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const SEVERITIES = ["none", "minor", "moderate", "severe"] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface ClaimAssessment {
  damageVisible: boolean;
  damageType: DamageType;
  severity: Severity;
  /** 0..1: how sure the assessor is about what it sees. */
  confidence: number;
  summary: string;
}

export type ClaimAction = "auto_refund" | "owner_approval" | "need_better_photo" | "decline";

export interface ClaimDecision {
  action: ClaimAction;
  refundCents: number;
  policyRule: string;
}

export type ClaimStatus = "resolved" | "awaiting_owner" | "needs_info" | "declined" | "failed";

export interface Claim {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  message: string;
  photoThumb?: string;
  assessment: ClaimAssessment;
  decision: ClaimDecision;
  status: ClaimStatus;
  reply: string;
  refundId?: string;
  approvalId?: string;
  assessedBy: "claude" | "offline";
  createdAt: string;
}

export type ActivityKind =
  "sale" | "refund" | "payout" | "approval" | "claim" | "confirmation" | "briefing" | "info" | "warning";

/** One line in the office feed. The same object is pushed live over SSE. */
export interface ActivityItem {
  id: string;
  at: string;
  kind: ActivityKind;
  actor: Actor;
  title: string;
  detail?: string;
  amountCents?: number;
}

export interface FaceProfile {
  shape: FaceShape;
  /** Estimated face width in millimetres (cheekbone to cheekbone). */
  widthMm: number | null;
  recommendedSize: FrameSize;
  confidence: number;
  source: "camera" | "manual";
}

export interface CartLine {
  productId: ProductId;
  size: FrameSize;
  quantity: number;
}
