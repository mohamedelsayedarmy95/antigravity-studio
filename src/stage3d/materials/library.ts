import * as THREE from "three";
import { evalNumber, type EvalContext } from "../../engine/time/animatable";
import { rng } from "../../engine/time/rng";
import { resolveColor } from "../plan";
import type { MaterialPreset, MaterialSpec, Palette } from "../schema";

/**
 * Material library. Every preset is a physically based MeshPhysicalMaterial (or, for wireGlow,
 * an unlit emissive wireframe) lit by the scene's studio environment — never a flat fake.
 */

export interface MaterialRecipe {
  kind: "physical" | "basic";
  params: THREE.MeshPhysicalMaterialParameters & THREE.MeshBasicMaterialParameters;
}

const PRESETS: Record<MaterialPreset, (palette: Palette) => MaterialRecipe> = {
  chrome: () => ({ kind: "physical", params: { color: 0xffffff, metalness: 1, roughness: 0.06 } }),
  liquidChrome: () => ({
    kind: "physical",
    params: {
      color: 0xf4f6f8,
      metalness: 1,
      roughness: 0.03,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      iridescence: 0.35,
      iridescenceIOR: 1.6,
      iridescenceThicknessRange: [180, 620],
    },
  }),
  brushedMetal: () => ({
    kind: "physical",
    params: { color: 0xc9ccd1, metalness: 1, roughness: 0.32, anisotropy: 0.85, anisotropyRotation: Math.PI / 2 },
  }),
  glass: () => ({
    kind: "physical",
    params: {
      color: 0xffffff,
      metalness: 0,
      roughness: 0.04,
      transmission: 1,
      thickness: 1.1,
      ior: 1.5,
      specularIntensity: 1,
      attenuationColor: new THREE.Color(0xdfefff),
      attenuationDistance: 2.5,
    },
  }),
  iridescentGlass: () => ({
    kind: "physical",
    params: {
      color: 0xffffff,
      metalness: 0,
      roughness: 0.05,
      transmission: 1,
      thickness: 1.4,
      ior: 1.45,
      iridescence: 1,
      iridescenceIOR: 1.33,
      iridescenceThicknessRange: [120, 820],
      dispersion: 0.25,
    },
  }),
  ceramic: () => ({ kind: "physical", params: { color: 0xf2f1ee, metalness: 0, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.18 } }),
  obsidian: () => ({ kind: "physical", params: { color: 0x0b0c0e, metalness: 0.1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 } }),
  neonEmissive: (p) => ({
    kind: "physical",
    params: { color: 0x050505, metalness: 0, roughness: 0.4, emissive: resolveColor("palette.primary", p), emissiveIntensity: 4 },
  }),
  wireGlow: (p) => ({ kind: "basic", params: { color: resolveColor("palette.primary", p).multiplyScalar(3), wireframe: true } }),
};

/** Static recipe for a material spec (structure + initial values). */
export function materialRecipe(spec: MaterialSpec, palette: Palette): MaterialRecipe {
  const preset = typeof spec === "string" ? spec : spec.preset;
  const recipe = PRESETS[preset](palette);
  if (typeof spec !== "string") {
    if (spec.color) recipe.params.color = resolveColor(spec.color, palette);
    if (spec.emissive) recipe.params.emissive = resolveColor(spec.emissive, palette);
  }
  return recipe;
}

/**
 * Physical-material view of any material. Duck-typed on purpose: three-custom-shader-material
 * copies MeshPhysicalMaterial's properties onto a plain Material, so `instanceof` is false for
 * morphs even though they shade physically.
 */
export function asPhysical(material: THREE.Material): THREE.MeshPhysicalMaterial | null {
  return "transmission" in material && "iridescence" in material ? (material as THREE.MeshPhysicalMaterial) : null;
}

export const isTransmissive = (material: THREE.Material) => (asPhysical(material)?.transmission ?? 0) > 0;

/** Applies the animatable parts of a material spec at the current time. */
export function applyMaterialAnimation(target: THREE.Material, spec: MaterialSpec, ctx: EvalContext) {
  const material = asPhysical(target);
  if (typeof spec === "string" || !material) return;
  if (spec.roughness !== undefined) material.roughness = evalNumber(spec.roughness, ctx);
  if (spec.metalness !== undefined) material.metalness = evalNumber(spec.metalness, ctx);
  if (spec.emissiveIntensity !== undefined) material.emissiveIntensity = evalNumber(spec.emissiveIntensity, ctx);
  if (spec.iridescence !== undefined) material.iridescence = evalNumber(spec.iridescence, ctx);
}

/** Creates a plain (non-morphing) material from a recipe. */
export function createMaterial(recipe: MaterialRecipe): THREE.Material {
  if (recipe.kind === "basic") return new THREE.MeshBasicMaterial(recipe.params);
  const material = new THREE.MeshPhysicalMaterial(recipe.params);
  if (recipe.params.anisotropy) material.roughnessMap = brushedRoughnessMap();
  return material;
}

let brushedMap: THREE.DataTexture | null = null;

/**
 * Seeded brushed-metal roughness texture: fine directional streaks (long along U, thin along V).
 * Generated once on the CPU from a fixed seed, so every frame and every render tab gets the same map.
 */
export function brushedRoughnessMap(): THREE.DataTexture {
  if (brushedMap) return brushedMap;
  const w = 1024;
  const h = 1024;
  const data = new Uint8Array(w * h * 4);
  const r = rng(1, "brushed-metal-roughness");
  const rows = new Float32Array(h);
  for (let y = 0; y < h; y++) rows[y] = r();
  for (let y = 0; y < h; y++) {
    // Each row is one "brush stroke": a base value plus slow variation along its length.
    const base = 0.75 + 0.25 * (0.6 * rows[y] + 0.4 * rows[(y + 1) % h]);
    const phase = rows[(y * 7) % h] * 6.283;
    for (let x = 0; x < w; x++) {
      const v = base * (0.92 + 0.08 * Math.sin(phase + x * 0.004));
      const g = Math.round(Math.min(1, v) * 255);
      const i = (y * w + x) * 4;
      data[i] = g;
      data[i + 1] = g; // roughnessMap reads the green channel
      data[i + 2] = g;
      data[i + 3] = 255;
    }
  }
  brushedMap = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  brushedMap.wrapS = THREE.RepeatWrapping;
  brushedMap.wrapT = THREE.RepeatWrapping;
  brushedMap.repeat.set(1, 3);
  brushedMap.anisotropy = 8;
  brushedMap.magFilter = THREE.LinearFilter;
  brushedMap.minFilter = THREE.LinearMipmapLinearFilter;
  brushedMap.generateMipmaps = true;
  brushedMap.needsUpdate = true;
  return brushedMap;
}
