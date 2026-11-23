import React, { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { evalNumber, type EvalContext } from "../../engine/time/animatable";
import { resolveColor } from "../plan";
import type { BackdropSpec, Palette } from "../schema";

/**
 * Backdrops: the space behind the subject. All real geometry in the 3D scene, so they receive the
 * same depth of field, bloom and grade as everything else.
 */

const GRADIENT_VERTEX = /* glsl */ `
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const GRADIENT_FRAGMENT = /* glsl */ `
uniform vec3 uInner;
uniform vec3 uOuter;
uniform vec2 uResolution;
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float d = smoothstep(0.0, 0.95, length(p * vec2(0.9, 1.15)));
  gl_FragColor = vec4(mix(uInner, uOuter, d), 1.0);
}
`;

const GRID_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const GRID_FRAGMENT = /* glsl */ `
uniform vec3 uLine;
uniform vec3 uBase;
uniform float uCell;
uniform float uGlow;
uniform float uScroll;
varying vec3 vWorld;
float ue_gridLine(vec2 p, float width) {
  vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
  return 1.0 - min(min(g.x, g.y) / width, 1.0);
}
void main() {
  vec2 p = vWorld.xz / uCell + vec2(0.0, uScroll);
  float minor = ue_gridLine(p, 1.0);
  float major = ue_gridLine(p / 4.0, 1.6);
  float dist = length(vWorld.xz);
  float fade = exp(-dist * 0.12);
  float horizon = exp(-dist * 0.025);
  vec3 col = uBase + uLine * (minor * 0.35 + major) * uGlow * fade + uLine * 0.04 * horizon;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const Backdrop: React.FC<{ spec: BackdropSpec; ctx: EvalContext; palette: Palette; resolution: THREE.Vector2 }> = ({
  spec,
  ctx,
  palette,
  resolution,
}) => {
  const gradient = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: GRADIENT_VERTEX,
        fragmentShader: GRADIENT_FRAGMENT,
        uniforms: { uInner: { value: new THREE.Color() }, uOuter: { value: new THREE.Color() }, uResolution: { value: new THREE.Vector2() } },
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  );
  const grid = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: GRID_VERTEX,
        fragmentShader: GRID_FRAGMENT,
        uniforms: {
          uLine: { value: new THREE.Color() },
          uBase: { value: new THREE.Color() },
          uCell: { value: 0.5 },
          uGlow: { value: 1 },
          uScroll: { value: 0 },
        },
      }),
    [],
  );
  useEffect(
    () => () => {
      gradient.dispose();
      grid.dispose();
    },
    [gradient, grid],
  );

  useLayoutEffect(() => {
    if (spec.type === "gradient") {
      gradient.uniforms.uInner.value.copy(resolveColor(spec.inner, palette));
      gradient.uniforms.uOuter.value.copy(resolveColor(spec.outer, palette));
      gradient.uniforms.uResolution.value.copy(resolution);
    }
    if (spec.type === "grid") {
      grid.uniforms.uLine.value.copy(resolveColor(spec.line, palette));
      grid.uniforms.uBase.value.copy(resolveColor(spec.base, palette));
      grid.uniforms.uCell.value = spec.cell;
      grid.uniforms.uGlow.value = evalNumber(spec.glow, ctx);
      grid.uniforms.uScroll.value = spec.scroll * (ctx.sceneStart + ctx.t);
    }
  });

  if (spec.type === "gradient") {
    return (
      <mesh material={gradient} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[80, 32, 16]} />
      </mesh>
    );
  }
  if (spec.type === "grid") {
    return (
      <mesh material={grid} position={[0, spec.height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[400, 400]} />
      </mesh>
    );
  }
  return null;
};

/** Clear color behind everything (linear). */
export function backdropBaseColor(spec: BackdropSpec, palette: Palette): THREE.Color {
  if (spec.type === "void") return resolveColor(spec.color, palette);
  if (spec.type === "gradient") return resolveColor(spec.outer, palette);
  return resolveColor(spec.base, palette);
}
