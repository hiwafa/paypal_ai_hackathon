import type { LedgerView } from "./ledgerView";
import type { RobotId } from "./types";

// Shapes returned by the back-office AI endpoints.

export interface CrewAction {
  kind: "payout_request" | "refund_request" | "lookup" | "ledger_view";
  label: string;
  approvalId?: string;
  /** For "ledger_view": what the ledger grid should show. */
  view?: LedgerView;
}

export interface CrewReply {
  reply: string;
  actor: RobotId;
  actions: CrewAction[];
  source: "claude" | "offline";
}

export interface Briefing {
  headline: string;
  highlights: string[];
  watchouts: string[];
  nextSteps: string[];
  spoken: string;
  source: "claude" | "offline";
  generatedAt: string;
}
