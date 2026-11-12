"use client";

import { forwardRef, useMemo } from "react";
import type { ThreeElements } from "@react-three/fiber";
import type * as THREE from "three";
import type { Product } from "@/lib/domain/types";
import { glassesMaterials, glassesParts } from "./glassesGeometry";

type GroupProps = ThreeElements["group"];

interface GlassesModelProps extends Omit<GroupProps, "children"> {
  product: Product;
}

/** A pair of procedurally built glasses, in millimetres (scale it from outside). */
export const GlassesModel = forwardRef<THREE.Group, GlassesModelProps>(function GlassesModel(
  { product, ...groupProps },
  ref,
) {
  const parts = useMemo(() => glassesParts(product.style, product.look.material), [product]);
  const materials = useMemo(() => glassesMaterials(product.look), [product]);

  // Geometry and materials are cached and shared, so they must not be disposed on unmount.
  return (
    <group ref={ref} {...groupProps} dispose={null}>
      {parts.frame.map((geometry, i) => (
        <mesh key={`f${i}`} geometry={geometry} material={materials.frame} />
      ))}
      {parts.accent.map((geometry, i) => (
        <mesh key={`a${i}`} geometry={geometry} material={materials.accent} />
      ))}
      {parts.pads.map((geometry, i) => (
        <mesh key={`p${i}`} geometry={geometry} material={materials.pad} />
      ))}
      {parts.lenses.map((geometry, i) => (
        <mesh key={`l${i}`} geometry={geometry} material={materials.lens} renderOrder={2} />
      ))}
    </group>
  );
});

export function frontWidthOf(product: Product): number {
  return glassesParts(product.style, product.look.material).frontWidth;
}
