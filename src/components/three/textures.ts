import { useMemo } from "react";
import * as THREE from "three";

// Small procedural textures, drawn on a canvas so the 3D scenes need no image
// downloads.

let fluted: THREE.CanvasTexture | null = null;

/** A normal map of soft vertical flutes, used on the back wall and the counter. */
export function flutedNormalMap(): THREE.CanvasTexture {
  if (fluted) return fluted;
  const width = 64;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = 1;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(width, 1);
  for (let x = 0; x < width; x++) {
    const nx = Math.sin((x / width) * Math.PI * 2) * 0.55;
    const nz = Math.sqrt(1 - nx * nx);
    image.data[x * 4] = (nx * 0.5 + 0.5) * 255;
    image.data[x * 4 + 1] = 128;
    image.data[x * 4 + 2] = (nz * 0.5 + 0.5) * 255;
    image.data[x * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  fluted = new THREE.CanvasTexture(canvas);
  fluted.wrapS = fluted.wrapT = THREE.RepeatWrapping;
  return fluted;
}

/** The fluted normal map, repeated `repeat` times across a surface. */
export function useFlutes(repeat: number): THREE.CanvasTexture {
  return useMemo(() => {
    const texture = flutedNormalMap().clone();
    texture.repeat.set(repeat, 1);
    texture.needsUpdate = true;
    return texture;
  }, [repeat]);
}

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * A soft glow on a dark panel, brightest `centreY` metres above the bottom
 * edge and fading through violet into the dark: the halo behind a robot.
 */
export function haloTexture(width: number, height: number, centreY: number, accent: string): THREE.CanvasTexture {
  const [r, g, b] = rgb(accent);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = Math.round((256 * height) / width);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b0a10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cy = canvas.height * (1 - centreY / height);
  const glow = ctx.createRadialGradient(128, cy, 0, 128, cy, canvas.height * 0.62);
  glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`);
  glow.addColorStop(0.28, `rgba(${Math.round(r * 0.55)}, ${Math.round(g * 0.6)}, ${Math.round(b * 0.7)}, 0.5)`);
  glow.addColorStop(0.62, "rgba(60, 38, 110, 0.32)");
  glow.addColorStop(1, "rgba(11, 10, 16, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The family name next/font registered for a CSS variable, e.g. Instrument Serif. */
function cssFontFamily(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

/**
 * The shop sign: "Mira" in the display serif with a spaced subtitle. White on
 * transparent, so the material colour decides how warm and bright it glows.
 */
export async function signTexture(title: string, subtitle: string): Promise<THREE.CanvasTexture> {
  const serif = cssFontFamily("--font-instrument-serif", "Georgia, serif");
  const sans = cssFontFamily("--font-geist-sans", "system-ui, sans-serif");
  const titleFont = `italic 400 210px ${serif}`;
  const subtitleFont = `500 34px ${sans}`;
  try {
    await Promise.all([document.fonts.load(titleFont, title), document.fonts.load(subtitleFont, subtitle)]);
  } catch {
    // Fall back to whatever the browser has; the sign still reads fine.
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 360;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = titleFont;
  ctx.fillText(title, 512, 205);
  ctx.font = subtitleFont;
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "14px";
  ctx.globalAlpha = 0.85;
  ctx.fillText(subtitle.toUpperCase(), 512, 300);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
