import React, { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { evalNumber, type EvalContext } from "../../engine/time/animatable";
import { rng } from "../../engine/time/rng";
import { resolveColor } from "../plan";
import type { LogoNodeSpec, MorphNodeSpec, NodeSpec, Palette, ParticlesNodeSpec } from "../schema";
import { NOISE_GLSL, SHAPES_GLSL } from "../shaders/glsl";
import { useLogoGeometry } from "./logoGeometry";
import { MORPH_SHAPE_IDS, morphState, nodeTransform } from "./transform";

/**
 * GPU particle field. Every particle's position is evaluated in closed form in the vertex shader
 * from (its seeds, t): swirl, 3D simplex flow, and an eased "form" blend toward a target surface
 * (a morph shape or a logo). No simulation state, so any frame renders identically in isolation.
 *
 * Particles render in their own pass after the scene's depth of field (see ScenePipeline). They
 * test against the scene depth texture themselves (soft particles) and compute their own
 * circle-of-confusion bokeh, so out-of-focus particles grow and dim like real lens bokeh.
 */
const VERTEX = /* glsl */ `
attribute vec4 aSeed;
attribute vec3 aHome;
attribute vec3 aTarget;
uniform float uTime;
uniform float uDriftAmp;
uniform float uDriftFreq;
uniform float uDriftSpeed;
uniform float uSwirl;
uniform float uForm;
uniform float uStagger;
uniform float uJitter;
uniform int uTargetMode;      // 0 = parametric shape, 1 = sampled surface (aTarget)
uniform int uShapeA;
uniform int uShapeB;
uniform float uMix;
uniform mat4 uTargetMatrix;   // target node's world transform, relative to this node
uniform float uSize;
uniform float uViewportH;
uniform float uFocus;
uniform float uBokeh;
uniform float uOpacity;
uniform float uIntensity;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec3 vColor;
varying float vAlpha;
varying float vViewZ;
${NOISE_GLSL}
${SHAPES_GLSL}
void main() {
  vec3 p = aHome;

  // Differential swirl: inner particles orbit faster, like a vortex.
  float rxz = length(p.xz);
  float ang = uSwirl * uTime * (0.6 + 0.8 * aSeed.x) / (0.35 + rxz);
  float c = cos(ang), s = sin(ang);
  p.xz = mat2(c, s, -s, c) * p.xz;

  // Flow field drift.
  if (uDriftAmp > 0.0) {
    vec3 q = p * uDriftFreq + aSeed.yzw * 7.0;
    float tt = uTime * uDriftSpeed;
    p += uDriftAmp * vec3(
      ue_snoise(q + vec3(tt, 0.0, 0.0)),
      ue_snoise(q + vec3(0.0, tt, 31.4)),
      ue_snoise(q + vec3(17.2, 0.0, tt)));
  }

  // Form: staggered, eased blend toward the target surface.
  if (uForm > 0.0) {
    vec3 local = uTargetMode == 1
      ? aTarget
      : mix(ue_shape(uShapeA, aSeed.zw), ue_shape(uShapeB, aSeed.zw), uMix);
    vec3 target = (uTargetMatrix * vec4(local, 1.0)).xyz + (aSeed.wxy - 0.5) * uJitter;
    float delay = aSeed.x * uStagger;
    float f = clamp((uForm - delay) / max(1e-4, 1.0 - uStagger), 0.0, 1.0);
    f = 1.0 - pow(1.0 - f, 3.0);
    p = mix(p, target, f);
  }

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 1e-3);

  // Pixel diameter of the particle, then the lens circle of confusion (thin-lens approximation).
  float pxPerUnit = projectionMatrix[1][1] * 0.5 * uViewportH / depth;
  float sizePx = max(uSize * pxPerUnit * (0.55 + 0.9 * aSeed.y), 1.2);
  float cocPx = uBokeh * uViewportH * abs(1.0 / max(uFocus, 1e-3) - 1.0 / depth);
  float total = min(sqrt(sizePx * sizePx + cocPx * cocPx), 120.0);
  gl_PointSize = total;

  // Energy-conserving: a blurred particle spreads the same light over a larger disc.
  vAlpha = uOpacity * (sizePx * sizePx) / (total * total);
  vColor = mix(uColorA, uColorB, aSeed.w) * uIntensity;
  vViewZ = mv.z;
}
`;

const FRAGMENT = /* glsl */ `
#include <packing>
uniform sampler2D uDepth;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform float uSoft;
uniform int uUseDepth;
varying vec3 vColor;
varying float vAlpha;
varying float vViewZ;
void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float r2 = dot(pc, pc) * 4.0;
  if (r2 > 1.0) discard;
  float a = vAlpha * exp(-r2 * 3.0) * (1.0 - r2);
  if (uUseDepth == 1) {
    float d = texture2D(uDepth, gl_FragCoord.xy / uResolution).r;
    float sceneZ = perspectiveDepthToViewZ(d, uNear, uFar);
    a *= clamp((vViewZ - sceneZ) / uSoft, 0.0, 1.0);   // hidden behind geometry, soft at contact
  }
  if (a < 0.0005) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`;

export type ParticleUniforms = ReturnType<typeof createUniforms>;

function createUniforms() {
  return {
    uTime: { value: 0 },
    uDriftAmp: { value: 0 },
    uDriftFreq: { value: 0.6 },
    uDriftSpeed: { value: 0.25 },
    uSwirl: { value: 0 },
    uForm: { value: 0 },
    uStagger: { value: 0.6 },
    uJitter: { value: 0.01 },
    uTargetMode: { value: 0 },
    uShapeA: { value: 0 },
    uShapeB: { value: 0 },
    uMix: { value: 0 },
    uTargetMatrix: { value: new THREE.Matrix4() },
    uSize: { value: 0.02 },
    uViewportH: { value: 1080 },
    uFocus: { value: 5 },
    uBokeh: { value: 0.06 },
    uOpacity: { value: 1 },
    uIntensity: { value: 2 },
    uColorA: { value: new THREE.Color() },
    uColorB: { value: new THREE.Color() },
    // Filled per frame by the particles pass:
    uDepth: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 0.05 },
    uFar: { value: 200 },
    uSoft: { value: 0.15 },
    uUseDepth: { value: 0 },
  };
}

