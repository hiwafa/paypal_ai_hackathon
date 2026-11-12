"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useRef } from "react";
import * as THREE from "three";
import { ArchPanel } from "@/components/three/ArchPanel";
import { RobotModel, type RobotDrive } from "@/components/three/RobotModel";
import { robotInFocus } from "@/lib/client/office";
import { useOffice } from "@/lib/client/officeStore";
import { mouth } from "@/lib/client/speech";
import { ROBOTS } from "@/lib/domain/robots";
import { Desk } from "./Desk";
import { HEAD_Y, ROBOT, STATION_X, WALL_Z, WORK_MS, isCrew, type CrewId } from "./layout";

// One crew member at work: a backlit arch, the desk, and the robot itself.
// Its nameplate and speech bubble are DOM overlays (see CrewLabels).

export function Station({ id }: { id: CrewId }) {
  const profile = ROBOTS[id];
  const drive = useCrewDrive(id);
  const backdrop = useRef<THREE.MeshBasicMaterial>(null);

  // The arch brightens while this robot has the floor.
  useFrame((_, delta) => {
    const material = backdrop.current;
    if (!material) return;
    const target = robotInFocus() === id ? 1.5 : 1;
    material.color.setScalar(THREE.MathUtils.damp(material.color.r, target, 3, Math.min(delta, 0.05)));
  });

  return (
    <group position-x={STATION_X[id]}>
      <group position-z={WALL_Z + 0.04}>
        <ArchPanel
          width={1.2}
          straight={1.3}
          glowY={HEAD_Y}
          accent={profile.accent}
          intensity={1}
          materialRef={backdrop}
        />
      </group>
      <pointLight position={[0, 1.65, -0.75]} color={profile.accent} intensity={3.2} distance={2.6} decay={2} />
      <RobotModel id={id} drive={drive} position={[0, ROBOT.y, ROBOT.z]} />
      <Desk id={id} />
    </group>
  );
}

/** Feeds the robot model every frame from the office store, without React renders. */
function useCrewDrive(id: CrewId): () => RobotDrive {
  const camera = useThree((s) => s.camera);
  const scratch = useRef({
    state: {
      mood: "happy",
      activity: "idle",
      gesture: { kind: "none", at: 0 },
      lookAt: null,
    } as RobotDrive,
    gaze: new THREE.Vector3(),
    stageAt: -1,
  });

  return useCallback((): RobotDrive => {
    const memory = scratch.current;
    const { state, gaze } = memory;
    const office = useOffice.getState();
    const now = performance.now();
    const stage = office.stage?.robot === id ? office.stage : null;

    // Each event: a moment of work at the keypad, then the gesture.
    if (stage && stage.at !== memory.stageAt) {
      memory.stageAt = stage.at;
      state.gesture = { kind: stage.gesture, at: stage.at + WORK_MS };
    }
    const talking = mouth.speaking && mouth.speaker === id;
    state.activity = talking
      ? "speaking"
      : office.thinking === id
        ? "thinking"
        : stage && now - stage.at < WORK_MS
          ? "working"
          : "idle";
    state.mood = stage?.gesture === "celebrate" ? "excited" : stage && id === "kai" ? "caring" : "happy";

    // Watch whichever colleague has the floor; otherwise keep eye contact with
    // Maryam, glancing away now and then so the three never move in sync.
    const focus = robotInFocus();
    if (isCrew(focus) && focus !== id) state.lookAt = gaze.set(STATION_X[focus], HEAD_Y, ROBOT.z);
    else if (!focus && Math.sin(now / 4600 + STATION_X[id] * 1.7) < -0.45) state.lookAt = null;
    else state.lookAt = gaze.copy(camera.position);
    return state;
  }, [camera, id]);
}
