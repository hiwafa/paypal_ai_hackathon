"use client";

import { useEffect, useMemo, type Ref } from "react";
import * as THREE from "three";
import { GOLD_GLOW } from "./palette";
import { haloTexture } from "./textures";

/** Arch outline as a closed-bottom path: up, over the top, and down again. */
function archPoints(width: number, straight: number): THREE.Vector3[] {
  const r = width / 2;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) points.push(new THREE.Vector3(-r, (straight * i) / 8, 0));
  for (let i = 1; i < 40; i++) {
    const a = Math.PI - (Math.PI * i) / 40;
    points.push(new THREE.Vector3(Math.cos(a) * r, straight + Math.sin(a) * r, 0));
  }
  for (let i = 8; i >= 0; i--) points.push(new THREE.Vector3(r, (straight * i) / 8, 0));
  return points;
}

interface ArchPanelProps {
  width: number;
  /** Height of the straight sides below the round top. */
  straight: number;
  /** Height of the glow's brightest point above the bottom edge. */
  glowY: number;
  /** Colour at the heart of the glow. */
  accent: string;
  /** Panel brightness; above 1 feeds the bloom pass. */
  intensity?: number;
  /** Lets a parent animate the panel's brightness. */
  materialRef?: Ref<THREE.MeshBasicMaterial>;
}

/** A backlit arch with a thin gold outline, standing on the floor behind a robot. */
export function ArchPanel({ width, straight, glowY, accent, intensity = 1.2, materialRef }: ArchPanelProps) {
  const { panel, outline, halo } = useMemo(() => {
    const r = width / 2;
    const height = straight + r;
    const shape = new THREE.Shape();
    shape.moveTo(-r, 0);
    shape.lineTo(-r, straight);
    shape.absarc(0, straight, r, Math.PI, 0, true);
    shape.lineTo(r, 0);
    shape.closePath();
    const panelGeometry = new THREE.ShapeGeometry(shape, 48);
    // ShapeGeometry UVs are raw shape coordinates; normalise them to 0..1.
    const pos = panelGeometry.attributes.position;
    const uv = panelGeometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + r) / width, pos.getY(i) / height);
    uv.needsUpdate = true;

    const curve = new THREE.CatmullRomCurve3(archPoints(width, straight));
    return {
      panel: panelGeometry,
      outline: new THREE.TubeGeometry(curve, 240, 0.011, 8, false),
      halo: haloTexture(width, height, glowY, accent),
    };
  }, [width, straight, glowY, accent]);

  useEffect(
    () => () => {
      panel.dispose();
      outline.dispose();
      halo.dispose();
    },
    [panel, outline, halo],
  );

  return (
    <group>
      <mesh geometry={panel}>
        <meshBasicMaterial ref={materialRef} map={halo} color={[intensity, intensity, intensity]} toneMapped={false} />
      </mesh>
      <mesh geometry={outline} position-z={0.01}>
        <meshBasicMaterial color={GOLD_GLOW} toneMapped={false} />
      </mesh>
    </group>
  );
}
