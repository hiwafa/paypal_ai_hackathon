"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { mouth } from "@/lib/client/speech";
import type { Mood } from "@/lib/domain/stylist";
import type { RobotId } from "@/lib/domain/types";
import { ROBOTS } from "@/lib/domain/robots";

// One friendly robot, built from primitives and animated procedurally.
// Behaviour comes from a `drive` function that is read every frame, so state
// changes (mood, gestures, speech) never cause React re-renders of the model.

import type { RobotActivity, RobotGesture } from "@/lib/domain/robots";

export type { RobotActivity, RobotGesture };

export interface RobotDrive {
  mood: Mood;
  activity: RobotActivity;
  gesture: { kind: RobotGesture; at: number };
  /** World-space point to look at; null lets the robot glance around. */
  lookAt: THREE.Vector3 | null;
  /** performance.now() when the entrance should start; 0 = not yet. */
  enterAt?: number;
}

interface RobotModelProps {
  id: RobotId;
  drive: () => RobotDrive;
  position?: [number, number, number];
  rotationY?: number;
  scale?: number;
  entrance?: boolean;
}

const GESTURE_MS: Record<RobotGesture, number> = {
  none: 0,
  wave: 2600,
  present: 1700,
  celebrate: 1600,
  stamp: 1300,
};

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const damp = THREE.MathUtils.damp;

function torsoGeometry() {
  const profile = new THREE.SplineCurve([
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.14, 0.006),
    new THREE.Vector2(0.23, 0.055),
    new THREE.Vector2(0.275, 0.15),
    new THREE.Vector2(0.285, 0.27),
    new THREE.Vector2(0.265, 0.39),
    new THREE.Vector2(0.21, 0.48),
    new THREE.Vector2(0.13, 0.535),
    new THREE.Vector2(0.05, 0.556),
    new THREE.Vector2(0.0, 0.56),
  ]).getPoints(48);
  const geometry = new THREE.LatheGeometry(profile, 64);
  geometry.scale(1, 1, 0.84);
  return geometry;
}

