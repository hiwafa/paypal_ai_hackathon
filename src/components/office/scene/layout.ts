import type { RobotId } from "@/lib/domain/types";

// Where the crew works in the back office, in metres. Three stations sit side
// by side facing the camera; each robot hovers behind its own desk.

export type CrewId = "penny" | "otto" | "kai";

export const CREW: readonly CrewId[] = ["penny", "otto", "kai"];

export const STATION_X: Record<CrewId, number> = { penny: -1.8, otto: 0, kai: 1.8 };

export const WALL_Z = -1.15;
export const FLOOR_SIZE = 16;

/** Robot origin within its station. Resting hands float just above the desk. */
export const ROBOT = { y: 0.6, z: -0.2 } as const;
export const HEAD_Y = ROBOT.y + 0.8;

/** The desk top sits exactly where a stamping hand lands. */
export const DESK = { width: 1.3, depth: 0.5, top: 0.76, z: 0.31 } as const;
export const DESK_FRONT_Z = DESK.z + DESK.depth / 2;

/** The part of the room that must stay in frame, whatever the canvas shape. */
export const FRAME = { width: 5.7, height: 2.05, centreY: 1.12 } as const;

/** How long a robot works at its desk before acting an event out. */
export const WORK_MS = 900;

export function isCrew(id: RobotId | null | undefined): id is CrewId {
  return id === "penny" || id === "otto" || id === "kai";
}
