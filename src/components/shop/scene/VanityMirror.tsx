"use client";

import { Html, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { openMirror } from "@/lib/client/lumi";
import { useShop } from "@/lib/client/shopStore";
import { VANITY_POSITION } from "./layout";

// A small oval mirror on the counter. It shimmers softly, glows while the
// magic mirror is open, and opens it when clicked.

const RADIUS = { x: 0.14, y: 0.2 };

const gold = new THREE.MeshStandardMaterial({ color: "#cfa64e", metalness: 1, roughness: 0.22 });

function ovalRim(): THREE.TubeGeometry {
  const points = Array.from({ length: 96 }, (_, i) => {
    const a = (i / 96) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * RADIUS.x, Math.sin(a) * RADIUS.y, 0);
  });
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 160, 0.009, 10, true);
}

export function VanityMirror() {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const glass = useRef<THREE.MeshPhysicalMaterial>(null);
  const rim = useMemo(() => ovalRim(), []);
  useEffect(() => () => rim.dispose(), [rim]);

  useFrame((state, delta) => {
    if (!glass.current) return;
    const open = useShop.getState().mirror !== "closed";
    const t = state.clock.elapsedTime;
    const target = open ? 0.95 + Math.sin(t * 3) * 0.15 : hovered ? 0.5 : 0.14 + Math.sin(t * 1.4) * 0.06;
    glass.current.emissiveIntensity = THREE.MathUtils.damp(
      glass.current.emissiveIntensity,
      target,
      4,
      Math.min(delta, 0.05),
    );
  });

  return (
    <group
      position={VANITY_POSITION}
      rotation-y={-0.35}
      onPointerOver={(event) => {
        event.stopPropagation();
        if (useShop.getState().entered) setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(event) => {
        event.stopPropagation();
        if (useShop.getState().entered) openMirror();
      }}
    >
      <mesh material={gold} position-y={0.012}>
        <cylinderGeometry args={[0.085, 0.095, 0.024, 40]} />
      </mesh>
      <mesh material={gold} position-y={0.09}>
        <cylinderGeometry args={[0.007, 0.007, 0.15, 12]} />
      </mesh>
      <group position-y={0.36} rotation-x={-0.08}>
        <mesh scale={[RADIUS.x, RADIUS.y, 1]}>
          <circleGeometry args={[1, 64]} />
          <meshPhysicalMaterial
            ref={glass}
            color="#a9c3cf"
            metalness={1}
            roughness={0.04}
            emissive="#5eead4"
            emissiveIntensity={0.14}
            envMapIntensity={1.6}
          />
        </mesh>
        <mesh geometry={rim} material={gold} />
        <mesh scale={[RADIUS.x + 0.004, RADIUS.y + 0.004, 1]} position-z={-0.004} rotation-y={Math.PI}>
          <circleGeometry args={[1, 64]} />
          <meshStandardMaterial color="#1c1921" />
        </mesh>
      </group>
      {hovered && (
        <Html center position={[0, 0.66, 0]} zIndexRange={[30, 10]} pointerEvents="none">
          <div className="glass animate-rise whitespace-nowrap rounded-full px-3 py-1.5 text-xs text-white">
            Magic mirror · try frames on
          </div>
        </Html>
      )}
    </group>
  );
}
