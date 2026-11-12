"use client";

import { useSyncExternalStore } from "react";
import { mouth, subscribeSpeaker } from "@/lib/client/speech";
import type { RobotId } from "@/lib/domain/types";

const current = () => mouth.speaker;
const nobody = () => null;

/** The robot whose voice is playing right now, if any. */
export function useSpeaker(): RobotId | null {
  return useSyncExternalStore(subscribeSpeaker, current, nobody);
}
