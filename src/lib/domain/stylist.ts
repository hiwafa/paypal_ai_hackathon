import type { CartLine, FaceProfile, FrameSize, ProductId } from "./types";

// Contract between the boutique UI and Lumi's brain (Claude or the offline one).

export const MOODS = ["happy", "curious", "thinking", "excited", "caring"] as const;
export type Mood = (typeof MOODS)[number];

export type StylistAction =
  | { type: "show_frames"; productIds: ProductId[] }
  | { type: "open_mirror" }
  | { type: "try_on"; productId: ProductId }
  | { type: "add_to_bag"; productId: ProductId; size: FrameSize }
  | { type: "remove_from_bag"; productId: ProductId }
  | { type: "open_checkout" };

export interface StylistReply {
  say: string;
  mood: Mood;
  actions: StylistAction[];
  suggestions: string[];
  source: "claude" | "offline";
}

export type ChatRole = "customer" | "lumi" | "event";

export interface ChatTurn {
  role: ChatRole;
  text: string;
}

export interface ShopState {
  face: FaceProfile | null;
  bag: CartLine[];
  onCounter: ProductId[];
  tryingOn: ProductId | null;
  mirrorOpen: boolean;
}

export interface StylistRequest {
  turns: ChatTurn[];
  state: ShopState;
}
