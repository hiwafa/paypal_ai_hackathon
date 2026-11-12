import * as THREE from "three";

// Glow colours shared by the 3D scenes. Channels above 1.0 push a surface past
// the bloom threshold, so these read as light sources rather than paint.

export const LED_WARM = new THREE.Color(2.6, 2.05, 1.45);
export const LED_TEAL = new THREE.Color(0.55, 2.3, 2.0);
export const GOLD_GLOW = new THREE.Color(2.5, 1.85, 0.95);

/** A robot's accent colour, brightened so the bloom pass catches it. */
export function glowColor(accent: string, strength = 2.2): THREE.Color {
  return new THREE.Color(accent).multiplyScalar(strength);
}
