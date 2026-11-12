import type { ProductId } from "@/lib/domain/types";

// Where everything lives in the boutique, in metres. The camera looks at the
// back wall from about five metres away; Lumi stands behind the counter.

export const WALL_Z = -1.8;
export const FLOOR_SIZE = 16;

export const ARCH = { width: 1.7, straight: 1.55, z: WALL_Z + 0.04 };

export const COUNTER = { width: 2.9, height: 1.0, depth: 0.62, z: 0.42 };

/** The little vanity mirror on the counter opens the magic mirror. */
export const VANITY_POSITION: [number, number, number] = [1.24, 1.0, 0.3];
export const LUMI_POSITION: [number, number, number] = [0, 0.8, -0.32];

export const SHELF_ROWS = [1.2, 1.72, 2.24] as const;
export const SHELF_Z = WALL_Z + 0.22;
/** Centre of the two shelf units; each holds two columns at ±0.45 m. */
export const SHELF_UNITS = [{ x: -1.95 }, { x: 1.95 }] as const;

/** Scale that turns millimetre glasses into display-sized objects. */
export const WALL_SCALE = 0.0033;
export const COUNTER_SCALE = 0.003;

type Slot = [number, number];

/** Sunglasses on the left wall, optical frames on the right. */
export const WALL_SLOTS: Record<ProductId, Slot> = {
  solstice: [-2.4, SHELF_ROWS[2]],
  vega: [-1.5, SHELF_ROWS[2]],
  harbor: [-2.4, SHELF_ROWS[1]],
  kite: [-1.5, SHELF_ROWS[1]],
  mesa: [-2.4, SHELF_ROWS[0]],
  ridge: [1.5, SHELF_ROWS[2]],
  juniper: [2.4, SHELF_ROWS[2]],
  atlas: [1.5, SHELF_ROWS[1]],
  pebble: [2.4, SHELF_ROWS[1]],
};

/** Empty shelf spots get a little decoration instead. */
export const DECOR_SLOTS: Array<{ kind: "plant" | "books" | "vase"; at: Slot }> = [
  { kind: "plant", at: [-1.5, SHELF_ROWS[0]] },
  { kind: "books", at: [1.5, SHELF_ROWS[0]] },
  { kind: "vase", at: [2.4, SHELF_ROWS[0]] },
];

const COUNTER_SPACING = 0.6;
export const COUNTER_FRAME_Y = COUNTER.height + 0.17;
export const COUNTER_FRAME_Z = COUNTER.z + 0.08;

/** X position of a frame on the counter, centred on however many are shown. */
export function counterX(index: number, count: number): number {
  return (index - (count - 1) / 2) * COUNTER_SPACING;
}
