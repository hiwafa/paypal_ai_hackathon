"use client";

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { GlassesModel, frontWidthOf } from "@/components/three/GlassesModel";
import type { Product } from "@/lib/domain/types";
import type { FaceFrame } from "./faceCamera";

// Draws the chosen frame on the live video. World units are video pixels
// (x right, y up, z towards the viewer), and an orthographic camera zoomed to
// "object-fit: cover" makes the canvas line up with the <video> behind it.
// Both the video and this canvas are mirrored with CSS, so all maths here is
// done in the camera's own, un-mirrored image.

/** MediaPipe Face Mesh indices used for the head pose. */
const L = {
  forehead: 10,
  chin: 152,
  eyeOuterR: 33,
  eyeInnerR: 133,
  eyeOuterL: 263,
  eyeInnerL: 362,
  templeR: 127,
  templeL: 356,
  noseBridge: 168,
} as const;

/** A good fit puts the frame front at about 90% of the temple-to-temple width. */
const FRONT_TO_TEMPLES = 0.9;
const STALE_MS = 400;

interface TryOnOverlayProps {
  frame: RefObject<FaceFrame>;
  product: Product | null;
  /** Shows the measuring dots while the face is being read. */
  scanning: boolean;
}

function TryOnOverlay({ frame, product, scanning }: TryOnOverlayProps) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 3000], near: 1, far: 8000, zoom: 1 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[300, 600, 1000]} intensity={1.8} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.5} position={[0, 5, 4]} scale={[10, 2, 1]} />
        <Lightformer
          form="rect"
          intensity={1.4}
          color="#ffe4c4"
          position={[-5, 1, 2]}
          rotation-y={Math.PI / 2}
          scale={[4, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#d6f5f0"
          position={[5, 1, 2]}
          rotation-y={-Math.PI / 2}
          scale={[4, 4, 1]}
        />
      </Environment>
      <CoverCamera frame={frame} />
      {product && <FaceRig key={product.id} frame={frame} product={product} />}
      {scanning && <ScanDots frame={frame} />}
    </Canvas>
  );
}

