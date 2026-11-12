import type { FaceShape } from "./types";

// Face-shape estimation from MediaPipe Face Landmarker output.
//
// Ratios are compared against MediaPipe's own canonical face mesh (an average
// adult face), so "1.0" below always means "typical". Values measured from
// canonical_face_model.obj:
//   length (10→152) / width (234→454)   = 1.1525
//   jaw    (172→397) / width             = 0.7751
//   brow   (54→284)  / width             = 0.8193

export interface LandmarkLike {
  x: number;
  y: number;
  z: number;
}

export const LM = {
  noseTip: 1,
  foreheadTop: 10,
  chin: 152,
  faceRight: 234, // subject's right cheek contour (image left before mirroring)
  faceLeft: 454,
  jawRight: 172,
  jawLeft: 397,
  browRight: 54,
  browLeft: 284,
  templeRight: 127,
  templeLeft: 356,
  eyeOuterRight: 33,
  eyeInnerRight: 133,
  eyeOuterLeft: 263,
  eyeInnerLeft: 362,
  noseBridge: 168,
  irisRightEdgeA: 469,
  irisRightEdgeB: 471,
  irisLeftEdgeA: 474,
  irisLeftEdgeB: 476,
} as const;

const CANONICAL = { lengthToWidth: 1.1525, jawToWidth: 0.7751, browToWidth: 0.8193 };

/** Average human iris diameter; a surprisingly stable ruler across adults. */
const IRIS_DIAMETER_MM = 11.7;

export interface FaceSample {
  lengthToWidth: number;
  jawToWidth: number;
  browToWidth: number;
  widthMm: number | null;
}

type Vec = { x: number; y: number; z: number };

function toPixels(lm: LandmarkLike, width: number, height: number): Vec {
  // MediaPipe's z uses roughly the same scale as x, so it is scaled by width.
  return { x: lm.x * width, y: lm.y * height, z: lm.z * width };
}

function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Measures one video frame. Returns null when the head is turned too far for
 * the proportions to be trustworthy.
 */
export function sampleFace(landmarks: readonly LandmarkLike[], width: number, height: number): FaceSample | null {
  if (landmarks.length < 468) return null;
  const p = (i: number) => toPixels(landmarks[i], width, height);

  const nose = p(LM.noseTip);
  const right = p(LM.faceRight);
  const left = p(LM.faceLeft);
  const yawBalance = Math.abs(nose.x - right.x) / Math.max(1e-6, Math.abs(left.x - nose.x));
  if (yawBalance < 0.78 || yawBalance > 1.28) return null;

  const faceWidth = dist(right, left);
  if (faceWidth < 40) return null; // face too small in frame to measure

  let widthMm: number | null = null;
  if (landmarks.length >= 478) {
    const iris =
      (dist(p(LM.irisRightEdgeA), p(LM.irisRightEdgeB)) + dist(p(LM.irisLeftEdgeA), p(LM.irisLeftEdgeB))) / 2;
    if (iris > 3) widthMm = (faceWidth / iris) * IRIS_DIAMETER_MM;
  }

  return {
    lengthToWidth: dist(p(LM.foreheadTop), p(LM.chin)) / faceWidth,
    jawToWidth: dist(p(LM.jawRight), p(LM.jawLeft)) / faceWidth,
    browToWidth: dist(p(LM.browRight), p(LM.browLeft)) / faceWidth,
    widthMm,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface FaceReading {
  shape: FaceShape;
  confidence: number;
  widthMm: number | null;
  /** Normalised ratios (1.0 = canonical average), useful for explaining the result. */
  ratios: { length: number; jaw: number; brow: number };
}

/** Combines many frames (median is robust to blinks and quick head turns). */
export function readFace(samples: readonly FaceSample[]): FaceReading | null {
  if (samples.length === 0) return null;
  const length = median(samples.map((s) => s.lengthToWidth)) / CANONICAL.lengthToWidth;
  const jaw = median(samples.map((s) => s.jawToWidth)) / CANONICAL.jawToWidth;
  const brow = median(samples.map((s) => s.browToWidth)) / CANONICAL.browToWidth;
  const widths = samples.map((s) => s.widthMm).filter((w): w is number => w !== null);
  const widthMm = widths.length >= 5 ? Math.round(median(widths)) : null;

  const { shape, margin } = classify(length, jaw, brow);
  // Margin is how far the deciding ratio sits past its threshold (0..~0.15).
  const steadiness = Math.min(1, samples.length / 24);
  const confidence = Math.min(0.95, 0.55 + margin * 2.2) * (0.8 + 0.2 * steadiness);

  return {
    shape,
    confidence: Math.round(confidence * 100) / 100,
    widthMm,
    ratios: { length: round2(length), jaw: round2(jaw), brow: round2(brow) },
  };
}

function classify(length: number, jaw: number, brow: number): { shape: FaceShape; margin: number } {
  if (length >= 1.08) return { shape: "oblong", margin: length - 1.08 };
  if (jaw >= 1.05 && length <= 1.03) return { shape: "square", margin: jaw - 1.05 };
  if (brow - jaw >= 0.08) return { shape: "heart", margin: brow - jaw - 0.08 };
  if (length <= 0.95 && jaw <= 1.02) return { shape: "round", margin: 0.95 - length };
  // Oval is the "close to average" case: the nearer to 1.0, the surer we are.
  const spread = Math.max(Math.abs(length - 1), Math.abs(jaw - 1), Math.abs(brow - 1));
  return { shape: "oval", margin: Math.max(0, 0.08 - spread) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
