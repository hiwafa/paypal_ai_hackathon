import type { CheckoutSummary, CreatedOrder, OfficeState, RuntimeConfig } from "@/lib/domain/api";
import type { Briefing, CrewReply } from "@/lib/domain/crew";
import type { StylistReply, StylistRequest } from "@/lib/domain/stylist";
import type { Approval, CartLine, Claim } from "@/lib/domain/types";

// Typed fetch helpers for the browser. Every failure becomes an ApiError with
// a message that is safe to show to people.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(
      path,
      body === undefined
        ? { cache: "no-store" }
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
  } catch {
    throw new ApiError("You seem to be offline. Please check your connection.", 0);
  }
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new ApiError(data?.error ?? `Request failed (${response.status}).`, response.status);
  }
  return data as T;
}

export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export interface ClaimRequest {
  orderNumber: string;
  message: string;
  photo: { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string };
  thumbnail?: string;
}

export const api = {
  config: () => call<RuntimeConfig>("/api/config"),
  stylist: (request: StylistRequest) => call<StylistReply>("/api/stylist", request),
  createOrder: (lines: CartLine[], fitNote?: string) => call<CreatedOrder>("/api/checkout/orders", { lines, fitNote }),
  captureOrder: (paypalOrderId: string) =>
    call<CheckoutSummary>(`/api/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {}),
  fileClaim: (input: ClaimRequest) => call<{ claim: Claim }>("/api/claims", input),
  officeState: () => call<OfficeState>("/api/office/state"),
  decide: (id: string, decision: "approve" | "reject", via: "click" | "voice") =>
    call<{ approval: Approval }>(`/api/office/approvals/${id}`, { decision, via }),
  command: (text: string) => call<CrewReply>("/api/office/command", { text, timeZone: localTimeZone() }),
  briefing: () => call<Briefing>("/api/office/briefing", { timeZone: localTimeZone() }),
  resetDemo: () => call<{ ok: true }>("/api/office/reset", { confirm: "reset" }),
};
