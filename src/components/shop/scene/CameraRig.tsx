"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useShop } from "@/lib/client/shopStore";

// Moves the camera between three shots: the street view before entering, the
// counter view, and a view shifted left when a side panel covers the right.

const damp = THREE.MathUtils.damp;

export function CameraRig() {
  const rig = useRef({
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    look: new THREE.Vector3(0, 1.42, 0),
  });
  const calm = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useFrame((state, delta) => {
    const { camera, size } = state;
    const shop = useShop.getState();
    const shot = rig.current;
    const dt = Math.min(delta, 0.05);
    const panelOpen = shop.mirror !== "closed" || shop.bagOpen || shop.careOpen;

    if (!shop.entered) {
      shot.position.set(0, 1.9, 8.4);
      shot.target.set(0, 1.5, 0);
    } else if (panelOpen && size.width >= 900) {
      shot.position.set(0.9, 1.6, 5.4);
      shot.target.set(0.9, 1.42, 0);
    } else {
      shot.position.set(0, 1.6, 5.2);
      shot.target.set(0, 1.42, 0);
    }

    // On tall, narrow screens step back until the counter fits the width.
    const aspect = size.width / size.height;
    if (aspect < 1.45) {
      const pull = Math.min(2.3, 1.45 / aspect);
      shot.position.z = shot.target.z + (shot.position.z - shot.target.z) * pull;
      shot.position.y += (pull - 1) * 0.35;
    }

    if (shop.entered && !calm) {
      shot.position.x += state.pointer.x * 0.16;
      shot.position.y += state.pointer.y * 0.07;
    }

    const speed = calm ? 6 : 2.1;
    camera.position.set(
      damp(camera.position.x, shot.position.x, speed, dt),
      damp(camera.position.y, shot.position.y, speed, dt),
      damp(camera.position.z, shot.position.z, speed, dt),
    );
    shot.look.set(
      damp(shot.look.x, shot.target.x, speed, dt),
      damp(shot.look.y, shot.target.y, speed, dt),
      damp(shot.look.z, shot.target.z, speed, dt),
    );
    camera.lookAt(shot.look);
  });

  return null;
}