/** Keeps the orthographic zoom equal to the CSS "cover" scale of the video. */
function CoverCamera({ frame }: { frame: RefObject<FaceFrame> }) {
  useFrame(({ camera, size }) => {
    const { width, height } = frame.current;
    if (!width || !height) return;
    const zoom = Math.max(size.width / width, size.height / height);
    if (Math.abs(camera.zoom - zoom) > 1e-4) {
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

function toWorld(target: THREE.Vector3, lm: NormalizedLandmark, width: number, height: number): THREE.Vector3 {
  // MediaPipe's z is relative depth on roughly the same scale as x.
  return target.set((lm.x - 0.5) * width, -(lm.y - 0.5) * height, -lm.z * width);
}

interface Pose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  /** Temple-to-temple width in video pixels. */
  temples: number;
}

/** Head pose from a handful of stable landmarks. Reuses `scratch` to avoid garbage. */
function headPose(frame: FaceFrame, scratch: PoseScratch, out: Pose): boolean {
  const lm = frame.landmarks;
  if (!lm || lm.length < 468) return false;
  const p = (i: number, v: THREE.Vector3) => toWorld(v, lm[i], frame.width, frame.height);
  const { a, b, c, d, x, y, z, basis } = scratch;

  // x: from the subject's right eye to the left eye; y: chin to forehead.
  x.subVectors(p(L.eyeOuterL, a), p(L.eyeOuterR, b)).normalize();
  y.subVectors(p(L.forehead, a), p(L.chin, b));
  y.addScaledVector(x, -y.dot(x)).normalize();
  z.crossVectors(x, y);

  out.temples = p(L.templeL, a).distanceTo(p(L.templeR, b));

  // Lens centres sit in front of the eyes, a touch below the pupils.
  const eyes = c
    .addVectors(p(L.eyeOuterR, a), p(L.eyeInnerR, b))
    .add(p(L.eyeOuterL, a))
    .add(p(L.eyeInnerL, b))
    .multiplyScalar(0.25);
  const bridgeDepth = p(L.noseBridge, d).sub(eyes).dot(z);
  out.position
    .copy(eyes)
    .addScaledVector(z, bridgeDepth + 0.03 * out.temples)
    .addScaledVector(y, -0.015 * out.temples);

  out.quaternion.setFromRotationMatrix(basis.makeBasis(x, y, z));
  return true;
}

interface PoseScratch {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  d: THREE.Vector3;
  x: THREE.Vector3;
  y: THREE.Vector3;
  z: THREE.Vector3;
  basis: THREE.Matrix4;
}

function FaceRig({ frame, product }: { frame: RefObject<FaceFrame>; product: Product }) {
  const group = useRef<THREE.Group>(null);
  const width = useMemo(() => frontWidthOf(product), [product]);
  // The head, in the glasses' own millimetre units, for the hidden occluder.
  const head = width / (FRONT_TO_TEMPLES * product.look.fitScale);
  const state = useRef({
    scratch: {
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      c: new THREE.Vector3(),
      d: new THREE.Vector3(),
      x: new THREE.Vector3(),
      y: new THREE.Vector3(),
      z: new THREE.Vector3(),
      basis: new THREE.Matrix4(),
    } satisfies PoseScratch,
    pose: { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), temples: 0 } as Pose,
    tracking: false,
  });

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const s = state.current;
    const current = frame.current;
    const fresh = performance.now() - current.at < STALE_MS;
    if (!fresh || !headPose(current, s.scratch, s.pose)) {
      g.visible = false;
      s.tracking = false;
      return;
    }

    const targetScale = (s.pose.temples * FRONT_TO_TEMPLES * product.look.fitScale) / width;
    if (!s.tracking) {
      // Snap on the first frame, then smooth.
      g.position.copy(s.pose.position);
      g.quaternion.copy(s.pose.quaternion);
      g.scale.setScalar(targetScale);
      s.tracking = true;
    } else {
      // Follow fast moves quickly and filter small jitter strongly.
      const jump = g.position.distanceTo(s.pose.position) / Math.max(1, s.pose.temples);
      const follow = THREE.MathUtils.clamp(0.35 + jump * 8, 0.35, 0.9);
      g.position.lerp(s.pose.position, follow);
      g.quaternion.slerp(s.pose.quaternion, 0.5);
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, targetScale, 0.25));
    }
    g.visible = true;
  });

  return (
    <group ref={group} visible={false}>
      {/* Invisible head that hides the temple arms behind the face. */}
      <mesh renderOrder={-1} position={[0, -0.06 * head, -0.62 * head]} scale={[0.47 * head, 0.66 * head, 0.58 * head]}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial colorWrite={false} />
      </mesh>
      <GlassesModel product={product} />
    </group>
  );
}

/** Teal measuring dots that ride on the face while the mirror reads it. */
function ScanDots({ frame }: { frame: RefObject<FaceFrame> }) {
  const STEP = 3;
  const count = Math.ceil(468 / STEP);
  const points = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);
  const scratch = useRef(new THREE.Vector3());

  useFrame((state) => {
    const current = frame.current;
    const p = points.current;
    if (!p) return;
    const lm = current.landmarks;
    if (!lm || performance.now() - current.at > STALE_MS) {
      p.visible = false;
      return;
    }
    const attribute = p.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const v = toWorld(scratch.current, lm[i * STEP], current.width, current.height);
      attribute.setXYZ(i, v.x, v.y, v.z + 2);
    }
    attribute.needsUpdate = true;
    (p.material as THREE.PointsMaterial).opacity = 0.55 + Math.sin(state.clock.elapsedTime * 6) * 0.25;
    p.visible = true;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false} visible={false}>
      <pointsMaterial color="#5eead4" size={3} sizeAttenuation={false} transparent depthTest={false} />
    </points>
  );
}

// The scan status re-renders its parent several times a second; the canvas only needs new props.
export default memo(TryOnOverlay);
