import * as THREE from "three";
import type { FrameLook, FrameStyle } from "@/lib/domain/types";

// Procedural eyewear. Every frame in the catalog is generated from a few
// numbers (lens width/height, superellipse exponent, lift, droop, rim width),
// in millimetres, so the boutique wall and the AR mirror share one model.
//
// Axes: x to the wearer's sides, y up, z towards the viewer. The front of the
// frame sits on z = 0 and the temples reach back along -z. The origin is the
// midpoint between the two lens centres.

interface LensSpec {
  width: number;
  height: number;
  /** Superellipse exponent: 2 is an ellipse, higher is squarer. */
  exponent: number;
  /** Cat-eye: raises the outer-top corner (mm). */
  lift?: number;
  /** Aviator teardrop: pulls the inner-bottom down (mm). */
  droop?: number;
  hexagon?: boolean;
}

interface StyleSpec {
  lens: LensSpec;
  /** Gap between the lenses at the bridge (mm). */
  bridge: number;
  /** Acetate rim width, or wire radius for metal frames (mm). */
  rim: number;
  /** Depth of an acetate front (mm). */
  thickness: number;
  doubleBridge?: boolean;
  browline?: boolean;
  nosePads?: boolean;
}

const STYLES: Record<FrameStyle, StyleSpec> = {
  aviator: {
    lens: { width: 56, height: 47, exponent: 2.5, droop: 8 },
    bridge: 17,
    rim: 0.95,
    thickness: 2,
    doubleBridge: true,
    nosePads: true,
  },
  round: { lens: { width: 47, height: 45, exponent: 2 }, bridge: 20, rim: 5, thickness: 5 },
  "cat-eye": { lens: { width: 53, height: 41, exponent: 2.6, lift: 9 }, bridge: 18, rim: 5.5, thickness: 5.5 },
  rectangle: { lens: { width: 53, height: 35, exponent: 4.6 }, bridge: 18, rim: 5, thickness: 5 },
  "round-metal": {
    lens: { width: 47, height: 45, exponent: 2 },
    bridge: 20,
    rim: 0.85,
    thickness: 1.7,
    nosePads: true,
  },
  hexagon: {
    lens: { width: 52, height: 46, exponent: 2, hexagon: true },
    bridge: 19,
    rim: 0.95,
    thickness: 1.9,
    nosePads: true,
  },
  oversized: { lens: { width: 58, height: 52, exponent: 3.2, lift: 3 }, bridge: 17, rim: 6, thickness: 6 },
  browline: {
    lens: { width: 51, height: 40, exponent: 3 },
    bridge: 19,
    rim: 1,
    thickness: 5,
    browline: true,
    nosePads: true,
  },
  "soft-square": { lens: { width: 51, height: 43, exponent: 3.6 }, bridge: 19, rim: 5, thickness: 5 },
};

const V2 = THREE.Vector2;

// --- 2D outline helpers -----------------------------------------------------

function chaikin(points: THREE.Vector2[], iterations: number): THREE.Vector2[] {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const next: THREE.Vector2[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      next.push(a.clone().lerp(b, 0.25), a.clone().lerp(b, 0.75));
    }
    pts = next;
  }
  return pts;
}

/** Lens outline for the lens on the +x side, centred on its own optical centre, counter-clockwise. */
function lensOutline(spec: LensSpec, segments = 120): THREE.Vector2[] {
  const a = spec.width / 2;
  const b = spec.height / 2;
  let points: THREE.Vector2[] = [];

  if (spec.hexagon) {
    const corners = [
      new V2(a, 0),
      new V2(a * 0.52, b),
      new V2(-a * 0.52, b),
      new V2(-a, 0),
      new V2(-a * 0.52, -b),
      new V2(a * 0.52, -b),
    ];
    points = chaikin(corners, 4);
  } else {
    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const c = Math.cos(t);
      const s = Math.sin(t);
      let x = a * Math.sign(c) * Math.abs(c) ** (2 / spec.exponent);
      let y = b * Math.sign(s) * Math.abs(s) ** (2 / spec.exponent);
      const u = x / a; // -1 at the nose side, +1 at the temple side
      if (spec.lift) {
        const outer = Math.max(0, u) ** 2;
        y += y > 0 ? spec.lift * outer * (y / b) : spec.lift * 0.3 * outer;
      }
      if (spec.droop && y < 0) {
        const inner = ((1 - u) / 2) ** 1.3;
        y -= spec.droop * inner * (-y / b);
        x += spec.droop * 0.25 * inner * (-y / b);
      }
      points.push(new V2(x, y));
    }
  }

  // Re-centre so the lens's bounding box is centred on the optical centre.
  const box = new THREE.Box2().setFromPoints(points);
  const centre = box.getCenter(new V2());
  return points.map((p) => p.sub(centre));
}

