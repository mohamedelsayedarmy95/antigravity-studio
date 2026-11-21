import React, { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { EvalContext } from "../../engine/time/animatable";
import { applyMaterialAnimation, createMaterial, materialRecipe } from "../materials/library";
import type { Palette, PrimitiveNodeSpec, PrimitiveShape } from "../schema";
import { nodeTransform } from "./transform";

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
    case "plane":
      return new THREE.PlaneGeometry(2, 2);
  }
}

export const PrimitiveNode: React.FC<{ spec: PrimitiveNodeSpec; ctx: EvalContext; palette: Palette }> = ({ spec, ctx, palette }) => {
  const geometry = useMemo(() => primitiveGeometry(spec.shape), [spec.shape]);
  const material = useMemo(() => createMaterial(materialRecipe(spec.material, palette)), [spec.material, palette]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const xf = nodeTransform(spec, ctx);
  useLayoutEffect(() => applyMaterialAnimation(material, spec.material, ctx));

  return (
    <mesh geometry={geometry} material={material} position={xf.position} rotation={xf.rotation} scale={xf.scale} visible={xf.visible} />
  );
};
