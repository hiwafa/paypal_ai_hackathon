import "server-only";
import type { RuntimeConfig } from "@/lib/domain/api";
import { CARE_POLICY } from "@/lib/domain/policy";

// Environment is read lazily (at call time, not import time) so a deployment
// can change keys without a rebuild, and builds never need secrets.

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  webhookId: string | null;
  /** Sandbox personal account that receives every supplier payout. */
  payoutReceiver: string | null;
}

export function getPayPalConfig(): PayPalConfig | null {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    webhookId: process.env.PAYPAL_WEBHOOK_ID?.trim() || null,
    payoutReceiver: process.env.PAYPAL_PAYOUT_RECEIVER?.trim() || null,
  };
}

export const DEFAULT_MODEL = "claude-opus-5-5";

export interface AiConfig {
  apiKey: string;
  model: string;
}

export function getAiConfig(): AiConfig | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return { apiKey, model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL };
}

/** Instant-refund ceiling in cents; configurable in whole dollars. */
export function autoRefundLimitCents(): number {
  // An empty value (as copied from .env.example) means "use the default", not $0.
  const raw = process.env.AUTO_REFUND_LIMIT_USD?.trim();
  const dollars = raw ? Number(raw) : NaN;
  if (Number.isFinite(dollars) && dollars >= 0 && dollars <= 500) return Math.round(dollars * 100);
  return CARE_POLICY.defaultAutoRefundLimitCents;
}

/** The subset of configuration that is safe to show in the browser. */
export function runtimeConfig(): RuntimeConfig {
  const paypal = getPayPalConfig();
  const ai = getAiConfig();
  return {
    paypal: {
      mode: paypal ? "sandbox" : "simulated",
      clientId: paypal?.clientId ?? null,
      webhooks: Boolean(paypal?.webhookId),
    },
    ai: { mode: ai ? "claude" : "offline", model: ai?.model ?? null },
    policy: { autoRefundLimitCents: autoRefundLimitCents() },
  };
}
