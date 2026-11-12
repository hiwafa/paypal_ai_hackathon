import type {
  ActivityItem,
  Approval,
  Claim,
  LedgerEntry,
  OrderLine,
  OrderStatus,
  PaymentRail,
  SupplierBill,
} from "./types";

// Response shapes shared by route handlers and the browser.

export interface RuntimeConfig {
  paypal: { mode: "sandbox" | "simulated"; clientId: string | null; webhooks: boolean };
  ai: { mode: "claude" | "offline"; model: string | null };
  policy: { autoRefundLimitCents: number };
}

export interface CreatedOrder {
  paypalOrderId: string;
  number: string;
  totalCents: number;
  rail: PaymentRail;
}

export interface CheckoutSummary {
  number: string;
  status: OrderStatus;
  totalCents: number;
  payerName: string;
  captureId: string | null;
  /** The shipping address PayPal returned, as one line. */
  shipTo: string | null;
  rail: PaymentRail;
  lines: OrderLine[];
}

export interface OfficeState {
  ledger: LedgerEntry[];
  approvals: Approval[];
  bills: SupplierBill[];
  activity: ActivityItem[];
  claims: Claim[];
  config: RuntimeConfig;
}