function offsetOutline(points: THREE.Vector2[], distance: number): THREE.Vector2[] {
  const n = points.length;
  return points.map((p, i) => {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const tangent = next.clone().sub(prev).normalize();
    // Outward normal of a counter-clockwise outline.
    return new V2(p.x + tangent.y * distance, p.y - tangent.x * distance);
  });
}

/** Places a lens outline on one side of the face; side -1 mirrors it and keeps it counter-clockwise. */
function place(points: THREE.Vector2[], centreX: number, side: 1 | -1): THREE.Vector2[] {
  const placed = points.map((p) => new V2(side * (centreX + p.x), p.y));
  return side === 1 ? placed : placed.reverse();
}

// --- 3D builders ------------------------------------------------------------

function tube(points: THREE.Vector3[], radius: number, closed: boolean, segments = 160): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, closed, "centripetal");
  return new THREE.TubeGeometry(curve, segments, radius, 10, closed);
}

function ringGeometry(outer: THREE.Vector2[], inner: THREE.Vector2[], depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(outer);
  if (inner.length) shape.holes.push(new THREE.Path([...inner].reverse()));
  const bevel = Math.min(0.9, depth * 0.18);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.2, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 3,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -depth / 2 + bevel);
  return geometry;
}

function lensGeometry(outline: THREE.Vector2[], centreX: number): THREE.BufferGeometry {
  const geometry = new THREE.ShapeGeometry(new THREE.Shape(outline), 1);
  // Gentle base curve so reflections slide across the lens like real glass.
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - centreX;
    const dy = pos.getY(i);
    pos.setZ(i, -0.4 - (dx * dx + dy * dy) / 260);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

export interface GlassesParts {
  frame: THREE.BufferGeometry[];
  accent: THREE.BufferGeometry[];
  lenses: THREE.BufferGeometry[];
  pads: THREE.BufferGeometry[];
  /** Total front width in millimetres (temple to temple). */
  frontWidth: number;
}

function buildParts(style: FrameStyle, material: FrameLook["material"]): GlassesParts {
  const spec = STYLES[style];
  const metal = material === "metal";
  const outline = lensOutline(spec.lens);
  const box = new THREE.Box2().setFromPoints(outline);
  const halfWidth = (box.max.x - box.min.x) / 2;
  const top = box.max.y;
  const centreX = spec.bridge / 2 + halfWidth;
  const rimOuter = metal || spec.browline ? spec.rim * 2 : spec.rim;

  const parts: GlassesParts = { frame: [], accent: [], lenses: [], pads: [], frontWidth: 0 };

  for (const side of [1, -1] as const) {
    const lensEdge = place(outline, centreX, side);

    if (metal) {
      const wire = offsetOutline(lensEdge, spec.rim * 0.6).map((p) => new THREE.Vector3(p.x, p.y, 0));
      parts.frame.push(tube(wire, spec.rim, true, 220));
    } else if (spec.browline) {
      // Fine metal rim all round (accent colour)...
      const wire = offsetOutline(lensEdge, 0.6).map((p) => new THREE.Vector3(p.x, p.y, 0));
      parts.accent.push(tube(wire, 0.8, true, 220));
      // ...and a bold acetate brow over the top half.
      const upperInner = place(outline, centreX, side).filter((p) => p.y > top * 0.15);
      const sorted = upperInner.sort((p, q) => p.x - q.x);
      const outer = sorted.map((p) => {
        const lift = 3.2 + 3 * Math.max(0, p.y / top);
        return new V2(p.x, p.y + lift);
      });
      const browShape = [...sorted.map((p) => new V2(p.x, p.y - 0.4)).reverse(), ...outer];
      parts.frame.push(ringGeometry(ensureCcw(browShape), [], spec.thickness));
    } else {
      const outer = offsetOutline(lensEdge, spec.rim);
      parts.frame.push(ringGeometry(outer, lensEdge, spec.thickness));
    }

    // Slightly larger than the visible edge so the lens tucks under the rim.
    const lensShape = offsetOutline(lensEdge, metal ? spec.rim * 0.5 : 0.8);
    parts.lenses.push(lensGeometry(lensShape, side * centreX));

    // Hinge block and temple arm.
    const outerX = side * (centreX + halfWidth + rimOuter * 0.6);
    const hingeY = top * 0.42;
    const back = -spec.thickness / 2;
    if (metal) {
      parts.frame.push(new THREE.SphereGeometry(1.5, 16, 12).translate(outerX, hingeY, back));
    } else {
      parts.frame.push(new THREE.BoxGeometry(4.5, 7, 7).translate(outerX - side * 1.2, hingeY, back - 3));
    }
    const templeRadius = metal ? 0.85 : 1.5;
    const templePath = [
      new THREE.Vector3(outerX, hingeY, back - 2),
      new THREE.Vector3(outerX - side * 1, hingeY - 0.5, back - 40),
      new THREE.Vector3(outerX - side * 3, hingeY - 2, back - 90),
      new THREE.Vector3(outerX - side * 5, hingeY - 6, back - 118),
      new THREE.Vector3(outerX - side * 7, hingeY - 20, back - 134),
    ];
    parts.frame.push(tube(templePath, templeRadius, false, 48));

    if (spec.nosePads) {
      const padX = side * (spec.bridge / 2 + 1.5);
      const pad = new THREE.SphereGeometry(1, 16, 12);
      pad.scale(2.2, 3.4, 1.2);
      pad.rotateZ(side * 0.35);
      pad.translate(padX, -top * 0.28, -6);
      parts.pads.push(pad);
      parts.frame.push(
        tube(
          [
            new THREE.Vector3(side * (spec.bridge / 2 + 0.5), top * 0.05, -0.5),
            new THREE.Vector3(side * (spec.bridge / 2 + 1.8), -top * 0.15, -3.5),
            new THREE.Vector3(padX, -top * 0.24, -5.5),
          ],
          0.45,
          false,
          16,
        ),
      );
    }
  }

  // Bridge between the lenses.
  const bridgeY = top * 0.42;
  if (metal || spec.browline) {
    const half = spec.bridge / 2 + spec.rim;
    const bridge = tube(
      [
        new THREE.Vector3(-half, bridgeY - 1, 0),
        new THREE.Vector3(0, bridgeY + 2.4, 1.2),
        new THREE.Vector3(half, bridgeY - 1, 0),
      ],
      spec.browline ? 1.6 : spec.rim * 1.1,
      false,
      32,
    );
    parts.frame.push(bridge);
    if (spec.doubleBridge) {
      const barHalf = spec.bridge / 2 + halfWidth * 0.55;
      parts.frame.push(
        tube(
          [
            new THREE.Vector3(-barHalf, top + 0.6, 0),
            new THREE.Vector3(0, top + 2.2, 0.8),
            new THREE.Vector3(barHalf, top + 0.6, 0),
          ],
          spec.rim * 0.95,
          false,
          32,
        ),
      );
    }
  } else {
    // Acetate saddle bridge: a flat top with an arched underside.
    const half = spec.bridge / 2 + spec.rim * 0.8;
    const topY = bridgeY + spec.rim * 0.9;
    const underside: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const x = -half + (2 * half * i) / 16;
      const arch = 1 - (x / half) ** 2;
      underside.push(new V2(x, topY - spec.rim * 1.25 + arch * spec.rim * 0.55));
    }
    const shape = [...underside, new V2(half, topY), new V2(-half, topY)];
    parts.frame.push(ringGeometry(ensureCcw(shape), [], spec.thickness));
  }

  parts.frontWidth = 2 * (centreX + halfWidth + rimOuter);
  return parts;
}

