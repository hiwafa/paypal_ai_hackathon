"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useState } from "react";
import type { SceneQuality } from "@/components/three/ReflectiveFloor";
import { CoinBurst } from "./CoinBurst";
import { CrewLabels, LabelProjector } from "./CrewLabels";
import { CREW } from "./layout";
import { OfficeCamera } from "./OfficeCamera";
import { OfficeRoom } from "./OfficeRoom";
import { Station } from "./Station";

/**
 * The crew room: Penny, Otto and Kai at their desks, acting out every PayPal
 * event as it arrives. Loaded only in the browser; quality drops on slow machines.
 */
export default function CrewRoom() {
  const [quality, setQuality] = useState<SceneQuality>("high");
  const [dpr, setDpr] = useState(1.5);
  const degrade = () => {
    setQuality("low");
    setDpr(1);
  };

  return (
    <div className="relative size-full">
      <Canvas
        dpr={dpr}
        camera={{ fov: 30, near: 0.1, far: 30, position: [0, 2.1, 9] }}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        aria-label="The crew room: Penny the accountant, Otto the treasurer and Kai from customer care at their desks"
      >
        <PerformanceMonitor flipflops={3} onDecline={degrade} onFallback={degrade} />
        <OfficeRoom quality={quality} />
        {CREW.map((id) => (
          <Station key={id} id={id} />
        ))}
        <CoinBurst />
        <OfficeCamera />
        <LabelProjector />
        <EffectComposer multisampling={quality === "high" ? 4 : 0}>
          <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.8} radius={0.7} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette offset={0.25} darkness={0.62} />
        </EffectComposer>
      </Canvas>
      <CrewLabels />
    </div>
  );
}
