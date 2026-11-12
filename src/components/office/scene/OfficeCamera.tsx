"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { robotInFocus } from "@/lib/client/office";
import { FRAME, ROBOT, STATION_X, isCrew } from "./layout";

// Frames the three stations whatever the canvas shape, leans gently towards
// whoever has the floor, and follows the pointer a little for depth.

const damp = THREE.MathUtils.damp;

export function OfficeCamera() {
  const rig = useRef({
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    look: new THREE.Vector3(0, FRAME.centreY, ROBOT.z),
  });
  const calm = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useFrame((state, delta) => {
    const { camera, size, pointer } = state;
    const shot = rig.current;
    const dt = Math.min(delta, 0.05);

    // Step back until both the width and the height of the frame fit.
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 30;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const aspect = size.width / Math.max(1, size.height);
    const distance = Math.max(FRAME.height / 2 / tanHalf, FRAME.width / 2 / (tanHalf * aspect));

    const focus = robotInFocus();
    const lean = !calm && isCrew(focus) ? STATION_X[focus] * 0.12 : 0;
    shot.target.set(lean, FRAME.centreY, ROBOT.z);
    shot.position.set(
      lean * 1.6 + (calm ? 0 : pointer.x * 0.18),
      FRAME.centreY + 0.34 + (calm ? 0 : pointer.y * 0.06),
      ROBOT.z + distance,
    );

    const speed = calm ? 8 : 1.8;
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
