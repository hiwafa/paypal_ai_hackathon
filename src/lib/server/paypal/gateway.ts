import "server-only";
import type { PaymentRail } from "@/lib/domain/types";
import { getPayPalConfig } from "../env";
import { HttpError } from "../http";
import { sandboxGateway } from "./sandbox";
import { simulatorGateway } from "./simulator";
import type { PaymentGateway } from "./types";

/** New money movements use the sandbox when keys exist, otherwise the simulator. */
export function defaultRail(): PaymentRail {
  return getPayPalConfig() ? "paypal" : "simulated";
}

/**
 * Existing records keep the rail they were created on: a seeded (simulated)
 * order is refunded by the simulator even after sandbox keys are added.
 */
export function gatewayFor(rail: PaymentRail): PaymentGateway {
  if (rail === "simulated") return simulatorGateway;
  if (!getPayPalConfig()) {
    throw new HttpError(503, "This record lives in the PayPal sandbox, but sandbox keys are not configured.");
  }
  return sandboxGateway;
}
