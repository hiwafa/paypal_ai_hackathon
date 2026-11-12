import type { Actor, RobotId } from "./types";

/** What a robot is doing right now; drives its idle animation. */
export type RobotActivity = "idle" | "listening" | "thinking" | "speaking" | "working";
/** One-off body language a robot can play. */
export type RobotGesture = "none" | "wave" | "present" | "celebrate" | "stamp";

export interface RobotProfile {
  id: RobotId;
  name: string;
  role: string;
  /** Glow colour used for eyes, accents and UI chips. */
  accent: string;
  /** Shell colour for the 3D body. */
  shell: string;
  duty: string;
}

export const ROBOTS: Record<RobotId, RobotProfile> = {
  lumi: {
    id: "lumi",
    name: "Lumi",
    role: "Stylist",
    accent: "#5eead4",
    shell: "#eef2f4",
    duty: "Greets customers, reads face shape, drafts the PayPal order.",
  },
  penny: {
    id: "penny",
    name: "Penny",
    role: "Accountant",
    accent: "#86efac",
    shell: "#e9eef0",
    duty: "Books every PayPal capture, refund and payout; writes the daily briefing.",
  },
  otto: {
    id: "otto",
    name: "Otto",
    role: "Treasurer",
    accent: "#fcd34d",
    shell: "#efede8",
    duty: "Prepares supplier payouts and sends them once the owner approves.",
  },
  kai: {
    id: "kai",
    name: "Kai",
    role: "Customer care",
    accent: "#fda4af",
    shell: "#f1eef0",
    duty: "Reviews photo claims, applies the care policy and issues refunds.",
  },
};

const OTHER_ACTORS: Record<Exclude<Actor, RobotId>, { name: string; accent: string }> = {
  owner: { name: "Maryam", accent: "#c4b5fd" },
  paypal: { name: "PayPal", accent: "#7cb7ff" },
  customer: { name: "Customer", accent: "#e5e7eb" },
};

export function actorName(actor: Actor): string {
  return actor in ROBOTS ? ROBOTS[actor as RobotId].name : OTHER_ACTORS[actor as Exclude<Actor, RobotId>].name;
}

export function actorAccent(actor: Actor): string {
  return actor in ROBOTS ? ROBOTS[actor as RobotId].accent : OTHER_ACTORS[actor as Exclude<Actor, RobotId>].accent;
}

export function isRobot(actor: Actor): actor is RobotId {
  return actor in ROBOTS;
}
