import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { RootState } from "@react-three/fiber";

export interface GpuInfo {
  renderer: string;
  vendor: string;
  version: string;
  maxTextureSize: number;
  maxSamples: number;
}

/** Reads the real GPU behind the WebGL context (not the masked "WebKit WebGL" string). */
function readGpuInfo(gl: THREE.WebGLRenderer): GpuInfo {
  const ctx = gl.getContext();
  const debug = ctx.getExtension("WEBGL_debug_renderer_info");
  const isGl2 = typeof WebGL2RenderingContext !== "undefined" && ctx instanceof WebGL2RenderingContext;
  return {
    renderer: debug ? String(ctx.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : String(ctx.getParameter(ctx.RENDERER)),
    vendor: debug ? String(ctx.getParameter(debug.UNMASKED_VENDOR_WEBGL)) : String(ctx.getParameter(ctx.VENDOR)),
    version: String(ctx.getParameter(ctx.VERSION)),
    maxTextureSize: Number(ctx.getParameter(ctx.MAX_TEXTURE_SIZE)),
    maxSamples: isGl2 ? Number(ctx.getParameter((ctx as WebGL2RenderingContext).MAX_SAMPLES)) : 0,
  };
}

const ProbeScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <mesh rotation={[frame * 0.01, frame * 0.013, 0]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial transmission={1} thickness={0.8} roughness={0.05} ior={1.5} iridescence={1} />
      </mesh>
      <mesh position={[0, 0, -1.6]} rotation={[0.4, frame * 0.02, 0]}>
        <torusKnotGeometry args={[0.7, 0.22, 256, 32]} />
        <meshPhysicalMaterial metalness={1} roughness={0.15} clearcoat={1} color="#d8d8d8" />
      </mesh>
    </>
  );
};

/**
 * GPU probe: renders a transmission + metal scene and prints the WebGL renderer string, so we can
 * confirm headless Chrome is on the real GPU (ANGLE → D3D11) rather than software rasterization.
 */
export const GpuProbe: React.FC = () => {
  const { width, height } = useVideoConfig();
  const [info, setInfo] = useState<GpuInfo | null>(null);
  const [handle] = useState(() => delayRender("Reading WebGL renderer info"));

  useEffect(() => {
    if (info) {
      // Browser console lines are forwarded to the render log; scripts/probe-gl.ts parses this.
      console.log(`GPU_PROBE ${JSON.stringify(info)}`);
      continueRender(handle);
    }
  }, [info, handle]);

  const onCreated = useMemo(
    () => (state: RootState) => {
      const env = new THREE.PMREMGenerator(state.gl).fromScene(new RoomEnvironment(), 0.04).texture;
      state.scene.environment = env;
      state.scene.background = new THREE.Color("#101216");
      setInfo(readGpuInfo(state.gl));
    },
    [],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#101216" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 30, position: [0, 0, 7] }} onCreated={onCreated}>
        <ProbeScene />
      </ThreeCanvas>
      <AbsoluteFill style={{ padding: 48, color: "#e8eaed", fontFamily: "Consolas, monospace", fontSize: 28 }}>
        <div>GPU PROBE</div>
        <div style={{ fontSize: 22, opacity: 0.8, marginTop: 12 }}>
          {info ? `${info.renderer} | ${info.version} | maxTex ${info.maxTextureSize} | MSAA ${info.maxSamples}` : "…"}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
