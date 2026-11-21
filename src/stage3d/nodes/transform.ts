import * as THREE from "three";
import { evalNumber, evalVec3, type EvalContext } from "../../engine/time/animatable";
import { applyEase } from "../../engine/time/ease";
import { lengthToSeconds, resolveTimeRef } from "../../engine/time/timeRef";
import type { MorphNodeSpec, MorphShape, NodeSpec } from "../schema";

export interface NodeTransform {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
  visible: boolean;
}

const DEG = Math.PI / 180;

/** Base transform plus enter/exit choreography, as a pure function of scene time. */
export function nodeTransform(spec: NodeSpec, ctx: EvalContext): NodeTransform {
  const [px, py, pz] = evalVec3(spec.position, ctx);
  const [rx, ry, rz] = evalVec3(spec.rotation, ctx);
  let scale = evalNumber(spec.scale, ctx);
  let y = py;

  if (spec.enter && spec.enter.style !== "none") {
    const start = resolveTimeRef(spec.enter.at, ctx);
    const e = applyEase(spec.enter.ease, ctx.t - start, lengthToSeconds(spec.enter.length, ctx.fps, ctx.grid), ctx.fps);
    if (spec.enter.style === "scale") scale *= e;
    if (spec.enter.style === "rise") {
      y -= (1 - e) * 0.9;
      scale *= 0.6 + 0.4 * Math.min(1, e);
      if (ctx.t < start) scale = 0;
    }
  }
  if (spec.exit) {
    const start = resolveTimeRef(spec.exit.at, ctx);
    const e = applyEase(spec.exit.ease, ctx.t - start, lengthToSeconds(spec.exit.length, ctx.fps, ctx.grid), ctx.fps);
    if (spec.exit.style === "scale") scale *= Math.max(0, 1 - e);
    if (spec.exit.style === "sink") {
      y -= e * 0.9;
      scale *= Math.max(0, 1 - 0.35 * e);
    }
  }

  return {
    position: new THREE.Vector3(px, y, pz),
    rotation: new THREE.Euler(rx * DEG, ry * DEG, rz * DEG, "XYZ"),
    scale,
    visible: scale > 1e-4,
  };
}

/** Shape ids shared with SHAPES_GLSL's ue_shape(). */
export const MORPH_SHAPE_IDS: Record<MorphShape, number> = {
  sphere: 0,
  icosahedron: 1,
  roundedBox: 2,
  torus: 3,
  torusKnot: 4,
};

export interface MorphState {
  a: number;
  b: number;
  /** Blend from a to b; may overshoot past 1 with spring eases (intended). */
  mix: number;
}

/** Which two shapes are blending at scene time t, and how far. */
export function morphState(spec: MorphNodeSpec, ctx: EvalContext): MorphState {
  if (spec.keys.length !== spec.shapes.length) {
    throw new Error(`Morph "${spec.id}": shapes (${spec.shapes.length}) and keys (${spec.keys.length}) must have the same length.`);
  }
  const duration = lengthToSeconds(spec.morphLength, ctx.fps, ctx.grid);
  let state: MorphState = { a: MORPH_SHAPE_IDS[spec.shapes[0]], b: MORPH_SHAPE_IDS[spec.shapes[0]], mix: 0 };
  for (let i = 1; i < spec.shapes.length; i++) {
    const start = resolveTimeRef(spec.keys[i], ctx);
    if (ctx.t >= start) {
      state = {
        a: MORPH_SHAPE_IDS[spec.shapes[i - 1]],
        b: MORPH_SHAPE_IDS[spec.shapes[i]],
        mix: applyEase(spec.ease, ctx.t - start, duration, ctx.fps),
      };
    }
  }
  return state;
}
