"use client";

import { create } from "zustand";
import type { OfficeState } from "@/lib/domain/api";
import type { Briefing, CrewAction } from "@/lib/domain/crew";
import type { LedgerView } from "@/lib/domain/ledgerView";
import type { RobotGesture } from "@/lib/domain/robots";
import type { ActivityItem, RobotId } from "@/lib/domain/types";

// Back-office state. Plain data and setters only; the behaviour (talking to
// the API, the live feed, voices) lives in office.ts, like lumi.ts for the shop.

/** One beat in the crew room: a robot acting out something that just happened. */
export interface Stage {
  robot: RobotId;
  gesture: RobotGesture;
  item: ActivityItem;
  /** performance.now() when the beat started. */
  at: number;
}

export interface OwnerTurn {
  text: string;
  via: "voice" | "typed";
}

/** The crew's latest answer to the owner, shown in the console and spoken aloud. */
export interface CrewLine {
  robot: RobotId;
  text: string;
  /** Who wrote the words; null for fixed confirmations such as "sending it now". */
  source: "claude" | "offline" | null;
  actions: CrewAction[];
}

interface OfficeStore {
  state: OfficeState | null;
  loadError: string | null;
  /** The live feed (SSE) is connected. */
  live: boolean;
  /** What the crew last put on the ledger grid; null shows everything. */
  view: LedgerView | null;
  lastOwnerTurn: OwnerTurn | null;
  reply: CrewLine | null;
  /** The robot working on the owner's request, while it is in flight. */
  thinking: RobotId | null;
  commandError: string | null;
  briefing: Briefing | null;
  briefingLoading: boolean;
  /** Approval ids with a decision in flight. */
  deciding: string[];
  approvalError: string | null;
  stage: Stage | null;
  muted: boolean;

  patch: (partial: Partial<Omit<OfficeStore, "patch">>) => void;
}

export const useOffice = create<OfficeStore>()((set) => ({
  state: null,
  loadError: null,
  live: false,
  view: null,
  lastOwnerTurn: null,
  reply: null,
  thinking: null,
  commandError: null,
  briefing: null,
  briefingLoading: false,
  deciding: [],
  approvalError: null,
  stage: null,
  muted: false,
  patch: (partial) => set(partial),
}));
