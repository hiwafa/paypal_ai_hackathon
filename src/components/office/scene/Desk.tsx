"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SmallPlant } from "@/components/three/Decor";
import { glowColor } from "@/components/three/palette";
import { useFlutes } from "@/components/three/textures";
import { robotInFocus } from "@/lib/client/office";
import { ROBOTS } from "@/lib/domain/robots";
import { DESK, type CrewId } from "./layout";

// A crew desk: fluted body, stone top, a glowing keypad, and a few props that
// say what the robot does (a ledger and chart, coins and invoices, a parcel).

const gold = new THREE.MeshStandardMaterial({ color: "#cfa64e", metalness: 1, roughness: 0.25 });
const paper = new THREE.MeshStandardMaterial({ color: "#efe9df", roughness: 0.85 });
const coin = new THREE.MeshStandardMaterial({ color: "#e8c98e", metalness: 1, roughness: 0.28 });
const coinGeometry = new THREE.CylinderGeometry(0.034, 0.034, 0.009, 28);

/** Props stand at the desk's front corners, clear of the robot's hands. */
const LEFT: [number, number, number] = [-0.43, DESK.top, 0.1];
const RIGHT: [number, number, number] = [0.43, DESK.top, 0.1];

export function Desk({ id }: { id: CrewId }) {
  const accent = ROBOTS[id].accent;
  const flutes = useFlutes(28);
  const strip = useMemo(() => glowColor(accent, 2.4), [accent]);
  const body = DESK.top - 0.045;

  return (
    <group position-z={DESK.z}>
      <mesh position-y={body / 2}>
        <boxGeometry args={[DESK.width, body, DESK.depth]} />
        <meshStandardMaterial color="#1c1921" roughness={0.5} normalMap={flutes} normalScale={[0.8, 0.8]} />
      </mesh>
      <mesh position-y={body - 0.006} material={gold}>
        <boxGeometry args={[DESK.width + 0.05, 0.012, DESK.depth + 0.05]} />
      </mesh>
      <RoundedBox
        args={[DESK.width + 0.1, 0.045, DESK.depth + 0.08]}
        radius={0.018}
        smoothness={3}
        position-y={DESK.top - 0.0225}
      >
        <meshPhysicalMaterial color="#ece6dc" roughness={0.22} clearcoat={1} clearcoatRoughness={0.1} />
      </RoundedBox>
      {/* Accent light along the foot of the desk. */}
      <mesh position={[0, 0.03, DESK.depth / 2 + 0.008]}>
        <boxGeometry args={[DESK.width - 0.1, 0.01, 0.01]} />
        <meshBasicMaterial color={strip} toneMapped={false} />
      </mesh>
      {/* The holographic keypad the robot types on while it works. */}
      <mesh position={[0, DESK.top + 0.003, -0.15]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.52, 0.15]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {id === "penny" && (
        <>
          <LedgerBook />
          <HoloChart id={id} />
        </>
      )}
      {id === "otto" && (
        <>
          <CoinStacks />
          <Invoices />
        </>
      )}
      {id === "kai" && (
        <>
          <group position={LEFT} scale={0.75}>
            <SmallPlant />
          </group>
          <Parcel accent={accent} />
        </>
      )}
    </group>
  );
}

function LedgerBook() {
  return (
    <group position={LEFT} rotation-y={0.28}>
      <RoundedBox args={[0.26, 0.036, 0.19]} radius={0.008} smoothness={2} position-y={0.018}>
        <meshStandardMaterial color="#2f4a3c" roughness={0.6} />
      </RoundedBox>
      <mesh position={[0.004, 0.018, 0]} material={paper}>
        <boxGeometry args={[0.255, 0.026, 0.18]} />
      </mesh>
      <mesh position={[-0.09, 0.0365, 0]} material={gold}>
        <boxGeometry args={[0.012, 0.002, 0.19]} />
      </mesh>
    </group>
  );
}

const CHART_BARS = [0.07, 0.11, 0.09, 0.15];

/** Penny's little hologram of the week's takings; it jumps when she books a sale. */
function HoloChart({ id }: { id: CrewId }) {
  const bars = useRef<Array<THREE.Mesh | null>>([]);
  const lift = useRef(0);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: glowColor(ROBOTS[id].accent, 1.6),
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [id],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    lift.current = THREE.MathUtils.damp(lift.current, robotInFocus() === id ? 1 : 0, 3, delta);
    bars.current.forEach((bar, i) => {
      if (!bar) return;
      const height = CHART_BARS[i] * (1 + 0.12 * Math.sin(t * 1.4 + i * 1.7) + lift.current * (i === 3 ? 0.9 : 0.25));
      bar.scale.y = height;
      bar.position.y = 0.014 + height / 2;
    });
  });

  return (
    <group position={RIGHT}>
      <mesh position-y={0.006}>
        <cylinderGeometry args={[0.11, 0.12, 0.012, 32]} />
        <meshStandardMaterial color="#121117" metalness={0.6} roughness={0.35} />
      </mesh>
      {CHART_BARS.map((_, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            bars.current[i] = mesh;
          }}
          material={material}
          position-x={-0.06 + i * 0.04}
        >
          <boxGeometry args={[0.024, 1, 0.024]} />
        </mesh>
      ))}
    </group>
  );
}

function CoinStacks() {
  const stacks = [
    { x: -0.06, z: 0.02, count: 7 },
    { x: 0.03, z: -0.03, count: 11 },
    { x: 0.09, z: 0.05, count: 4 },
  ];
  return (
    <group position={LEFT}>
      {stacks.map((stack) =>
        Array.from({ length: stack.count }, (_, i) => (
          <mesh
            key={`${stack.x}-${i}`}
            geometry={coinGeometry}
            material={coin}
            position={[stack.x + Math.sin(i * 2.3) * 0.002, 0.0045 + i * 0.0095, stack.z]}
          />
        )),
      )}
    </group>
  );
}

function Invoices() {
  return (
    <group position={RIGHT}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={paper} position-y={0.003 + i * 0.005} rotation-y={-0.2 + i * 0.16}>
          <boxGeometry args={[0.17, 0.004, 0.22]} />
        </mesh>
      ))}
      <mesh material={gold} position={[0.03, 0.02, 0.06]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.006, 0.006, 0.12, 12]} />
      </mesh>
    </group>
  );
}

function Parcel({ accent }: { accent: string }) {
  return (
    <group position={RIGHT} rotation-y={-0.22}>
      <RoundedBox args={[0.22, 0.15, 0.17]} radius={0.01} smoothness={2} position-y={0.075}>
        <meshStandardMaterial color="#b88a5a" roughness={0.85} />
      </RoundedBox>
      <mesh position-y={0.0755}>
        <boxGeometry args={[0.03, 0.152, 0.172]} />
        <meshStandardMaterial color={accent} roughness={0.5} />
      </mesh>
      <mesh position-y={0.0755}>
        <boxGeometry args={[0.222, 0.152, 0.03]} />
        <meshStandardMaterial color={accent} roughness={0.5} />
      </mesh>
    </group>
  );
}