function ensureCcw(points: THREE.Vector2[]): THREE.Vector2[] {
  return THREE.ShapeUtils.isClockWise(points) ? [...points].reverse() : points;
}

const cache = new Map<string, GlassesParts>();

/** Geometry is shared between every instance of a style; never dispose it. */
export function glassesParts(style: FrameStyle, material: FrameLook["material"]): GlassesParts {
  const key = `${style}:${material}`;
  let parts = cache.get(key);
  if (!parts) {
    parts = buildParts(style, material);
    cache.set(key, parts);
  }
  return parts;
}

// --- Materials --------------------------------------------------------------

let tortoise: THREE.CanvasTexture | null = null;

/** A hand-painted tortoiseshell pattern, generated once on a canvas. */
function tortoiseTexture(): THREE.CanvasTexture {
  if (tortoise) return tortoise;
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#2b1408";
  ctx.fillRect(0, 0, size, size);
  const tones = ["#6b3c1d", "#8a4f22", "#b06a2c", "#3b1d0b", "#c98a3e", "#5a2e12"];
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  ctx.filter = "blur(7px)";
  for (let i = 0; i < 140; i++) {
    const x = random() * size;
    const y = random() * size;
    const r = 12 + random() * 46;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = tones[Math.floor(random() * tones.length)];
    g.addColorStop(0, tone);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.55 + random() * 0.45;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + random() * 0.6), random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  tortoise = new THREE.CanvasTexture(canvas);
  tortoise.colorSpace = THREE.SRGBColorSpace;
  tortoise.wrapS = tortoise.wrapT = THREE.RepeatWrapping;
  tortoise.repeat.set(1 / 34, 1 / 34);
  tortoise.anisotropy = 4;
  return tortoise;
}