export function RobotModel({
  id,
  drive,
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  entrance = false,
}: RobotModelProps) {
  const profile = ROBOTS[id];

  const geo = useMemo(
    () => ({
      torso: torsoGeometry(),
      head: new THREE.SphereGeometry(0.25, 48, 32).scale(1.16, 0.94, 1),
      visor: new THREE.SphereGeometry(0.2532, 48, 24, Math.PI / 2 - 0.95, 1.9, Math.PI / 2 - 0.5, 1.04).scale(
        1.16,
        0.94,
        1,
      ),
      eye: new THREE.CapsuleGeometry(0.026, 0.036, 6, 14),
      eyeArc: new THREE.TorusGeometry(0.03, 0.009, 8, 22, Math.PI),
      smile: new THREE.TorusGeometry(0.032, 0.006, 8, 22, Math.PI),
      bar: new THREE.BoxGeometry(0.011, 0.03, 0.006),
      cheek: new THREE.CircleGeometry(0.02, 20),
      ear: new THREE.CylinderGeometry(0.055, 0.055, 0.05, 32),
      earRing: new THREE.TorusGeometry(0.04, 0.007, 10, 32),
      antenna: new THREE.CylinderGeometry(0.008, 0.008, 0.11, 10),
      bulb: new THREE.SphereGeometry(0.026, 20, 16),
      neck: new THREE.CylinderGeometry(0.05, 0.06, 0.07, 24),
      collar: new THREE.TorusGeometry(0.115, 0.013, 12, 40),
      chest: new THREE.CircleGeometry(0.045, 32),
      chestRing: new THREE.TorusGeometry(0.058, 0.007, 10, 40),
      hand: new THREE.SphereGeometry(0.075, 28, 20).scale(0.9, 1.08, 0.78),
      thruster: new THREE.TorusGeometry(0.15, 0.012, 12, 48),
      glow: new THREE.CircleGeometry(0.24, 40),
    }),
    [],
  );

  const mat = useMemo(() => {
    const accent = new THREE.Color(profile.accent);
    return {
      shell: new THREE.MeshPhysicalMaterial({
        color: profile.shell,
        roughness: 0.3,
        metalness: 0.04,
        clearcoat: 1,
        clearcoatRoughness: 0.16,
        iridescence: 0.28,
        iridescenceIOR: 1.32,
        sheen: 0.4,
        sheenColor: accent.clone().lerp(new THREE.Color("#ffffff"), 0.5),
      }),
      dark: new THREE.MeshStandardMaterial({ color: "#1b1d24", roughness: 0.45, metalness: 0.5 }),
      visor: new THREE.MeshPhysicalMaterial({
        color: "#06070a",
        roughness: 0.12,
        metalness: 0.4,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
      }),
      // Values above 1 push the glow past the bloom threshold.
      glow: new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(2.4), toneMapped: false }),
      softGlow: new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      bulb: new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(2), toneMapped: false }),
      cheek: new THREE.MeshBasicMaterial({
        color: "#ff8fab",
        transparent: true,
        opacity: 0,
        toneMapped: false,
        depthWrite: false,
      }),
    };
  }, [profile]);

  const root = useRef<THREE.Group>(null);
  const hover = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const pillEyes = useRef<THREE.Group>(null);
  const arcEyes = useRef<THREE.Group>(null);
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);
  const bars = useRef<THREE.Group>(null);
  const smile = useRef<THREE.Mesh>(null);
  const handL = useRef<THREE.Group>(null);
  const handR = useRef<THREE.Group>(null);

  const anim = useRef({ nextBlink: 0, blinkAt: -1000, mouth: 0 });
  const cheek = useRef<THREE.Mesh>(null);
  const bulb = useRef<THREE.Mesh>(null);
  const scratch = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const d = drive();
    const t = state.clock.elapsedTime;
    const now = performance.now();
    const dt = Math.min(delta, 0.05);
    if (!root.current || !hover.current || !body.current || !head.current) return;

    // Entrance: glide forward from behind the counter.
    if (entrance) {
      const k = d.enterAt ? THREE.MathUtils.clamp((now - d.enterAt) / 1700, 0, 1) : 0;
      const e = easeOutCubic(k);
      root.current.position.set(position[0], position[1] - 0.22 * (1 - e), position[2] - 0.9 * (1 - e));
    }

    const gestureAge = now - d.gesture.at;
    const gestureLength = GESTURE_MS[d.gesture.kind];
    const gesturing = d.gesture.kind !== "none" && gestureAge >= 0 && gestureAge < gestureLength;
    const gesture = gesturing ? d.gesture.kind : "none";
    const gp = gesturing ? gestureAge / gestureLength : 0;
    const envelope = Math.sin(Math.min(1, gp) * Math.PI); // 0 → 1 → 0

    // Hover and breathing.
    const jump = gesture === "celebrate" ? Math.abs(Math.sin(gp * Math.PI * 3)) * 0.07 * envelope : 0;
    const working = d.activity === "working";
    hover.current.position.y = Math.sin(t * 1.7) * 0.022 + jump + (working ? 0.03 : 0);
    body.current.rotation.z = Math.sin(t * 0.9) * 0.02;
    body.current.scale.y = 1 + Math.sin(t * 1.25) * 0.007;

    // Where to look.
    let yaw = Math.sin(t * 0.37) * 0.22 + Math.sin(t * 0.83 + 1.3) * 0.07;
    let pitch = Math.sin(t * 0.51) * 0.05;
    let roll = 0;
    if (d.lookAt) {
      const to = scratch.current.copy(d.lookAt);
      head.current.parent!.worldToLocal(to);
      to.sub(head.current.position);
      yaw = Math.atan2(to.x, to.z);
      pitch = -Math.atan2(to.y, Math.hypot(to.x, to.z));
      yaw += Math.sin(t * 0.6) * 0.03;
    }
    if (d.activity === "thinking") {
      yaw = 0.32 + Math.sin(t * 1.6) * 0.07;
      pitch = -0.2;
    } else if (d.activity === "listening") {
      roll = 0.13;
      pitch += 0.05;
    } else if (working) {
      pitch = 0.32;
      yaw = Math.sin(t * 2.2) * 0.12;
    }
    if (gesture === "stamp") pitch = 0.42;
    yaw = THREE.MathUtils.clamp(yaw, -0.75, 0.75);
    pitch = THREE.MathUtils.clamp(pitch, -0.35, 0.45);
    head.current.rotation.y = damp(head.current.rotation.y, yaw, 4, dt);
    head.current.rotation.x = damp(head.current.rotation.x, pitch, 4, dt);
    head.current.rotation.z = damp(head.current.rotation.z, roll + Math.sin(t * 0.7) * 0.02, 3, dt);
    body.current.rotation.y = damp(body.current.rotation.y, yaw * 0.22, 2, dt);

    // Blinking.
    if (now > anim.current.nextBlink) {
      anim.current.blinkAt = now;
      anim.current.nextBlink = now + 2200 + Math.random() * 3800;
    }
    const bk = (now - anim.current.blinkAt) / 150;
    const blink = bk >= 0 && bk < 1 ? 1 - Math.sin(bk * Math.PI) * 0.92 : 1;

    // Expression.
    const joyful = d.mood === "excited" || gesture === "celebrate";
    if (pillEyes.current && arcEyes.current && leftEye.current && rightEye.current && eyes.current) {
      pillEyes.current.visible = !joyful;
      arcEyes.current.visible = joyful;
      const soft = d.mood === "caring" ? 0.78 : 1;
      const curious = d.mood === "curious" ? 0.12 : 0;
      leftEye.current.scale.y = blink * soft * (1 + curious);
      rightEye.current.scale.y = blink * soft * (1 - curious * 0.6);
      arcEyes.current.scale.y = blink;
      const lookUp = d.activity === "thinking" ? 0.012 : 0;
      eyes.current.position.x = damp(eyes.current.position.x, d.activity === "thinking" ? 0.012 : 0, 6, dt);
      eyes.current.position.y = damp(eyes.current.position.y, lookUp, 6, dt);
    }
    // Both cheeks share one material, so updating it through either mesh is enough.
    const blush = cheek.current?.material as THREE.MeshBasicMaterial | undefined;
    if (blush) blush.opacity = damp(blush.opacity, joyful || d.mood === "happy" ? 0.38 : 0, 4, dt);

    // Mouth: equaliser bars while speaking, a small smile otherwise.
    const speaking = mouth.speaking && mouth.speaker === id;
    if (speaking) mouth.level = Math.max(0, mouth.level - dt * 3.2);
    anim.current.mouth = damp(anim.current.mouth, speaking ? mouth.level : 0, 18, dt);
    if (bars.current && smile.current) {
      bars.current.visible = speaking;
      smile.current.visible = !speaking;
      bars.current.children.forEach((bar, i) => {
        const shape = 1 - Math.abs(i - 2) * 0.2;
        const wiggle = 0.65 + 0.35 * Math.sin(t * 19 + i * 1.9);
        bar.scale.y = 0.3 + anim.current.mouth * 1.5 * shape * wiggle;
      });
    }

    // Antenna glow says "thinking".
    const pulse =
      d.activity === "thinking"
        ? 1.6 + Math.sin(t * 9) * 1.1
        : d.activity === "listening"
          ? 2.2
          : working
            ? 1.5 + Math.sin(t * 5) * 0.6
            : 1 + Math.sin(t * 2) * 0.15;
    (bulb.current?.material as THREE.MeshBasicMaterial | undefined)?.color.set(profile.accent).multiplyScalar(pulse);

    // Hands.
    if (handL.current && handR.current) {
      const restL = { x: -0.43, y: 0.27 + Math.sin(t * 1.3) * 0.015, z: 0.1, rz: 0.2 };
      const restR = { x: 0.43, y: 0.27 + Math.sin(t * 1.3 + 1) * 0.015, z: 0.1, rz: -0.2 };
      let L = restL;
      let R = restR;
      if (gesture === "wave") {
        L = { x: -0.42, y: 0.78, z: 0.14, rz: 0.35 + Math.sin(t * 11) * 0.45 };
      } else if (gesture === "present") {
        L = { x: -0.5, y: 0.4, z: 0.34, rz: 0.9 };
        R = { x: 0.5, y: 0.4, z: 0.34, rz: -0.9 };
      } else if (gesture === "celebrate") {
        L = { x: -0.38, y: 0.9 + Math.sin(t * 14) * 0.03, z: 0.1, rz: 0.3 };
        R = { x: 0.38, y: 0.9 + Math.cos(t * 14) * 0.03, z: 0.1, rz: -0.3 };
      } else if (gesture === "stamp") {
        const down = Math.abs(Math.sin(gp * Math.PI * 2));
        R = { x: 0.25, y: 0.42 - down * 0.18, z: 0.3, rz: -0.2 };
      } else if (working) {
        L = { x: -0.22, y: 0.33 + Math.abs(Math.sin(t * 9)) * 0.05, z: 0.3, rz: 0.1 };
        R = { x: 0.22, y: 0.33 + Math.abs(Math.cos(t * 9)) * 0.05, z: 0.3, rz: -0.1 };
      }
      const k = gesture === "wave" ? 7 : 6;
      handL.current.position.x = damp(handL.current.position.x, L.x, k, dt);
      handL.current.position.y = damp(handL.current.position.y, L.y, k, dt);
      handL.current.position.z = damp(handL.current.position.z, L.z, k, dt);
      handL.current.rotation.z = damp(handL.current.rotation.z, L.rz, 10, dt);
      handR.current.position.x = damp(handR.current.position.x, R.x, k, dt);
      handR.current.position.y = damp(handR.current.position.y, R.y, k, dt);
      handR.current.position.z = damp(handR.current.position.z, R.z, k, dt);
      handR.current.rotation.z = damp(handR.current.rotation.z, R.rz, 10, dt);
    }
  });

  return (
    <group ref={root} position={position} rotation-y={rotationY} scale={scale}>
      <group ref={hover}>
        {/* Thruster glow under the body */}
        <mesh geometry={geo.thruster} material={mat.glow} rotation-x={Math.PI / 2} position-y={-0.02} />
        <mesh geometry={geo.glow} material={mat.softGlow} rotation-x={-Math.PI / 2} position-y={-0.04} />

        <group ref={body}>
          <mesh geometry={geo.torso} material={mat.shell} />
          <mesh geometry={geo.chestRing} material={mat.dark} position={[0, 0.34, 0.232]} />
          <mesh geometry={geo.chest} material={mat.glow} position={[0, 0.34, 0.236]} />
          <mesh geometry={geo.collar} material={mat.dark} rotation-x={Math.PI / 2} position-y={0.545} />
          <mesh geometry={geo.neck} material={mat.dark} position-y={0.58} />

          <group ref={head} position-y={0.8}>
            <mesh geometry={geo.head} material={mat.shell} />
            <mesh geometry={geo.visor} material={mat.visor} />

            <group ref={eyes}>
              <group ref={pillEyes}>
                <mesh ref={leftEye} geometry={geo.eye} material={mat.glow} position={[-0.083, 0.018, 0.247]} />
                <mesh ref={rightEye} geometry={geo.eye} material={mat.glow} position={[0.083, 0.018, 0.247]} />
              </group>
              <group ref={arcEyes} visible={false}>
                <mesh geometry={geo.eyeArc} material={mat.glow} position={[-0.083, 0.008, 0.247]} />
                <mesh geometry={geo.eyeArc} material={mat.glow} position={[0.083, 0.008, 0.247]} />
              </group>
            </group>

            <mesh
              ref={cheek}
              geometry={geo.cheek}
              material={mat.cheek}
              position={[-0.152, -0.045, 0.214]}
              rotation-y={-0.55}
            />
            <mesh geometry={geo.cheek} material={mat.cheek} position={[0.152, -0.045, 0.214]} rotation-y={0.55} />

            <mesh
              ref={smile}
              geometry={geo.smile}
              material={mat.glow}
              position={[0, -0.058, 0.238]}
              rotation-z={Math.PI}
            />
            <group ref={bars} position={[0, -0.072, 0.238]} visible={false}>
              {[-2, -1, 0, 1, 2].map((i) => (
                <mesh key={i} geometry={geo.bar} material={mat.glow} position-x={i * 0.019} />
              ))}
            </group>

            {[-1, 1].map((side) => (
              <group key={side} position-x={side * 0.288}>
                <mesh geometry={geo.ear} material={mat.shell} rotation-z={Math.PI / 2} />
                <mesh geometry={geo.earRing} material={mat.glow} position-x={side * 0.027} rotation-y={Math.PI / 2} />
              </group>
            ))}

            <mesh geometry={geo.antenna} material={mat.dark} position-y={0.27} />
            <mesh ref={bulb} geometry={geo.bulb} material={mat.bulb} position-y={0.335} />
          </group>
        </group>

        <group ref={handL} position={[-0.43, 0.27, 0.1]}>
          <mesh geometry={geo.hand} material={mat.shell} />
        </group>
        <group ref={handR} position={[0.43, 0.27, 0.1]}>
          <mesh geometry={geo.hand} material={mat.shell} />
        </group>
      </group>
    </group>
  );
}
