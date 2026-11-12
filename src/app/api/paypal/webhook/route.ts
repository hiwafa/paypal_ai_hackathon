import { getPayPalConfig } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { verifyWebhookSignature } from "@/lib/server/paypal/sandbox";
import { handleWebhookEvent, type PayPalWebhookEvent } from "@/lib/server/services/webhooks";

// PayPal calls this URL for captures, refunds and payouts. Nothing is trusted
// until PayPal itself confirms the signature for our webhook id.
export async function POST(request: Request) {
  try {
    const config = getPayPalConfig();
    if (!config?.webhookId) {
      return Response.json({ error: "Webhooks are not configured on this deployment." }, { status: 503 });
    }

    const raw = await request.text();
    if (raw.length > 256_000) return Response.json({ error: "Payload too large." }, { status: 413 });

    let event: PayPalWebhookEvent;
    try {
      event = JSON.parse(raw) as PayPalWebhookEvent;
    } catch {
      return Response.json({ error: "Invalid JSON." }, { status: 400 });
    }
    if (typeof event?.id !== "string" || typeof event?.event_type !== "string") {
      return Response.json({ error: "Not a PayPal event." }, { status: 400 });
    }

    const verified = await verifyWebhookSignature(request.headers, event, config.webhookId);
    if (!verified) return Response.json({ error: "Signature verification failed." }, { status: 401 });

    const result = await handleWebhookEvent(event);
    return Response.json({ received: true, result });
  } catch (error) {
    return errorResponse(error);
  }
}
