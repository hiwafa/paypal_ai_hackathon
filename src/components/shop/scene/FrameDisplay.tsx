"use client";

import { Html, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GlassesModel, frontWidthOf } from "@/components/three/GlassesModel";
import { introduceFrame } from "@/lib/client/lumi";
import { useShop } from "@/lib/client/shopStore";
import { PRODUCTS } from "@/lib/domain/catalog";
import { formatMoney } from "@/lib/domain/money";
import type { Product, ProductId } from "@/lib/domain/types";
import { COUNTER_FRAME_Y, COUNTER_FRAME_Z, COUNTER_SCALE, SHELF_Z, WALL_SCALE, WALL_SLOTS, counterX } from "./layout";

// The nine frames. Each one floats on its shelf and flies to the counter when
// Lumi (or the customer) picks it, spinning once on the way.

/** Live frame objects, so Lumi can look at whichever one the customer points at. */
export const frameObjects = new Map<ProductId, THREE.Object3D>();

const FLY_MS = 1100;
const SHIFT_MS = 550;
const LIFT = new THREE.Vector3(0, 0.55, 0.85);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const damp = THREE.MathUtils.damp;

export function FrameDisplay() {
  return (
    <>
      {PRODUCTS.map((product) => (
        <DisplayFrame key={product.id} product={product} />
      ))}
    </>
  );
}

/** A stable per-product phase so the frames don't bob in sync. */
function phaseOf(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return (hash / 997) * Math.PI * 2;
}

function homeOf(id: ProductId): THREE.Vector3 {
  const [x, y] = WALL_SLOTS[id];
  return new THREE.Vector3(x, y, SHELF_Z);
}

function DisplayFrame({ product }: { product: Product }) {
  const index = useShop((s) => s.onCounter.indexOf(product.id));
  const count = useShop((s) => s.onCounter.length);
  const hovered = useShop((s) => s.hovered === product.id);
  useCursor(hovered);

  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const width = useMemo(() => frontWidthOf(product), [product]);
  const phase = useMemo(() => phaseOf(product.id), [product.id]);
  const motion = useRef({
    from: new THREE.Vector3(),
    to: homeOf(product.id),
    control: new THREE.Vector3(),
    start: 0,
    duration: 1,
    spin: 0,
    fromScale: WALL_SCALE,
    toScale: WALL_SCALE,
    onCounter: false,
    yaw: 0,
  });

  useLayoutEffect(() => {
    const group = outer.current!;
    group.position.copy(motion.current.to);
    group.scale.setScalar(WALL_SCALE);
    frameObjects.set(product.id, group);
    return () => {
      frameObjects.delete(product.id);
    };
  }, [product.id]);

  // Fly to the counter, back to the wall, or shuffle along the counter.
  useLayoutEffect(() => {
    const group = outer.current!;
    const m = motion.current;
    const onCounter = index >= 0;
    const target = onCounter
      ? new THREE.Vector3(counterX(index, count), COUNTER_FRAME_Y, COUNTER_FRAME_Z)
      : homeOf(product.id);
    if (target.equals(m.to) && onCounter === m.onCounter) return;

    const changingPlace = onCounter !== m.onCounter;
    m.from.copy(group.position);
    m.to.copy(target);
    m.control.copy(m.from).lerp(m.to, 0.5);
    if (changingPlace) m.control.add(LIFT);
    else m.control.y += 0.1;
    m.fromScale = group.scale.x;
    m.toScale = onCounter ? COUNTER_SCALE : WALL_SCALE;
    m.spin = changingPlace ? (onCounter ? 1 : -1) : 0;
    m.duration = changingPlace ? FLY_MS : SHIFT_MS;
    m.start = performance.now();
    m.onCounter = onCounter;
  }, [index, count, product.id]);

  useFrame((state, delta) => {
    const group = outer.current;
    const body = inner.current;
    if (!group || !body) return;
    const m = motion.current;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const k = Math.min(1, (performance.now() - m.start) / m.duration);
    const e = easeInOut(k);

    if (k < 1) {
      const a = 1 - e;
      group.position.set(
        a * a * m.from.x + 2 * a * e * m.control.x + e * e * m.to.x,
        a * a * m.from.y + 2 * a * e * m.control.y + e * e * m.to.y,
        a * a * m.from.z + 2 * a * e * m.control.z + e * e * m.to.z,
      );
      group.scale.setScalar(THREE.MathUtils.lerp(m.fromScale, m.toScale, e));
    } else {
      group.position.copy(m.to);
      group.scale.setScalar(m.toScale);
    }
    group.position.y += Math.sin(t * 0.9 + phase) * 0.01;

    const shop = useShop.getState();
    const isHovered = shop.hovered === product.id;
    const sway = m.onCounter ? Math.sin(t * 0.55 + phase) * 0.5 : Math.sin(t * 0.45 + phase) * 0.3;
    m.yaw = damp(m.yaw, isHovered ? 0 : sway, 4, dt);
    body.rotation.y = m.yaw + m.spin * Math.PI * 2 * e;
    body.rotation.x = damp(body.rotation.x, m.onCounter ? -0.2 : 0, 4, dt);
    const grow = isHovered ? 1.12 : m.onCounter && shop.focused === product.id ? 1.05 : 1;
    body.scale.setScalar(damp(body.scale.x, grow, 8, dt));
  });

  return (
    <group
      ref={outer}
      onPointerOver={(event) => {
        event.stopPropagation();
        if (useShop.getState().entered) useShop.getState().patch({ hovered: product.id });
      }}
      onPointerOut={() => {
        if (useShop.getState().hovered === product.id) useShop.getState().patch({ hovered: null });
      }}
      onClick={(event) => {
        event.stopPropagation();
        const shop = useShop.getState();
        if (!shop.entered) return;
        if (shop.onCounter.includes(product.id)) {
          shop.patch({ focused: product.id });
        } else {
          shop.pickFrame(product.id);
          introduceFrame(product.id);
        }
      }}
    >
      <group ref={inner}>
        <GlassesModel product={product} />
        {/* Thin wire frames are hard to point at, so a hidden box catches the pointer. */}
        <mesh visible={false} position-z={-8}>
          <boxGeometry args={[width, 64, 28]} />
        </mesh>
      </group>
      {hovered && (
        <Html center position={[0, -46, 0]} zIndexRange={[30, 10]} pointerEvents="none">
          <div className="glass animate-rise whitespace-nowrap rounded-full px-3 py-1.5 text-xs">
            <span className="font-display text-[15px] text-white">{product.name}</span>
            <span className="text-white/55"> · {formatMoney(product.priceCents)}</span>
          </div>
        </Html>
      )}
    </group>
  );
}
