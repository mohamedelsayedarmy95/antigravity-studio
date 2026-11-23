import React, { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import { evalNumber, type EvalContext } from "../../engine/time/animatable";
import { applyMaterialAnimation, asPhysical, brushedRoughnessMap, materialRecipe } from "../materials/library";
import type { MorphNodeSpec, Palette } from "../schema";
import { NOISE_GLSL, SHAPES_GLSL } from "../shaders/glsl";
import { morphState, nodeTransform } from "./transform";

/**
 * Morphing geometry with full PBR shading. The mesh is a (u,v) grid; the vertex shader evaluates
 * the two active parametric shapes, blends them, adds optional surface noise, and derives the
 * normal from finite differences of the *final* surface, so lighting stays correct mid-morph.
 * The material is the library's MeshPhysicalMaterial extended in place (transmission,
 * clearcoat, iridescence all keep working).
 */
const MORPH_VERTEX = /* glsl */ `
uniform int uShapeA;
uniform int uShapeB;
uniform float uMix;
uniform float uTime;
uniform float uNoiseAmp;
uniform float uNoiseFreq;
uniform float uNoiseSpeed;
${NOISE_GLSL}
${SHAPES_GLSL}
vec3 ue_morphPos(vec2 uv) {
  vec3 p = mix(ue_shape(uShapeA, uv), ue_shape(uShapeB, uv), uMix);
  if (uNoiseAmp > 0.0) {
    float n = ue_snoise(p * uNoiseFreq + vec3(0.0, 0.0, uTime * uNoiseSpeed));
    p += normalize(p + vec3(1e-5)) * n * uNoiseAmp;
  }
  return p;
}
void main() {
  vec2 uv = position.xy;
  const float e = 0.0015;
  vec3 p = ue_morphPos(uv);
  vec3 du = ue_morphPos(uv + vec2(e, 0.0)) - ue_morphPos(uv - vec2(e, 0.0));
  vec3 dv = ue_morphPos(vec2(uv.x, min(uv.y + e, 1.0))) - ue_morphPos(vec2(uv.x, max(uv.y - e, 0.0)));
  vec3 n = cross(du, dv);
  float len = length(n);
  csm_Position = p;
  csm_Normal = len > 1e-10 ? n / len : normalize(p + vec3(1e-5));
}
`;

/** (u,v) grid: u wraps (seam column duplicated), v runs pole to pole. */
function buildParamGrid(segU: number, segV: number): THREE.BufferGeometry {
  const cols = segU + 1;
  const rows = segV + 1;
  const position = new Float32Array(cols * rows * 3);
  const uv = new Float32Array(cols * rows * 2);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      position[k * 3] = i / segU;
      position[k * 3 + 1] = j / segV;
      uv[k * 2] = i / segU;
      uv[k * 2 + 1] = j / segV;
    }
  }
  const index: number[] = [];
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      // Counter-clockwise seen from outside: cross(du, dv) points outward, matching the shader normal.
      index.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(cols * rows * 3), 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  // Real positions come from the shader; give culling a generous bound instead.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
  return geometry;
}

export const MorphNode: React.FC<{ spec: MorphNodeSpec; ctx: EvalContext; palette: Palette }> = ({ spec, ctx, palette }) => {
  const [segU, segV] = spec.resolution;
  const geometry = useMemo(() => buildParamGrid(segU, segV), [segU, segV]);

  const uniforms = useMemo(
    () => ({
      uShapeA: { value: 0 },
      uShapeB: { value: 0 },
      uMix: { value: 0 },
      uTime: { value: 0 },
      uNoiseAmp: { value: 0 },
      uNoiseFreq: { value: 1.6 },
      uNoiseSpeed: { value: 0.35 },
    }),
    [],
  );

  const material = useMemo(() => {
    const recipe = materialRecipe(spec.material, palette);
    const base = recipe.kind === "basic" ? THREE.MeshBasicMaterial : THREE.MeshPhysicalMaterial;
    const m = new CustomShaderMaterial({ baseMaterial: base, vertexShader: MORPH_VERTEX, uniforms, ...recipe.params });
    const physical = asPhysical(m);
    if (recipe.params.anisotropy && physical) physical.roughnessMap = brushedRoughnessMap();
    return m;
  }, [spec.material, palette, uniforms]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const xf = nodeTransform(spec, ctx);
  const state = morphState(spec, ctx);
  const noise = spec.surfaceNoise;
  const noiseAmp = noise ? evalNumber(noise.amount, ctx) : 0;

  useLayoutEffect(() => {
    uniforms.uShapeA.value = state.a;
    uniforms.uShapeB.value = state.b;
    uniforms.uMix.value = state.mix;
    uniforms.uTime.value = ctx.sceneStart + ctx.t;
    uniforms.uNoiseAmp.value = noiseAmp;
    if (noise) {
      uniforms.uNoiseFreq.value = noise.frequency;
      uniforms.uNoiseSpeed.value = noise.speed;
    }
    applyMaterialAnimation(material, spec.material, ctx);
  });

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={xf.position}
      rotation={xf.rotation}
      scale={xf.scale}
      visible={xf.visible}
      frustumCulled={false}
    />
  );
};
