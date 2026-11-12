import "server-only";
import { getProduct } from "@/lib/domain/catalog";
import { CURRENCY, fromPayPalValue, toPayPalValue } from "@/lib/domain/money";
import { paypalRequest } from "./client";
import type {
  CaptureResult,
  CreateOrderInput,
  PaymentGateway,
  PayoutInput,
  PayoutResult,
  PayoutStatus,
  RefundInput,
  RefundResult,
} from "./types";

// Real PayPal REST calls: Orders v2, Payments v2 (refunds) and Payouts v1.

interface Money {
  value?: string;
  currency_code?: string;
}

interface OrderResponse {
  id: string;
  status: string;
  payer?: {
    name?: { given_name?: string; surname?: string };
    email_address?: string;
  };
  purchase_units?: Array<{
    shipping?: {
      address?: {
        address_line_1?: string;
        admin_area_2?: string;
        admin_area_1?: string;
        country_code?: string;
      };
    };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount?: Money;
        seller_receivable_breakdown?: { paypal_fee?: Money };
      }>;
    };
  }>;
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

async function createOrder(input: CreateOrderInput): Promise<string> {
  const amount = (cents: number) => ({ currency_code: CURRENCY, value: toPayPalValue(cents) });
  const order = await paypalRequest<OrderResponse>({
    method: "POST",
    path: "/v2/checkout/orders",
    requestId: `mira-create-${input.internalId}`,
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.number,
          custom_id: input.internalId,
          // Invoice IDs must be unique per merchant, even across demo resets.
          invoice_id: `${input.number}-${input.internalId.slice(0, 8)}`,
          description: `Mira Eyewear order ${input.number}`,
          soft_descriptor: "MIRA EYEWEAR",
          amount: {
            ...amount(input.totalCents),
            breakdown: { item_total: amount(input.totalCents) },
          },
          items: input.lines.map((line) => {
            const product = getProduct(line.productId);
            return {
              name: clip(`${product.name} · size ${line.size}`, 127),
              description: clip(input.fitNote ? `${product.tagline}. ${input.fitNote}` : product.tagline, 127),
              sku: `${line.productId}-${line.size}`.toUpperCase(),
              unit_amount: amount(line.unitCents),
              quantity: String(line.quantity),
              category: "PHYSICAL_GOODS",
            };
          }),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Mira Eyewear",
            shipping_preference: "GET_FROM_FILE",
            user_action: "PAY_NOW",
            locale: "en-US",
          },
        },
      },
    },
  });
  return order.id;
}

async function captureOrder(paypalOrderId: string): Promise<CaptureResult> {
  const order = await paypalRequest<OrderResponse>({
    method: "POST",
    path: `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
    requestId: `mira-capture-${paypalOrderId}`,
    body: {},
  });
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const address = unit?.shipping?.address;
  const payerName = [order.payer?.name?.given_name, order.payer?.name?.surname].filter(Boolean).join(" ");
  return {
    orderStatus: order.status,
    captureId: capture?.id ?? null,
    captureStatus: capture?.status ?? null,
    amountCents: fromPayPalValue(capture?.amount?.value),
    feeCents: fromPayPalValue(capture?.seller_receivable_breakdown?.paypal_fee?.value),
    payerName: payerName || "PayPal buyer",
    payerEmail: order.payer?.email_address,
    shipTo: address
      ? [address.address_line_1, address.admin_area_2, address.admin_area_1, address.country_code]
          .filter(Boolean)
          .join(", ")
      : undefined,
  };
}

async function refund(input: RefundInput): Promise<RefundResult> {
  const result = await paypalRequest<{ id: string; status: string }>({
    method: "POST",
    path: `/v2/payments/captures/${encodeURIComponent(input.captureId)}/refund`,
    requestId: input.requestId,
    body: {
      amount: { currency_code: CURRENCY, value: toPayPalValue(input.amountCents) },
      note_to_payer: clip(input.noteToPayer, 255),
    },
  });
  return { refundId: result.id, status: result.status };
}

async function createPayout(input: PayoutInput): Promise<PayoutResult> {
  const result = await paypalRequest<{ batch_header: { payout_batch_id: string; batch_status: string } }>({
    method: "POST",
    path: "/v1/payments/payouts",
    body: {
      sender_batch_header: {
        // PayPal rejects a reused sender_batch_id, which makes payouts idempotent.
        sender_batch_id: input.senderBatchId,
        email_subject: "You have a payment from Mira Eyewear",
        email_message: input.note,
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: toPayPalValue(input.amountCents), currency: CURRENCY },
          receiver: input.receiver,
          note: clip(input.note, 4000),
          sender_item_id: input.senderItemId,
        },
      ],
    },
  });
  return {
    batchId: result.batch_header.payout_batch_id,
    batchStatus: result.batch_header.batch_status,
  };
}

async function getPayout(batchId: string): Promise<PayoutStatus> {
  const result = await paypalRequest<{
    batch_header: { batch_status: string };
    items?: Array<{ transaction_status?: string }>;
  }>({ method: "GET", path: `/v1/payments/payouts/${encodeURIComponent(batchId)}` });
  return {
    batchStatus: result.batch_header.batch_status,
    itemStatus: result.items?.[0]?.transaction_status ?? null,
  };
}

export const sandboxGateway: PaymentGateway = {
  rail: "paypal",
  createOrder,
  captureOrder: (id) => captureOrder(id),
  refund,
  createPayout,
  getPayout,
};

/** Asks PayPal whether a webhook delivery really came from PayPal. */
export async function verifyWebhookSignature(headers: Headers, event: unknown, webhookId: string): Promise<boolean> {
  const header = (name: string) => headers.get(name);
  const required = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ];
  if (required.some((name) => !header(name))) return false;

  const result = await paypalRequest<{ verification_status?: string }>({
    method: "POST",
    path: "/v1/notifications/verify-webhook-signature",
    body: {
      auth_algo: header("paypal-auth-algo"),
      cert_url: header("paypal-cert-url"),
      transmission_id: header("paypal-transmission-id"),
      transmission_sig: header("paypal-transmission-sig"),
      transmission_time: header("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    },
  });
  return result.verification_status === "SUCCESS";
}
