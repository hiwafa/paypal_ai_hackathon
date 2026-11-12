"use client";

import { Environment, Lightformer, RoundedBox, Sparkles } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { ArchPanel } from "@/components/three/ArchPanel";
import { ceramic, FloorPlant, SmallPlant } from "@/components/three/Decor";
import { LED_TEAL, LED_WARM } from "@/components/three/palette";
import { ReflectiveFloor, type SceneQuality } from "@/components/three/ReflectiveFloor";
import { signTexture, useFlutes } from "@/components/three/textures";
import { STORE } from "@/lib/domain/catalog";
import { ARCH, COUNTER, DECOR_SLOTS, FLOOR_SIZE, SHELF_ROWS, SHELF_UNITS, SHELF_Z, WALL_Z } from "./layout";

// The static part of the boutique: room, shelves, counter and light.

export function BoutiqueRoom({ quality }: { quality: SceneQuality }) {
  return (
    <>
      <color attach="background" args={["#060608"]} />
      <fog attach="fog" args={["#060608", 9, 19]} />
      <Lights />
      <ReflectiveFloor size={FLOOR_SIZE} quality={quality} />
      <BackWall />
      <Arch />
      <Sign />
      {SHELF_UNITS.map((unit) => (
        <ShelfUnit key={unit.x} x={unit.x} />
      ))}
      {DECOR_SLOTS.map((decor) => (
        <group key={decor.kind} position={[decor.at[0], decor.at[1] - 0.143, SHELF_Z]}>
          {decor.kind === "plant" && <SmallPlant />}
          {decor.kind === "books" && <Books />}
          {decor.kind === "vase" && <Vase />}
        </group>
      ))}
      <Counter />
      <group position={[-1.22, COUNTER.height, COUNTER.z - 0.12]} scale={0.8}>
        <SmallPlant />
      </group>
      <FloorPlant position={[-2.25, 0, 1.0]} />
      <FloorPlant position={[2.4, 0, 0.85]} flip />
      <Sparkles
        count={70}
        scale={[8, 3.2, 4]}
        position={[0, 2, -0.4]}
        size={2.2}
        speed={0.22}
        opacity={0.45}
        color="#f6e7c8"
      />
    </>
  );
}

function Lights() {
  const key = useMemo(() => {
    const light = new THREE.SpotLight("#fff1df", 70, 0, 0.52, 0.85, 2);
    light.position.set(0.9, 4.4, 3.4);
    light.target.position.set(0, 1.25, -0.2);
    return light;
  }, []);

  return (
    <>
      <ambientLight intensity={0.28} />
      <primitive object={key} />
      <primitive object={key.target} />
      {/* Teal rim light from the arch, so Lumi's silhouette reads against the wall. */}
      <pointLight position={[0, 1.9, -1.35]} color="#5eead4" intensity={5} distance={3.6} decay={2} />
      {/* Warm pools over each shelf unit. */}
      <pointLight position={[-1.95, 2.95, -0.85]} color="#ffd6a3" intensity={7} distance={4} decay={2} />
      <pointLight position={[1.95, 2.95, -0.85]} color="#ffd6a3" intensity={7} distance={4} decay={2} />
      <directionalLight position={[-3, 3, 4]} intensity={0.45} color="#d7dcff" />
      <Environment resolution={256} frames={1} environmentIntensity={0.8}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4.5, 2]} rotation-x={Math.PI / 2} scale={[9, 1.4, 1]} />
        <Lightformer
          form="rect"
          intensity={1.3}
          color="#ffe2bd"
          position={[-5, 2, 1]}
          rotation-y={Math.PI / 2}
          scale={[3, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.1}
          color="#c4f1ea"
          position={[5, 2, 1]}
          rotation-y={-Math.PI / 2}
          scale={[3, 4, 1]}
        />
        <Lightformer form="ring" intensity={2.5} color="#5eead4" position={[0, 2, -6]} scale={2.4} />
        <Lightformer form="rect" intensity={0.6} position={[0, 1.5, 7]} scale={[6, 2, 1]} />
      </Environment>
    </>
  );
}

