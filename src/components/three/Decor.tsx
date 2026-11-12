"use client";

import * as THREE from "three";

// Plants and ceramics shared by the boutique and the back office.

export const ceramic = new THREE.MeshPhysicalMaterial({ color: "#efebe4", roughness: 0.35, clearcoat: 0.6 });
const leafGreen = new THREE.MeshStandardMaterial({ color: "#3d7a4c", roughness: 0.55 });
const darkLeaf = new THREE.MeshStandardMaterial({ color: "#2c5e3a", roughness: 0.6 });
const leafGeometry = new THREE.SphereGeometry(1, 16, 12);

/** A small potted plant for shelves and desks. */
export function SmallPlant() {
  const leaves = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i / 6) * Math.PI * 2;
    return { a, tilt: 0.45 + (i % 2) * 0.25 };
  });
  return (
    <group>
      <mesh material={ceramic} position-y={0.07}>
        <cylinderGeometry args={[0.075, 0.06, 0.14, 32]} />
      </mesh>
      {leaves.map(({ a, tilt }) => (
        <group key={a} position-y={0.13} rotation-y={a}>
          <mesh
            geometry={leafGeometry}
            material={leafGreen}
            rotation-x={tilt}
            position={[0, 0.07, 0.035]}
            scale={[0.032, 0.1, 0.01]}
          />
        </group>
      ))}
    </group>
  );
}

/** A tall plant in a ceramic pot that stands on the floor. */
export function FloorPlant({ position, flip = false }: { position: [number, number, number]; flip?: boolean }) {
  const leaves = [0, 1, 2, 3, 4, 5, 6].map((i) => ({
    a: (i / 7) * Math.PI * 2 + (flip ? 0.4 : 0),
    tilt: 0.35 + (i % 3) * 0.18,
    lift: 0.75 + (i % 2) * 0.25,
  }));
  return (
    <group position={position}>
      <mesh material={ceramic} position-y={0.22}>
        <cylinderGeometry args={[0.2, 0.16, 0.44, 40]} />
      </mesh>
      <mesh position-y={0.45}>
        <cylinderGeometry args={[0.012, 0.016, 0.5, 8]} />
        <meshStandardMaterial color="#4b3a2a" />
      </mesh>
      {leaves.map(({ a, tilt, lift }, i) => (
        <group key={a} position-y={0.4 + lift * 0.35} rotation-y={a}>
          <mesh
            geometry={leafGeometry}
            material={i % 2 ? leafGreen : darkLeaf}
            rotation-x={tilt}
            position={[0, 0.18, 0.12]}
            scale={[0.11, 0.26, 0.018]}
          />
        </group>
      ))}
    </group>
  );
}