export interface GlassesMaterials {
  frame: THREE.Material;
  accent: THREE.Material;
  lens: THREE.Material;
  pad: THREE.Material;
}

const materialCache = new Map<string, GlassesMaterials>();

export function glassesMaterials(look: FrameLook): GlassesMaterials {
  const key = JSON.stringify(look);
  const cached = materialCache.get(key);
  if (cached) return cached;

  let frame: THREE.Material;
  if (look.material === "metal") {
    frame = new THREE.MeshStandardMaterial({
      color: look.frameColor,
      metalness: 1,
      roughness: 0.2,
      envMapIntensity: 1.3,
    });
  } else if (look.pattern === "tortoise") {
    frame = new THREE.MeshPhysicalMaterial({
      map: tortoiseTexture(),
      roughness: 0.24,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
  } else if (look.finish === "crystal") {
    frame = new THREE.MeshPhysicalMaterial({
      color: look.frameColor,
      roughness: 0.06,
      clearcoat: 1,
      transparent: true,
      opacity: 0.55,
      envMapIntensity: 1.6,
    });
  } else {
    const matte = look.finish === "matte";
    frame = new THREE.MeshPhysicalMaterial({
      color: look.frameColor,
      roughness: matte ? 0.62 : 0.28,
      clearcoat: matte ? 0 : 1,
      clearcoatRoughness: 0.12,
    });
  }

  const materials: GlassesMaterials = {
    frame,
    accent: new THREE.MeshStandardMaterial({
      color: look.accentColor ?? look.frameColor,
      metalness: 1,
      roughness: 0.22,
    }),
    lens: new THREE.MeshPhysicalMaterial({
      color: look.lensTint,
      transparent: true,
      opacity: look.lensOpacity,
      roughness: 0.03,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    pad: new THREE.MeshPhysicalMaterial({
      color: "#f3f5f7",
      transparent: true,
      opacity: 0.55,
      roughness: 0.15,
      clearcoat: 1,
    }),
  };
  materialCache.set(key, materials);
  return materials;
}