function BackWall() {
  const flutes = useFlutes(80);
  return (
    <group>
      <mesh position={[0, 2.8, WALL_Z]}>
        <planeGeometry args={[14, 5.6]} />
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
        <boxGeometry args={[14, 0.01, 0.01]} />
        <meshBasicMaterial color={LED_WARM} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Arch() {
  return (
    <group position={[0, 0, ARCH.z]}>
      <ArchPanel width={ARCH.width} straight={ARCH.straight} glowY={1.62} accent="#78f0de" />
    </group>
  );
}

function Sign() {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    let alive = true;
    let made: THREE.CanvasTexture | null = null;
    void signTexture("Mira", `Eyewear · ${STORE.city}`).then((t) => {
      made = t;
      if (alive) setTexture(t);
      else t.dispose();
    });
    return () => {
      alive = false;
      made?.dispose();
    };
  }, []);

  if (!texture) return null;
  return (
    <mesh position={[0, ARCH.straight + ARCH.width / 2 + 0.36, WALL_Z + 0.03]}>
      <planeGeometry args={[1.3, 1.3 * (360 / 1024)]} />
      <meshBasicMaterial map={texture} transparent color={[2.1, 1.65, 1.05]} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

function ShelfUnit({ x }: { x: number }) {
  return (
    <group position-x={x}>
      <mesh position={[0, 1.7, WALL_Z + 0.012]}>
        <planeGeometry args={[2.05, 1.8]} />
        <meshStandardMaterial color="#1e1924" roughness={0.6} />
      </mesh>
      {SHELF_ROWS.map((y) => (
        <group key={y} position={[0, y - 0.16, SHELF_Z - 0.02]}>
          <RoundedBox args={[1.82, 0.034, 0.3]} radius={0.012} smoothness={3}>
            <meshStandardMaterial color="#6e5038" roughness={0.48} />
          </RoundedBox>
          <mesh position={[0, -0.021, 0.12]}>
            <boxGeometry args={[1.72, 0.006, 0.012]} />
            <meshBasicMaterial color={LED_WARM} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Counter() {
  const flutes = useFlutes(46);
  const body = COUNTER.height - 0.05;
  return (
    <group position={[0, 0, COUNTER.z]}>
      <mesh position-y={body / 2}>
        <boxGeometry args={[COUNTER.width, body, COUNTER.depth]} />
        <meshStandardMaterial color="#1c1921" roughness={0.5} normalMap={flutes} normalScale={[0.8, 0.8]} />
      </mesh>
      <mesh position-y={body - 0.006}>
        <boxGeometry args={[COUNTER.width + 0.06, 0.012, COUNTER.depth + 0.06]} />
        <meshStandardMaterial color="#cfa64e" metalness={1} roughness={0.25} />
      </mesh>
      <RoundedBox
        args={[COUNTER.width + 0.12, 0.05, COUNTER.depth + 0.1]}
        radius={0.02}
        smoothness={3}
        position-y={COUNTER.height - 0.025}
      >
        <meshPhysicalMaterial color="#ece6dc" roughness={0.22} clearcoat={1} clearcoatRoughness={0.1} />
      </RoundedBox>
      <mesh position={[0, 0.03, COUNTER.depth / 2 + 0.008]}>
        <boxGeometry args={[COUNTER.width - 0.1, 0.01, 0.01]} />
        <meshBasicMaterial color={LED_TEAL} toneMapped={false} />
      </mesh>
    </group>
  );
}

// --- Decoration -------------------------------------------------------------

function Books() {
  const books = [
    { w: 0.34, h: 0.035, color: "#c9b79c", r: 0.02 },
    { w: 0.31, h: 0.03, color: "#2f3b4a", r: -0.05 },
    { w: 0.28, h: 0.04, color: "#8b4a3c", r: 0.06 },
  ];
  let y = 0;
  return (
    <group>
      {books.map((book) => {
        const at = y + book.h / 2;
        y += book.h;
        return (
          <mesh key={book.color} position-y={at} rotation-y={book.r}>
            <boxGeometry args={[book.w, book.h, 0.22]} />
            <meshStandardMaterial color={book.color} roughness={0.7} />
          </mesh>
        );
      })}
      <mesh position-y={y + 0.04}>
        <sphereGeometry args={[0.04, 24, 16]} />
        <meshStandardMaterial color="#cfa64e" metalness={1} roughness={0.2} />
      </mesh>
    </group>
  );
}

const vaseGeometry = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.05, 0.002),
    new THREE.Vector2(0.075, 0.05),
    new THREE.Vector2(0.07, 0.12),
    new THREE.Vector2(0.035, 0.2),
    new THREE.Vector2(0.03, 0.26),
    new THREE.Vector2(0.038, 0.28),
  ],
  40,
);

function Vase() {
  return (
    <group>
      <mesh geometry={vaseGeometry} material={ceramic} />
      {[-0.35, 0.05, 0.4].map((r) => (
        <mesh key={r} position={[Math.sin(r) * 0.06, 0.38, 0]} rotation-z={r}>
          <cylinderGeometry args={[0.003, 0.004, 0.26, 6]} />
          <meshStandardMaterial color="#8a6a48" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
