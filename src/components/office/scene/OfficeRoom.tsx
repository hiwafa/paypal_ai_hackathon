"use client";

import { Environment, Lightformer, Sparkles } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { FloorPlant, SmallPlant } from "@/components/three/Decor";
import { LED_WARM } from "@/components/three/palette";
import { ReflectiveFloor, type SceneQuality } from "@/components/three/ReflectiveFloor";
import { useFlutes } from "@/components/three/textures";
import { FLOOR_SIZE, STATION_X, WALL_Z } from "./layout";

// The static part of the back office: walls, floor, light and a few plants.
// It shares its materials and mood with the boutique, so the two read as one shop.

/** Warm light strips between and beside the three stations. */
const WALL_LIGHTS = [
  (STATION_X.penny + STATION_X.otto) / 2,
  (STATION_X.otto + STATION_X.kai) / 2,
  STATION_X.penny - 0.95,
  STATION_X.kai + 0.95,
];

export function OfficeRoom({ quality }: { quality: SceneQuality }) {
  return (
    <>
      <color attach="background" args={["#060608"]} />
      <fog attach="fog" args={["#060608", 7.5, 16]} />
      <Lights />
      <ReflectiveFloor size={FLOOR_SIZE} quality={quality} />
      <BackWall />
      {WALL_LIGHTS.map((x) => (
        <WallLight key={x} x={x} />
      ))}
      <FloorPlant position={[-3.35, 0, -0.45]} />
      <FloorPlant position={[3.4, 0, -0.55]} flip />
      <Shelf x={-3.05} />
      <Shelf x={3.05} />
      <Sparkles
        count={45}
        scale={[7, 2.4, 2.5]}
        position={[0, 1.6, -0.3]}
        size={2}
        speed={0.2}
        opacity={0.4}
        color="#f6e7c8"
      />
    </>
  );
}

function Lights() {
  const key = useMemo(() => {
    const light = new THREE.SpotLight("#fff1df", 60, 0, 0.72, 0.9, 2);
    light.position.set(0, 4.3, 3.8);
    light.target.position.set(0, 1.0, -0.3);
    return light;
  }, []);

  return (
    <>
      <ambientLight intensity={0.3} />
      <primitive object={key} />
      <primitive object={key.target} />
      <directionalLight position={[-3, 3, 4]} intensity={0.4} color="#d7dcff" />
      <Environment resolution={256} frames={1} environmentIntensity={0.75}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4.5, 2]} rotation-x={Math.PI / 2} scale={[9, 1.4, 1]} />
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#ffe2bd"
          position={[-5, 2, 1]}
          rotation-y={Math.PI / 2}
          scale={[3, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1}
          color="#ddd6ff"
          position={[5, 2, 1]}
          rotation-y={-Math.PI / 2}
          scale={[3, 4, 1]}
        />
        <Lightformer form="rect" intensity={0.6} position={[0, 1.5, 7]} scale={[6, 2, 1]} />
      </Environment>
    </>
  );
}

function BackWall() {
  const flutes = useFlutes(70);
  return (
    <group>
      <mesh position={[0, 2.4, WALL_Z]}>
        <planeGeometry args={[12, 4.8]} />
        <meshStandardMaterial
          color="#17131b"
          roughness={0.78}
          metalness={0.05}
          normalMap={flutes}
          normalScale={[0.9, 0.9]}
        />
      </mesh>
      {/* Skirting light where the wall meets the floor. */}
      <mesh position={[0, 0.02, WALL_Z + 0.02]}>
        <boxGeometry args={[12, 0.01, 0.01]} />
        <meshBasicMaterial color={LED_WARM} toneMapped={false} />
      </mesh>
    </group>
  );
}

function WallLight({ x }: { x: number }) {
  return (
    <group position={[x, 1.45, WALL_Z + 0.03]}>
      <mesh>
        <boxGeometry args={[0.014, 1.1, 0.01]} />
        <meshBasicMaterial color={LED_WARM} toneMapped={false} />
      </mesh>
      {/* A faint wash on the wall around the strip. */}
      <mesh position-z={-0.005}>
        <planeGeometry args={[0.5, 1.5]} />
        <meshBasicMaterial
          color="#ffcf9a"
          transparent
          opacity={0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** A floating wall shelf with binders and a small plant, at the room's edges. */
function Shelf({ x }: { x: number }) {
  const binders = ["#2f3b4a", "#c9b79c", "#8b4a3c", "#2f3b4a"];
  return (
    <group position={[x, 1.32, WALL_Z + 0.16]}>
      <mesh>
        <boxGeometry args={[0.72, 0.03, 0.26]} />
        <meshStandardMaterial color="#6e5038" roughness={0.48} />
      </mesh>
      {binders.map((color, i) => (
        // The last binder leans into the gap beside it.
        <mesh key={i} position={[-0.24 + i * 0.065 + (i === 3 ? 0.012 : 0), 0.13, 0]} rotation-z={i === 3 ? -0.16 : 0}>
          <boxGeometry args={[0.055, 0.23, 0.2]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
      ))}
      <group position={[0.2, 0.015, 0]} scale={0.85}>
        <SmallPlant />
      </group>
    </group>
  );
}
