"use client";

import { MeshReflectorMaterial } from "@react-three/drei";

/** "low" drops the costly effects on slow machines. */
export type SceneQuality = "high" | "low";

/** A dark floor that softly mirrors the glowing room on capable machines. */
export function ReflectiveFloor({ size, quality }: { size: number; quality: SceneQuality }) {
  return (
    <mesh rotation-x={-Math.PI / 2}>
      <planeGeometry args={[size, size]} />
      {quality === "high" ? (
        <MeshReflectorMaterial
          blur={[280, 70]}
          resolution={512}
          mixBlur={1}
          mixStrength={12}
          roughness={0.88}
          depthScale={1.1}
          minDepthThreshold={0.35}
          maxDepthThreshold={1.3}
          color="#0e0d12"
          metalness={0.55}
          mirror={0.55}
        />
      ) : (
        <meshStandardMaterial color="#0e0d12" roughness={0.38} metalness={0.4} />
      )}
    </mesh>
  );
}
