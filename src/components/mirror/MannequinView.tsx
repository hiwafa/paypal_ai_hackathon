"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { GlassesModel } from "@/components/three/GlassesModel";
import type { Product } from "@/lib/domain/types";

// The camera-free fallback: a ceramic display head wearing the frame.
// Everything is in millimetres, like the glasses. The origin is the centre of
// the head at eye level; the face looks down +z.

/** Half-width, half-height (up / down) and half-depth of the head. */
const HEAD = { x: 70, up: 114, down: 106, z: 96 };
/** Lenses sit about 12 mm in front of the face. */
const GLASSES_POSITION: [number, number, number] = [0, 2, HEAD.z + 11];

/**
 * A head shaped from a sphere, ring by ring: a round crown above the eyes, and
 * below them a U-shaped jaw that narrows and leans forward into a soft chin.
 */
function headGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, 96, 72);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const t = v.y; // -1 at the chin, +1 at the crown
    const ring = Math.sqrt(Math.max(0, 1 - t * t));
    // Direction around the ring (undefined at the poles, where the ring is a point).
    const cx = ring > 1e-6 ? v.x / ring : 0;
    const cz = ring > 1e-6 ? v.z / ring : 0;
    let width = ring;
    let depth = ring;
    let forward = 0;
    if (t < 0) {
      const d = -t;
      const jaw = Math.pow(1 - Math.pow(d, 2.6), 1 / 2.6); // fuller than a circle, so the chin stays broad
      width = jaw * (1 - 0.32 * d * d);
      depth = jaw * (1 - 0.22 * d * d);
      forward = 12 * d * d;
    }
    position.setXYZ(i, cx * HEAD.x * width, t * (t > 0 ? HEAD.up : HEAD.down), cz * HEAD.z * depth + forward);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export default function MannequinView({ product }: { product: Product | null }) {
  return (
    <Canvas camera={{ position: [0, -12, 600], fov: 30, near: 10, far: 3000 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={["#0d0c12"]} />
      <fog attach="fog" args={["#0d0c12", 650, 1100]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[260, 320, 420]} intensity={2.4} color="#fff4e8" />
      <directionalLight position={[-320, 120, -260]} intensity={2.2} color="#5eead4" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 5, 4]} scale={[10, 2, 1]} />
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#ffe4c4"
          position={[-5, 1, 2]}
          rotation-y={Math.PI / 2}
          scale={[4, 4, 1]}
        />
        <Lightformer form="ring" intensity={1.4} color="#5eead4" position={[4, 1, -3]} scale={2} />
      </Environment>
      <Bust product={product} />
      <ContactShadows position={[0, -235, 0]} opacity={0.5} scale={420} blur={2.6} far={120} color="#000000" />
    </Canvas>
  );
}

function Bust({ product }: { product: Product | null }) {
  const turn = useRef<THREE.Group>(null);
  const head = useMemo(() => headGeometry(), []);
  const skin = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#ece4d9",
        roughness: 0.48,
        clearcoat: 0.35,
        clearcoatRoughness: 0.5,
        sheen: 0.5,
        sheenColor: "#ffffff",
      }),
    [],
  );

  useFrame((state) => {
    if (!turn.current) return;
    const t = state.clock.elapsedTime;
    // A slow, curious turn so the frame is seen from a few angles.
    turn.current.rotation.y = Math.sin(t * 0.45) * 0.5;
    turn.current.rotation.x = Math.sin(t * 0.31) * 0.04;
  });

  return (
    <group>
      {/* Neck and a soft pedestal stay still while the head turns. */}
      <mesh material={skin} position={[0, -165, -18]}>
        <cylinderGeometry args={[36, 44, 150, 48]} />
      </mesh>
      <mesh material={skin} position={[0, -236, -18]}>
        <cylinderGeometry args={[62, 66, 8, 64]} />
      </mesh>

      <group ref={turn}>
        <mesh geometry={head} material={skin} />
        {/* Nose: a narrow ridge that the frame's bridge can rest on. */}
        <mesh material={skin} position={[0, -16, HEAD.z - 4]} rotation-x={-0.28} scale={[10.5, 27, 18]}>
          <sphereGeometry args={[1, 40, 28]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            material={skin}
            position={[side * (HEAD.x - 2), -16, -6]}
            rotation={[0, side * 0.35, side * -0.08]}
            scale={[7, 29, 16]}
          >
            <sphereGeometry args={[1, 28, 20]} />
          </mesh>
        ))}
        {product && (
          <GlassesModel key={product.id} product={product} position={GLASSES_POSITION} scale={product.look.fitScale} />
        )}
      </group>
    </group>
  );
}
