"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useOffice } from "@/lib/client/officeStore";
import type { ActivityKind } from "@/lib/domain/types";
import { DESK, HEAD_Y, ROBOT, STATION_X, WORK_MS, isCrew } from "./layout";

// Gold coins for every money event the crew acts out: a sale rains coins
// into Penny's desk, payouts and refunds send them flying out.

const COINS = 18;
const GRAVITY = -5.6;
const LIFE_S = 1.7;
const MONEY_IN: ReadonlySet<ActivityKind> = new Set(["sale"]);
const MONEY_OUT: ReadonlySet<ActivityKind> = new Set(["payout", "refund"]);

interface Coin {
  origin: THREE.Vector3;
  velocity: THREE.Vector3;
  delay: number;
  spin: number;
}

const spread = (range: number) => (Math.random() * 2 - 1) * range;

export function CoinBurst() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.CylinderGeometry(0.034, 0.034, 0.009, 24), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#e8c98e",
        metalness: 1,
        roughness: 0.28,
        emissive: "#a8781e",
        emissiveIntensity: 0.55,
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const sim = useRef({
    stageAt: -1,
    start: -1,
    coins: Array.from({ length: COINS }, (): Coin => ({
      origin: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      delay: 0,
      spin: 0,
    })),
    dummy: new THREE.Object3D(),
  });

  useFrame(() => {
    const instances = mesh.current;
    if (!instances) return;
    const s = sim.current;
    const now = performance.now();

    const stage = useOffice.getState().stage;
    if (stage && stage.at !== s.stageAt) {
      s.stageAt = stage.at;
      const kind = stage.item.kind;
      const inbound = MONEY_IN.has(kind);
      if (isCrew(stage.robot) && stage.item.amountCents && (inbound || MONEY_OUT.has(kind))) {
        const x = STATION_X[stage.robot];
        s.start = stage.at + WORK_MS;
        s.coins.forEach((coin, i) => {
          if (inbound) {
            coin.origin.set(x + spread(0.4), HEAD_Y + 0.55 + Math.random() * 0.3, DESK.z - 0.05 + spread(0.12));
            coin.velocity.set(spread(0.1), -0.4 - Math.random() * 0.4, spread(0.05));
            coin.delay = i * 0.045;
          } else {
            coin.origin.set(x + 0.2 + spread(0.08), DESK.top + 0.04, ROBOT.z + 0.36);
            coin.velocity.set(spread(0.75), 2 + Math.random() * 0.8, 0.25 + Math.random() * 0.5);
            coin.delay = i * 0.02;
          }
          coin.spin = 6 + Math.random() * 10;
        });
      }
    }

    const age = (now - s.start) / 1000;
    if (s.start < 0 || age < 0 || age > LIFE_S + 1) {
      instances.visible = false;
      return;
    }
    instances.visible = true;
    const { dummy } = s;
    s.coins.forEach((coin, i) => {
      const t = age - coin.delay;
      const y = coin.origin.y + coin.velocity.y * t + 0.5 * GRAVITY * t * t;
      // Hidden before launch, after landing in the desk, and once the burst is over.
      const alive = t >= 0 && t <= LIFE_S && y > DESK.top - 0.02;
      const shrink = alive ? Math.min(1, (LIFE_S - t) / 0.25) : 0;
      dummy.position.set(coin.origin.x + coin.velocity.x * t, y, coin.origin.z + coin.velocity.z * t);
      dummy.rotation.set(t * coin.spin, t * coin.spin * 0.6, Math.PI / 2.4);
      dummy.scale.setScalar(Math.max(0.0001, shrink));
      dummy.updateMatrix();
      instances.setMatrixAt(i, dummy.matrix);
    });
    instances.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, COINS]} visible={false} frustumCulled={false} />;
}
