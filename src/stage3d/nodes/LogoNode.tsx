import React, { useEffect, useLayoutEffect, useMemo } from "react";
import type { EvalContext } from "../../engine/time/animatable";
import { applyMaterialAnimation, createMaterial, materialRecipe } from "../materials/library";
import type { LogoNodeSpec, Palette } from "../schema";
import { useLogoGeometry } from "./logoGeometry";
import { nodeTransform } from "./transform";

/** Brand mark from SVG, extruded and bevelled so strip lights trace its edges. */
export const LogoNode: React.FC<{ spec: LogoNodeSpec; ctx: EvalContext; palette: Palette }> = ({ spec, ctx, palette }) => {
  const geometry = useLogoGeometry(spec.src, spec.depth, spec.bevel);
  const material = useMemo(() => createMaterial(materialRecipe(spec.material, palette)), [spec.material, palette]);
  useEffect(() => () => material.dispose(), [material]);

  const xf = nodeTransform(spec, ctx);
  useLayoutEffect(() => applyMaterialAnimation(material, spec.material, ctx));

  if (!geometry) return null;
  return (
    <mesh geometry={geometry} material={material} position={xf.position} rotation={xf.rotation} scale={xf.scale} visible={xf.visible} />
  );
};
