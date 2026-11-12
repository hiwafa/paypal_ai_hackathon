import type { OrderLine, PaymentRail } from "@/lib/domain/types";

// The contract both the real sandbox client and the simulator implement.

export interface CreateOrderInput {
  internalId: string;
  number: string;
  lines: OrderLine[];
  totalCents: number;
  /** Fit advice drafted by the stylist; travels with the PayPal line items. */
  fitNote?: string;
}

export interface CaptureResult {
  orderStatus: string;
  captureId: string | null;
  captureStatus: string | null;
  amountCents: number;
  feeCents: number;
  payerName: string;
  payerEmail?: string;
  shipTo?: string;
}

export interface RefundInput {
  captureId: string;
  amountCents: number;
  noteToPayer: string;
  requestId: string;
}

export interface RefundResult {
  refundId: string;
  status: string;
}

export interface PayoutInput {
  senderBatchId: string;
  senderItemId: string;
  receiver: string;
  amountCents: number;
  note: string;
}

export interface PayoutResult {
  batchId: string;
  batchStatus: string;
}

export interface PayoutStatus {
  batchStatus: string;
  itemStatus: string | null;
}

export interface PaymentGateway {
  readonly rail: PaymentRail;
  createOrder(input: CreateOrderInput): Promise<string>;
  captureOrder(paypalOrderId: string, expectedCents: number): Promise<CaptureResult>;
  refund(input: RefundInput): Promise<RefundResult>;
  createPayout(input: PayoutInput): Promise<PayoutResult>;
  getPayout(batchId: string): Promise<PayoutStatus>;
}
