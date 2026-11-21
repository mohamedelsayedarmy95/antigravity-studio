import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { DISPLAY_GLSL, NOISE_GLSL } from "../shaders/glsl";
import type { TransitionSpec } from "../schema";

/**
 * Final full-frame pass. Takes the tone-mapped linear output of up to two scenes, applies the
 * active GPU transition, encodes to sRGB, then adds seeded film grain and triangular dither
 * (which also prevents banding in dark gradients). Everything is a function of (progress, frame, seed).
 */
const MODE: Record<TransitionSpec["type"] | "single", number> = {
  single: 0,
  cut: 0,
  dissolve: 1,
  noiseDissolve: 2,
  lightSweep: 3,
  glitchSlice: 4,
  zoomThrough: 5,
};

const FRAGMENT = /* glsl */ `
uniform sampler2D tA;
uniform sampler2D tB;
uniform int uMode;
uniform float uProgress;
uniform vec3 uColor;
uniform vec2 uResolution;
uniform float uFrame;
uniform float uSeed;
uniform float uGrain;
varying vec2 vUv;
${NOISE_GLSL}
${DISPLAY_GLSL}

vec3 A(vec2 uv) { return texture2D(tA, clamp(uv, 0.0, 1.0)).rgb; }
vec3 B(vec2 uv) { return texture2D(tB, clamp(uv, 0.0, 1.0)).rgb; }

float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * ue_snoise(p); p *= 2.03; a *= 0.5; }
  return v;
}

vec3 dissolve(vec2 uv, float p) { return mix(A(uv), B(uv), smoothstep(0.0, 1.0, p)); }

// Organic burn: fbm threshold sweeps through, with a hot emissive rim on the edge.
vec3 noiseDissolve(vec2 uv, float p) {
  float aspect = uResolution.x / uResolution.y;
  // Low-octave noise: a few large, smooth burn fronts rather than a busy "electric" web.
  vec3 q = vec3(uv * vec2(aspect, 1.0) * 1.6, uSeed);
  float n = (ue_snoise(q) * 0.65 + ue_snoise(q * 2.1) * 0.25 + ue_snoise(q * 4.3) * 0.1) * 0.5 + 0.5;
  float th = p * 1.3 - 0.15;
  float mask = 1.0 - smoothstep(th - 0.008, th + 0.008, n);
  float d = abs(n - th);
  float rim = exp(-d * 240.0) * sin(p * 3.14159);
  return mix(A(uv), B(uv), mask) + uColor * rim * 0.7;
}

// A bright diagonal light band sweeps across; scene B is revealed behind it, with a slight
// chromatic fringe where the band refracts the image.
vec3 lightSweep(vec2 uv, float p) {
  float aspect = uResolution.x / uResolution.y;
  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
  vec2 dir = normalize(vec2(1.0, 0.42));
  float s = dot(q, dir);
  float extent = 0.5 * (aspect * abs(dir.x) + abs(dir.y));
  float width = 0.065;
  float pos = mix(-extent - width, extent + width, smoothstep(0.0, 1.0, p));
  float reveal = smoothstep(pos + width * 0.25, pos - width * 0.25, s);
  float x = (s - pos) / width;
  // Narrow specular core with a soft falloff, like a strip light passing over glass.
  float band = 0.75 * exp(-x * x * 9.0) + 0.2 * exp(-x * x * 1.2);
  vec2 fringe = dir * band * 0.004;
  vec3 a = vec3(A(uv + fringe).r, A(uv).g, A(uv - fringe).b);
  vec3 b = vec3(B(uv + fringe).r, B(uv).g, B(uv - fringe).b);
  return mix(a, b, reveal) + uColor * band * 0.45 * sin(p * 3.14159);
}

// Digital switch: horizontal slices jump between scenes at stepped, seeded times, displaced
// sideways with RGB separation; settles cleanly on B.
vec3 glitchSlice(vec2 uv, float p) {
  float steps = floor(p * 14.0);
  float rows = 18.0 + 30.0 * ue_hash12(vec2(steps, uSeed));
  float row = floor(uv.y * rows);
  float r = ue_hash12(vec2(row, steps + uSeed * 3.1));
  float energy = sin(p * 3.14159);
  float shift = (ue_hash12(vec2(row * 1.7, steps)) - 0.5) * 0.22 * energy * step(0.55, r);
  vec2 u = vec2(uv.x + shift, uv.y);
  float split = 0.012 * energy * (0.4 + r);
  bool useB = r < smoothstep(0.1, 0.9, p);
  vec3 c = useB
    ? vec3(B(u + vec2(split, 0.0)).r, B(u).g, B(u - vec2(split, 0.0)).b)
    : vec3(A(u + vec2(split, 0.0)).r, A(u).g, A(u - vec2(split, 0.0)).b);
  // Rare, partial-width flash slivers rather than solid bars.
  float flash = step(0.97, ue_hash12(vec2(row, steps * 7.0))) * energy
              * step(ue_hash12(vec2(row * 3.3, steps)), uv.x) * step(uv.x, 0.35 + ue_hash12(vec2(steps, row)));
  return c + uColor * flash * 0.22;
}

// Radial zoom blur pushing through A into B, with a light flash at the crossover.
vec3 zoomThrough(vec2 uv, float p) {
  vec2 c = vec2(0.5);
  float za = 1.0 + 1.8 * p * p;
  float zb = mix(0.55, 1.0, smoothstep(0.35, 1.0, p));
  vec3 a = vec3(0.0), b = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float k = float(i) / 11.0;
    float blur = 0.12 * sin(p * 3.14159) * k;
    a += A(c + (uv - c) / (za * (1.0 + blur)));
    b += B(c + (uv - c) / (zb * (1.0 - blur * 0.5)));
  }
  a /= 12.0; b /= 12.0;
  float x = smoothstep(0.38, 0.62, p);
  return mix(a, b, x) + uColor * exp(-pow((p - 0.5) / 0.08, 2.0)) * 0.9;
}

void main() {
  vec2 uv = vUv;
  float p = clamp(uProgress, 0.0, 1.0);
  vec3 col;
  if (uMode == 1) col = dissolve(uv, p);
  else if (uMode == 2) col = noiseDissolve(uv, p);
  else if (uMode == 3) col = lightSweep(uv, p);
  else if (uMode == 4) col = glitchSlice(uv, p);
  else if (uMode == 5) col = zoomThrough(uv, p);
  else col = A(uv);

  vec3 srgb = ue_linearToSrgb(col);
  vec2 px = gl_FragCoord.xy;
  float grain = ue_hash12(px + vec2(uFrame * 37.13, uFrame * 17.71 + uSeed)) - 0.5;
  // Grain is strongest in the midtones, like film; fades in deep blacks and highlights.
  float lum = dot(srgb, vec3(0.2126, 0.7152, 0.0722));
  srgb += grain * uGrain * (0.35 + 0.65 * 4.0 * lum * (1.0 - lum));
  float dither = ue_hash12(px * 1.37 + uFrame) - ue_hash12(px * 0.91 - uFrame * 1.3);
  srgb += dither / 255.0;
  gl_FragColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
}
`;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export interface CompositeFrame {
  a: THREE.Texture;
  b: THREE.Texture | null;
  mode: TransitionSpec["type"] | "single";
  progress: number;
  color: THREE.Color;
  frame: number;
  grain: number;
}

export class Compositor {
  private readonly quad: FullScreenQuad;
  private readonly material: THREE.ShaderMaterial;
  /** Stand-in for "the previous scene" when scene 0 fades in from black. */
  readonly black: THREE.DataTexture;

  constructor(seed: number) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        tA: { value: null },
        tB: { value: null },
        uMode: { value: 0 },
        uProgress: { value: 0 },
        uColor: { value: new THREE.Color() },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uFrame: { value: 0 },
        uSeed: { value: (seed % 997) + 0.5 },
        uGrain: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;
  }

  render(renderer: THREE.WebGLRenderer, f: CompositeFrame) {
    const u = this.material.uniforms;
    u.tA.value = f.a;
    u.tB.value = f.b ?? f.a;
    u.uMode.value = f.b ? MODE[f.mode] : 0;
    u.uProgress.value = f.progress;
    u.uColor.value.copy(f.color);
    u.uFrame.value = f.frame;
    u.uGrain.value = f.grain;
    renderer.getDrawingBufferSize(u.uResolution.value);
    renderer.setRenderTarget(null);
    this.quad.render(renderer);
  }

  dispose() {
    this.quad.dispose();
    this.material.dispose();
    this.black.dispose();
  }
}
