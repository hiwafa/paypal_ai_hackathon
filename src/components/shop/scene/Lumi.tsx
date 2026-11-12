"use client";

import { useThree } from "@react-three/fiber";
import { useCallback, useRef } from "react";
import * as THREE from "three";
import { RobotModel, type RobotDrive } from "@/components/three/RobotModel";
import { useShop } from "@/lib/client/shopStore";
import { frameObjects } from "./FrameDisplay";
import { LUMI_POSITION, VANITY_POSITION } from "./layout";

/** Lumi behind the counter, driven by the shop store every frame. */
export function Lumi() {
  const camera = useThree((s) => s.camera);

  // Reused every frame, so the per-frame drive allocates nothing.
  const scratch = useRef({
    state: {
      mood: "happy",
      activity: "idle",
      gesture: { kind: "none", at: 0 },
      lookAt: null,
      enterAt: 0,
    } as RobotDrive,
    gaze: new THREE.Vector3(),
    mirror: new THREE.Vector3(VANITY_POSITION[0], VANITY_POSITION[1] + 0.36, VANITY_POSITION[2]),
  });

  const drive = useCallback((): RobotDrive => {
    const { state, gaze, mirror } = scratch.current;
    const shop = useShop.getState();
    state.mood = shop.mood;
    state.activity = shop.activity;
    state.gesture = shop.gesture;
    state.enterAt = shop.entered ? shop.enteredAt + 200 : 0;

    // Follow the customer's pointer to a frame, glance at the mirror while it
    // is open, and otherwise mostly keep eye contact with the customer.
    const hovered = shop.hovered ? frameObjects.get(shop.hovered) : undefined;
    if (hovered) state.lookAt = hovered.getWorldPosition(gaze);
    else if (shop.mirror !== "closed" && shop.activity === "idle") state.lookAt = mirror;
    else if (shop.activity !== "idle" || Math.sin(performance.now() / 4200) > -0.35)
      state.lookAt = gaze.copy(camera.position);
    else state.lookAt = null;
    return state;
  }, [camera]);

  return <RobotModel id="lumi" drive={drive} position={LUMI_POSITION} entrance />;
}
