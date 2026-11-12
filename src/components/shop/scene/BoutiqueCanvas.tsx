"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useState } from "react";
import type { SceneQuality } from "@/components/three/ReflectiveFloor";
import { useShop } from "@/lib/client/shopStore";
import { BoutiqueRoom } from "./BoutiqueRoom";
import { CameraRig } from "./CameraRig";
import { FrameDisplay } from "./FrameDisplay";
import { Lumi } from "./Lumi";
import { VanityMirror } from "./VanityMirror";

/**
 * The 3D boutique. Loaded only in the browser. Quality drops automatically on
 * slow machines, and while the magic mirror runs its own camera pipeline.
 */
export default function BoutiqueCanvas() {
  const [measured, setMeasured] = useState<SceneQuality>("high");
  const [dpr, setDpr] = useState(1.5);
  const mirrorBusy = useShop((s) => s.mirror === "starting" || s.mirror === "live");
  const quality: SceneQuality = mirrorBusy ? "low" : measured;

  return (
    <Canvas
      dpr={dpr}
      camera={{ fov: 36, near: 0.1, far: 40, position: [0, 1.9, 8.4] }}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      aria-label="Mira Eyewear boutique with Lumi the robot stylist behind the counter"
    >
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => {
          setMeasured("low");
          setDpr(1);
        }}
        onFallback={() => {
          setMeasured("low");
          setDpr(1);
        }}
      />
      <BoutiqueRoom quality={quality} />
      <FrameDisplay />
      <VanityMirror />
      <Lumi />
      <CameraRig />
      <EffectComposer multisampling={quality === "high" ? 4 : 0}>
        <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.85} radius={0.72} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.22} darkness={0.72} />
      </EffectComposer>
    </Canvas>
  );
}
