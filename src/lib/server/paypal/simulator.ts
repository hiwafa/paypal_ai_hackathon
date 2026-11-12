import "server-only";
import { simulatedId } from "../ids";
import { simulatedFee } from "../seed";
import type { PaymentGateway, PayoutStatus } from "./types";

// Stand-in for PayPal when no sandbox keys are configured, so the demo works
// without any setup. Every ID starts with "SIM-" and the UI labels these
// records "Simulated", so they are never mistaken for real PayPal responses.

const SETTLE_AFTER_MS = 4_000;

const globalSim = globalThis as typeof globalThis & { __crewosSimPayouts?: Map<string, number> };

function payouts(): Map<string, number> {
  globalSim.__crewosSimPayouts ??= new Map();
  return globalSim.__crewosSimPayouts;
}

export const simulatorGateway: PaymentGateway = {
  rail: "simulated",

  async createOrder() {
    return simulatedId();
  },

  async captureOrder(_paypalOrderId, expectedCents) {
    return {
      orderStatus: "COMPLETED",
      captureId: simulatedId(),
      captureStatus: "COMPLETED",
      amountCents: expectedCents,
      feeCents: simulatedFee(expectedCents),
      payerName: "Sara K.",
      payerEmail: "sara.demo@example.com",
      shipTo: "Rua das Flores 12, Lisbon, PT",
    };
  },

  async refund() {
    return { refundId: simulatedId(), status: "COMPLETED" };
  },

  async createPayout() {
    const batchId = simulatedId();
    payouts().set(batchId, Date.now());
    return { batchId, batchStatus: "PENDING" };
  },

  async getPayout(batchId): Promise<PayoutStatus> {
    const createdAt = payouts().get(batchId);
    const settled = createdAt === undefined || Date.now() - createdAt >= SETTLE_AFTER_MS;
    return settled
      ? { batchStatus: "SUCCESS", itemStatus: "SUCCESS" }
      : { batchStatus: "PENDING", itemStatus: "PENDING" };
  },
};
