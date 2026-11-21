import React, { useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { planFilm } from "./plan";
import type { Film3DInput } from "./schema";
import { Stage } from "./Stage";

/**
 * Generic composition: any Film3D spec, any aspect. The composition's width/height decide the
 * aspect; the camera rigs and framing solve for it, so no film needs per-aspect code.
 */
export const Film3D: React.FC<{ film: Film3DInput }> = ({ film }) => {
  const { width, height } = useVideoConfig();
  const plan = useMemo(() => planFilm(film), [film]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        flat // tone mapping happens in each scene's post pipeline, not in materials
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance", stencil: false }}
      >
        <Stage plan={plan} aspect={width / height} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