type SeededSampler = MeshSurfaceSampler & { setRandomGenerator(fn: () => number): MeshSurfaceSampler };

/** Marker so the particles pass can find and feed particle materials. */
export const PARTICLE_MATERIAL_FLAG = "isEngineParticles";

function emitterPoint(spec: ParticlesNodeSpec["emitter"], r: () => number, out: THREE.Vector3) {
  const R = spec.radius;
  if (spec.shape === "box") {
    const [ex, ey, ez] = spec.extent ?? [R, R, R];
    return out.set((r() * 2 - 1) * ex, (r() * 2 - 1) * ey, (r() * 2 - 1) * ez);
  }
  if (spec.shape === "disc") {
    const a = r() * Math.PI * 2;
    const d = R * Math.sqrt(r());
    return out.set(Math.cos(a) * d, (r() - 0.5) * 0.08 * R, Math.sin(a) * d);
  }
  // Uniform direction on the sphere.
  const z = r() * 2 - 1;
  const a = r() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  const radius = spec.shape === "shell" ? R * (0.85 + 0.15 * r()) : R * Math.cbrt(r());
  return out.set(Math.cos(a) * s * radius, z * radius, Math.sin(a) * s * radius);
}

export const ParticlesNode: React.FC<{
  spec: ParticlesNodeSpec;
  ctx: EvalContext;
  palette: Palette;
  seed: number;
  sceneId: string;
  sceneNodes: NodeSpec[];
}> = ({ spec, ctx, palette, seed, sceneId, sceneNodes }) => {
  const targetSpec = useMemo(() => {
    const t = spec.form?.target;
    if (!t || !("node" in t)) return null;
    const found = sceneNodes.find((n) => n.id === t.node);
    if (!found || (found.type !== "morph" && found.type !== "logo")) {
      throw new Error(`Particles "${spec.id}": form target node "${t.node}" must be a morph or logo node in scene "${sceneId}".`);
    }
    return found as MorphNodeSpec | LogoNodeSpec;
  }, [spec, sceneNodes, sceneId]);

  const logoTarget = targetSpec?.type === "logo" ? targetSpec : null;
  // Hook order stays stable: with no logo target the hook is a no-op (null src).
  const logoGeometry = useLogoGeometry(logoTarget?.src ?? null, logoTarget?.depth ?? 0, logoTarget?.bevel ?? 0);
  const targetGeometry = logoTarget ? logoGeometry : null;

  const geometry = useMemo(() => {
    const n = spec.count;
    const r = rng(seed, sceneId, spec.id);
    const seeds = new Float32Array(n * 4);
    const home = new Float32Array(n * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      seeds.set([r(), r(), r(), r()], i * 4);
      emitterPoint(spec.emitter, r, v);
      home.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(home.slice(), 3)); // for bounds only
    g.setAttribute("aHome", new THREE.BufferAttribute(home, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    g.setAttribute("aTarget", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    return g;
  }, [spec.count, spec.emitter, spec.id, seed, sceneId]);

  // Seeded surface sampling of the logo target (same points in every render tab).
  useMemo(() => {
    if (!targetGeometry) return;
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(targetGeometry));
    // setRandomGenerator exists in three's JS but is missing from @types/three 0.187.
    (sampler as SeededSampler).setRandomGenerator(rng(seed, sceneId, spec.id, "target"));
    sampler.build();
    const attr = geometry.getAttribute("aTarget") as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < attr.count; i++) {
      sampler.sample(v);
      attr.setXYZ(i, v.x, v.y, v.z);
    }
    attr.needsUpdate = true;
  }, [targetGeometry, geometry, seed, sceneId, spec.id]);

  const uniforms = useMemo(createUniforms, []);
  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    });
    m.userData[PARTICLE_MATERIAL_FLAG] = true;
    return m;
  }, [uniforms]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const xf = nodeTransform(spec, ctx);
  const form = spec.form;
  const formProgress = form ? evalNumber(form.progress, ctx) : 0;
  const morph = targetSpec?.type === "morph" ? morphState(targetSpec, ctx) : null;
  const targetXf = targetSpec ? nodeTransform(targetSpec, ctx) : null;

  useLayoutEffect(() => {
    uniforms.uTime.value = ctx.sceneStart + ctx.t;
    uniforms.uDriftAmp.value = spec.drift ? evalNumber(spec.drift.amount, ctx) : 0;
    uniforms.uDriftFreq.value = spec.drift?.frequency ?? 0.6;
    uniforms.uDriftSpeed.value = spec.drift?.speed ?? 0.25;
    uniforms.uSwirl.value = evalNumber(spec.swirl, ctx);
    uniforms.uSize.value = spec.size;
    uniforms.uBokeh.value = spec.bokeh;
    uniforms.uOpacity.value = evalNumber(spec.opacity, ctx);
    uniforms.uIntensity.value = evalNumber(spec.intensity, ctx);
    uniforms.uColorA.value.copy(resolveColor(spec.color, palette));
    uniforms.uColorB.value.copy(resolveColor(spec.colorB ?? spec.color, palette));

    uniforms.uForm.value = formProgress;
    if (form) {
      uniforms.uStagger.value = form.stagger;
      uniforms.uJitter.value = form.jitter;
      const t = form.target;
      if ("shape" in t) {
        uniforms.uTargetMode.value = 0;
        uniforms.uShapeA.value = MORPH_SHAPE_IDS[t.shape];
        uniforms.uShapeB.value = MORPH_SHAPE_IDS[t.shape];
        uniforms.uMix.value = 0;
        uniforms.uTargetMatrix.value.makeScale(t.scale, t.scale, t.scale);
      } else if (targetXf) {
        uniforms.uTargetMode.value = morph ? 0 : 1;
        if (morph) {
          uniforms.uShapeA.value = morph.a;
          uniforms.uShapeB.value = morph.b;
          uniforms.uMix.value = morph.mix;
        }
        // Target is a sibling node: express its transform in this node's local space.
        const targetWorld = new THREE.Matrix4().compose(
          targetXf.position,
          new THREE.Quaternion().setFromEuler(targetXf.rotation),
          new THREE.Vector3(targetXf.scale, targetXf.scale, targetXf.scale),
        );
        const selfWorld = new THREE.Matrix4().compose(
          xf.position,
          new THREE.Quaternion().setFromEuler(xf.rotation),
          new THREE.Vector3(xf.scale || 1, xf.scale || 1, xf.scale || 1),
        );
        uniforms.uTargetMatrix.value.copy(selfWorld.invert().multiply(targetWorld));
      }
    }
  });

  // A logo target that has not loaded yet: hold off drawing (the render is delayed until it has).
  if (logoTarget && !targetGeometry) return null;

  return (
    <points
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
