"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CheckoutSummary } from "@/lib/domain/api";
import type { ChatTurn, Mood } from "@/lib/domain/stylist";
import type { CartLine, FaceProfile, FrameSize, PaymentRail, ProductId } from "@/lib/domain/types";

export type LumiActivity = "idle" | "listening" | "thinking" | "speaking";
export type Gesture = "none" | "wave" | "present" | "celebrate";
export type MirrorMode = "closed" | "consent" | "starting" | "live" | "mannequin";
export type Panel = "mirror" | "bag" | "care";

/** Frames that fit on the counter at once. */
export const COUNTER_SLOTS = 4;

export interface PastOrder {
  number: string;
  at: string;
  summary: string;
  totalCents: number;
  rail: PaymentRail;
}

interface ShopState {
  entered: boolean;
  enteredAt: number;
  turns: ChatTurn[];
  suggestions: string[];
  busy: boolean;
  mood: Mood;
  activity: LumiActivity;
  gesture: { kind: Gesture; at: number };
  onCounter: ProductId[];
  /** The counter frame the customer last picked; its tag is highlighted. */
  focused: ProductId | null;
  hovered: ProductId | null;
  mirror: MirrorMode;
  tryingOn: ProductId | null;
  face: FaceProfile | null;
  bag: CartLine[];
  bagOpen: boolean;
  careOpen: boolean;
  lastOrder: CheckoutSummary | null;
  myOrders: PastOrder[];
  muted: boolean;
}

interface ShopActions {
  enter: () => void;
  pushTurn: (turn: ChatTurn) => void;
  patch: (partial: Partial<ShopState>) => void;
  playGesture: (kind: Gesture) => void;
  showFrames: (ids: ProductId[]) => void;
  pickFrame: (id: ProductId) => void;
  returnFrame: (id: ProductId) => void;
  openPanel: (panel: Panel | null) => void;
  tryOn: (id: ProductId) => void;
  addToBag: (id: ProductId, size: FrameSize) => void;
  removeFromBag: (id: ProductId) => void;
  setQuantity: (id: ProductId, size: FrameSize, quantity: number) => void;
  setSize: (id: ProductId, from: FrameSize, to: FrameSize) => void;
  recordOrder: (summary: CheckoutSummary) => void;
}

const MAX_TURNS = 40;

export const useShop = create<ShopState & ShopActions>()(
  persist(
    (set) => ({
      entered: false,
      enteredAt: 0,
      turns: [],
      suggestions: [],
      busy: false,
      mood: "happy",
      activity: "idle",
      gesture: { kind: "none", at: 0 },
      onCounter: [],
      focused: null,
      hovered: null,
      mirror: "closed",
      tryingOn: null,
      face: null,
      bag: [],
      bagOpen: false,
      careOpen: false,
      lastOrder: null,
      myOrders: [],
      muted: false,

      enter: () => set({ entered: true, enteredAt: performance.now() }),
      pushTurn: (turn) => set((s) => ({ turns: [...s.turns, turn].slice(-MAX_TURNS) })),
      patch: (partial) => set(partial),
      playGesture: (kind) => set({ gesture: { kind, at: performance.now() } }),
      showFrames: (ids) => {
        const onCounter = [...new Set(ids)].slice(0, COUNTER_SLOTS);
        set({ onCounter, focused: onCounter[0] ?? null });
      },
      // New picks join the end of the counter; the oldest one goes back to the wall.
      pickFrame: (id) =>
        set((s) => ({
          onCounter: [...s.onCounter.filter((x) => x !== id), id].slice(-COUNTER_SLOTS),
          focused: id,
        })),
      returnFrame: (id) =>
        set((s) => ({
          onCounter: s.onCounter.filter((x) => x !== id),
          focused: s.focused === id ? null : s.focused,
        })),
      openPanel: (panel) =>
        set((s) => ({
          mirror: panel === "mirror" ? (s.mirror === "closed" ? "consent" : s.mirror) : "closed",
          bagOpen: panel === "bag",
          careOpen: panel === "care",
        })),
      tryOn: (id) =>
        set((s) => ({
          tryingOn: id,
          focused: id,
          onCounter: s.onCounter.includes(id) ? s.onCounter : [...s.onCounter, id].slice(-COUNTER_SLOTS),
        })),
      addToBag: (id, size) =>
        set((s) => {
          const existing = s.bag.find((l) => l.productId === id && l.size === size);
          const bag = existing
            ? s.bag.map((l) => (l === existing ? { ...l, quantity: Math.min(3, l.quantity + 1) } : l))
            : [...s.bag, { productId: id, size, quantity: 1 }].slice(-6);
          return { bag };
        }),
      removeFromBag: (id) => set((s) => ({ bag: s.bag.filter((l) => l.productId !== id) })),
      setQuantity: (id, size, quantity) =>
        set((s) => ({
          bag:
            quantity <= 0
              ? s.bag.filter((l) => !(l.productId === id && l.size === size))
              : s.bag.map((l) =>
                  l.productId === id && l.size === size ? { ...l, quantity: Math.min(3, quantity) } : l,
                ),
        })),
      // Changing size merges into an existing line of that size, if any.
      setSize: (id, from, to) =>
        set((s) => {
          const line = s.bag.find((l) => l.productId === id && l.size === from);
          if (!line || from === to) return {};
          const twin = s.bag.find((l) => l.productId === id && l.size === to);
          if (!twin) return { bag: s.bag.map((l) => (l === line ? { ...l, size: to } : l)) };
          return {
            bag: s.bag
              .filter((l) => l !== line)
              .map((l) => (l === twin ? { ...l, quantity: Math.min(3, l.quantity + line.quantity) } : l)),
          };
        }),
      recordOrder: (summary) =>
        set((s) => ({
          // The bag drawer stays open and turns into the receipt.
          lastOrder: summary,
          bag: [],
          myOrders: [
            {
              number: summary.number,
              at: new Date().toISOString(),
              summary: summary.lines.map((l) => `${l.name} (${l.size})`).join(", "),
              totalCents: summary.totalCents,
              rail: summary.rail,
            },
            ...s.myOrders.filter((o) => o.number !== summary.number),
          ].slice(0, 10),
        })),
    }),
    {
      name: "mira-shop",
      storage: createJSONStorage(() => localStorage),
      // Only what a returning customer expects to find again.
      partialize: (s) => ({ bag: s.bag, myOrders: s.myOrders, muted: s.muted }),
      // Restored in an effect after hydration, so server and client render the same markup.
      skipHydration: true,
    },
  ),
);
