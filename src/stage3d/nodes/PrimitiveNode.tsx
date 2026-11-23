import React, { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { EvalContext } from "../../engine/time/animatable";
import { applyMaterialAnimation, createMaterial, materialRecipe } from "../materials/library";
import type { Palette, PrimitiveNodeSpec, PrimitiveShape } from "../schema";
import { nodeTransform } from "./transform";

/** Folded softbox reflector with a coarse, fixed mesh budget. */
function sweptSheet(): THREE.BufferGeometry {
  const segments = 56;
  const across = 10;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const roll = 0.3 + 0.85 * Math.sin(5.5 * t + 0.65);
    for (let j = 0; j <= across; j++) {
      const v = (2 * j / across - 1) * (0.30 + 0.14 * Math.sin(Math.PI * t));
      positions.push(
        (t - 0.5) * 3.6,
        0.33 * Math.sin(5.0 * t + 0.8) + v * Math.cos(roll),
        0.29 * Math.cos(4.7 * t) + v * Math.sin(roll) - 0.9 * v * v,
      );
      if (i > 0 && j > 0) {
        const d = i * (across + 1) + j;
        const a = d - across - 2;
        indices.push(a, d - 1, d, a, d, d - across - 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Native high-resolution geometry for static shapes (sized to match the morph shapes). */
function primitiveGeometry(shape: PrimitiveShape): THREE.BufferGeometry {
  switch (shape) {
    case "sphere":
      return new THREE.SphereGeometry(1, 192, 96);
    case "icosahedron":
      return new THREE.IcosahedronGeometry(1.08, 0);
    case "roundedBox":
      return new RoundedBoxGeometry(1.3, 1.3, 1.3, 10, 0.18);
    case "torus":
      return new THREE.TorusGeometry(0.68, 0.3, 96, 256).rotateX(Math.PI / 2);
    case "torusKnot":
      return new THREE.TorusKnotGeometry(0.6, 0.16, 512, 64, 2, 3);
    case "capsule":
      return new THREE.CapsuleGeometry(0.45, 1.1, 32, 96);
    case "cylinder":
      return new THREE.CylinderGeometry(0.7, 0.7, 1.4, 160, 1);
    case "sweptSheet":
      return sweptSheet();
    case "plane":
      return new THREE.PlaneGeometry(2, 2);
  }
}

export const PrimitiveNode: React.FC<{ spec: PrimitiveNodeSpec; ctx: EvalContext; palette: Palette }> = ({ spec, ctx, palette }) => {
  const geometry = useMemo(() => {
    const shape = primitiveGeometry(spec.shape);
    if (spec.dimensions) shape.scale(...spec.dimensions);
    return shape;
  }, [spec.shape, spec.dimensions]);
  const material = useMemo(() => {
    const result = createMaterial(materialRecipe(spec.material, palette));
    if (spec.shape === "sweptSheet") result.side = THREE.DoubleSide;
    return result;
  }, [spec.material, palette, spec.shape]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const xf = nodeTransform(spec, ctx);
  useLayoutEffect(() => applyMaterialAnimation(material, spec.material, ctx));

  return (
    <mesh geometry={geometry} material={material} position={xf.position} rotation={xf.rotation} scale={xf.scale} visible={xf.visible} />
  );
};
