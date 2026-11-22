import React, { useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { OverlayLayer } from "../layer2d/OverlayLayer";
import { ScreenLayer } from "../layer2d/ScreenLayer";
import { Stage } from "../stage3d/Stage";
import { compileFilm } from "./compile/compile";
import type { FilmSpecInput } from "./schema/film";
import type { BoundScreen } from "./client/screen";
import type { AspectId } from "../stage3d/schema";
import type { EditorialBinding } from "./client/editorial";
import { stageStudioCut } from "./client/studio-cut";
import { aspectOf } from "../layer2d/layout";

export type FilmProps = { spec: FilmSpecInput; screens?: Record<string, BoundScreen>; aspect?: AspectId; editorial?: EditorialBinding };

/**
 * The one composition component. Any FilmSpec, any aspect: the compiler plans it, the 3D stage
 * renders the world, the 2D layer renders type and data on top.
 */
export const Film: React.FC<FilmProps> = ({ spec, screens, editorial }) => {
  const { width, height } = useVideoConfig();
  const aspect = aspectOf(width, height);
  const compiled = useMemo(() => compileFilm(editorial ? stageStudioCut(spec, aspect, editorial.safeAreas) : spec), [spec, aspect, editorial]);
  return (
    <AbsoluteFill data-factory-film={screens ? "" : undefined} style={{ backgroundColor: "#000000" }}>
      <ThreeCanvas width={width} height={height} flat gl={{ antialias: false, alpha: false, powerPreference: "high-performance", stencil: false }}>
        <Stage plan={compiled.stage} aspect={width / height} />
      </ThreeCanvas>
      {screens ? <ScreenLayer compiled={compiled} screens={screens} editorial={editorial} /> : null}
      <OverlayLayer compiled={compiled} checkScreenClearance={screens !== undefined} editorial={editorial} />
    </AbsoluteFill>
  );
};
