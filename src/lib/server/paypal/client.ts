import "server-only";
import { getPayPalConfig, type PayPalConfig } from "../env";

// Minimal PayPal REST client. This build only ever talks to the sandbox.
export const PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com";

interface PayPalErrorBody {
  name?: string;
  message?: string;
  debug_id?: string;
  details?: Array<{ issue?: string; description?: string }>;
  error?: string;
  error_description?: string;
}

export class PayPalApiError extends Error {
  readonly status: number;
  readonly issue: string | null;
  readonly debugId: string | null;
  readonly userMessage: string;

  constructor(status: number, body: PayPalErrorBody | null, fallback: string) {
    const issue = body?.details?.[0]?.issue ?? body?.name ?? body?.error ?? null;
    const description = body?.details?.[0]?.description ?? body?.message ?? body?.error_description ?? fallback;
    super(`${status} ${issue ?? "ERROR"}: ${description}`);
    this.name = "PayPalApiError";
    this.status = status;
    this.issue = issue;
    this.debugId = body?.debug_id ?? null;
    this.userMessage = description;
  }
}

interface CachedToken {
  token: string;
  expiresAt: number;
  clientId: string;
}

const globalToken = globalThis as typeof globalThis & {
  __crewosPayPalToken?: CachedToken;
  __crewosPayPalTokenRequest?: Promise<CachedToken>;
};

async function requestToken(config: PayPalConfig): Promise<CachedToken> {
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    (PayPalErrorBody & { access_token?: string; expires_in?: number }) | null;
  if (!response.ok || !body?.access_token) {
    throw new PayPalApiError(response.status, body, "Could not authenticate with PayPal.");
  }
  // Refresh a minute early so a token never expires mid-request.
  const lifetimeMs = (Number(body.expires_in) || 300) * 1000;
  return {
    token: body.access_token,
    expiresAt: Date.now() + lifetimeMs - 60_000,
    clientId: config.clientId,
  };
}

async function accessToken(config: PayPalConfig, forceRefresh = false): Promise<string> {
  const cached = globalToken.__crewosPayPalToken;
  if (!forceRefresh && cached && cached.clientId === config.clientId && cached.expiresAt > Date.now()) {
    return cached.token;
  }
  // Concurrent callers share one token request instead of stampeding OAuth.
  globalToken.__crewosPayPalTokenRequest ??= requestToken(config).finally(() => {
    globalToken.__crewosPayPalTokenRequest = undefined;
  });
  const fresh = await globalToken.__crewosPayPalTokenRequest;
  globalToken.__crewosPayPalToken = fresh;
  return fresh.token;
}

export interface PayPalRequest {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  /** Sent as PayPal-Request-Id so retries can never double-charge or double-pay. */
  requestId?: string;
}

export async function paypalRequest<T>({ method, path, body, requestId }: PayPalRequest): Promise<T> {
  const config = getPayPalConfig();
  if (!config) throw new Error("PayPal credentials are not configured.");

  const send = (token: string) =>
    fetch(`${PAYPAL_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "return=representation",
        ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });

  let response = await send(await accessToken(config));
  if (response.status === 401) response = await send(await accessToken(config, true));

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    throw new PayPalApiError(
      response.status,
      parsed as PayPalErrorBody | null,
      `PayPal request failed with status ${response.status}.`,
    );
  }
  return parsed as T;
}
