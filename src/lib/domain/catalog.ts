import type { FaceShape, FrameSize, Product, ProductId, Supplier } from "./types";

// The Mira Eyewear collection. Prices are the single source of truth for
// checkout: the server always recomputes totals from this list.
export const PRODUCTS: readonly Product[] = [
  {
    id: "solstice",
    name: "Solstice",
    tagline: "Gold aviator · green lens",
    description:
      "A softened teardrop aviator in brushed gold with a classic green lens. Balances a wider forehead and adds lift to strong jaws.",
    kind: "sun",
    style: "aviator",
    priceCents: 14800,
    suits: ["heart", "square", "oval"],
    look: {
      material: "metal",
      frameColor: "#cfa64e",
      lensTint: "#2f4b2e",
      lensOpacity: 0.8,
      fitScale: 1.02,
    },
  },
  {
    id: "harbor",
    name: "Harbor",
    tagline: "Round tortoise · amber lens",
    description: "Hand-polished tortoise acetate in a gentle round. Softens angular features and suits longer faces.",
    kind: "sun",
    style: "round",
    priceCents: 11800,
    suits: ["square", "heart", "oblong", "oval"],
    look: {
      material: "acetate",
      frameColor: "#6b3c1d",
      pattern: "tortoise",
      lensTint: "#4a2f1c",
      lensOpacity: 0.72,
      fitScale: 0.95,
    },
  },
  {
    id: "vega",
    name: "Vega",
    tagline: "Black cat-eye · smoke lens",
    description: "A confident cat-eye with a lifted outer edge. Adds definition to round and square faces.",
    kind: "sun",
    style: "cat-eye",
    priceCents: 13200,
    suits: ["round", "square", "oval"],
    look: {
      material: "acetate",
      frameColor: "#141416",
      lensTint: "#1d1d22",
      lensOpacity: 0.82,
      fitScale: 1.0,
    },
  },
  {
    id: "atlas",
    name: "Atlas",
    tagline: "Matte black rectangle · optical",
    description: "An everyday rectangle in matte black acetate. Clean lines that sharpen round and oval faces.",
    kind: "optical",
    style: "rectangle",
    priceCents: 9600,
    suits: ["round", "oval"],
    look: {
      material: "acetate",
      finish: "matte",
      frameColor: "#1b1b1d",
      lensTint: "#dfe9f0",
      lensOpacity: 0.1,
      fitScale: 1.0,
    },
  },
  {
    id: "juniper",
    name: "Juniper",
    tagline: "Silver round wire · optical",
    description: "A featherweight round wire frame in polished silver. Softens strong angles without hiding the face.",
    kind: "optical",
    style: "round-metal",
    priceCents: 10400,
    suits: ["square", "oblong", "heart"],
    look: {
      material: "metal",
      frameColor: "#c9ced6",
      lensTint: "#e3edf3",
      lensOpacity: 0.08,
      fitScale: 0.93,
    },
  },
  {
    id: "kite",
    name: "Kite",
    tagline: "Rose-gold hexagon · rose lens",
    description: "A geometric hexagon in rose gold with a warm rose lens. Adds angles to soft, round features.",
    kind: "sun",
    style: "hexagon",
    priceCents: 12600,
    suits: ["round", "oval"],
    look: {
      material: "metal",
      frameColor: "#d9a089",
      lensTint: "#7b4a49",
      lensOpacity: 0.62,
      fitScale: 0.98,
    },
  },
  {
    id: "mesa",
    name: "Mesa",
    tagline: "Oversized honey · brown gradient",
    description: "Generous honey acetate with deep brown lenses. Shortens long faces and makes a statement.",
    kind: "sun",
    style: "oversized",
    priceCents: 13800,
    suits: ["oblong", "oval"],
    look: {
      material: "acetate",
      frameColor: "#b8742a",
      lensTint: "#3e2817",
      lensOpacity: 0.8,
      fitScale: 1.08,
    },
  },
  {
    id: "ridge",
    name: "Ridge",
    tagline: "Browline black & gold · optical",
    description: "A browline with a black acetate brow over a fine gold rim. Adds structure to round and long faces.",
    kind: "optical",
    style: "browline",
    priceCents: 11200,
    suits: ["round", "oval", "oblong"],
    look: {
      material: "acetate",
      frameColor: "#161616",
      accentColor: "#cfa64e",
      lensTint: "#e0eaf0",
      lensOpacity: 0.1,
      fitScale: 1.0,
    },
  },
  {
    id: "pebble",
    name: "Pebble",
    tagline: "Crystal soft-square · optical",
    description: "Soft-square crystal acetate that lets the face shine through. Light, friendly and easy to wear.",
    kind: "optical",
    style: "soft-square",
    priceCents: 8800,
    suits: ["round", "oval", "heart"],
    look: {
      material: "acetate",
      finish: "crystal",
      frameColor: "#dfe6ea",
      lensTint: "#e8f0f4",
      lensOpacity: 0.08,
      fitScale: 0.97,
    },
  },
];

const BY_ID = new Map<ProductId, Product>(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(id: ProductId): Product {
  const product = BY_ID.get(id);
  if (!product) throw new Error(`Unknown product: ${id}`);
  return product;
}

/** Total frame width per size, in millimetres. */
export const SIZE_WIDTH_MM: Record<FrameSize, number> = { S: 130, M: 138, L: 146 };

/**
 * Picks a frame size from the temple-to-temple face width measured by the
 * mirror. A well-fitted front is about 90% of that width (an average face of
 * ~153 mm wears a 138 mm medium), so we pick the size closest to 0.9 × width.
 */
export function sizeForFaceWidth(widthMm: number | null | undefined): FrameSize {
  if (!widthMm || !Number.isFinite(widthMm)) return "M";
  const ideal = widthMm * 0.9;
  if (ideal < (SIZE_WIDTH_MM.S + SIZE_WIDTH_MM.M) / 2) return "S";
  if (ideal > (SIZE_WIDTH_MM.M + SIZE_WIDTH_MM.L) / 2) return "L";
  return "M";
}

export const SHAPE_ADVICE: Record<FaceShape, string> = {
  oval: "Balanced proportions: almost every silhouette works, so pick by mood.",
  round: "Angular frames add definition: rectangles, cat-eyes and hexagons.",
  square: "Soft curves balance a strong jaw: rounds, aviators and cat-eyes.",
  heart: "Frames with weight at the bottom or a soft teardrop balance a wider brow.",
  oblong: "Taller or oversized frames shorten the face; strong browlines help too.",
};

// Suppliers the treasurer pays. In sandbox mode every payout is routed to the
// sandbox account in PAYPAL_PAYOUT_RECEIVER, because PayPal only delivers
// sandbox payouts to sandbox accounts.
export const SUPPLIERS: readonly Supplier[] = [
  {
    id: "lens-lab",
    name: "Lens Lab Co.",
    category: "Lenses",
    email: "billing@lenslab.example",
  },
  {
    id: "acetate-atelier",
    name: "Acetate Atelier",
    category: "Frames",
    email: "accounts@acetate-atelier.example",
  },
  {
    id: "box-and-bow",
    name: "Box & Bow",
    category: "Packaging",
    email: "hello@boxandbow.example",
  },
];

export const STORE = {
  name: "Mira Eyewear",
  owner: "Maryam",
  city: "Lisbon",
};
