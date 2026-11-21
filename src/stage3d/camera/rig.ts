import * as THREE from "three";
import { evalNumber, evalVec3, type EvalContext } from "../../engine/time/animatable";
import { beatImpulse, impulseIndex } from "../../engine/time/beatGrid";
import { applyEase } from "../../engine/time/ease";
import { rng } from "../../engine/time/rng";
import { lengthToSeconds, resolveTimeRef } from "../../engine/time/timeRef";
import type { CameraSpec } from "../schema";

const DEG = Math.PI / 180;

export interface CameraState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  /** Radians around the view axis. */
  roll: number;
  /** Vertical field of view, degrees. */
  vfov: number;
}

/**
 * Focal length (mm, full-frame equivalent) → field of view across the frame's SHORT side.
 * Applying the lens to the short side keeps an "85mm" shot feeling like 85mm in 16:9, 9:16 and 1:1.
 */
export const shortSideFov = (mm: number) => 2 * Math.atan(24 / (2 * mm));

/**
 * The camera as a pure function of scene time: a spherical base pose around the target, plus
 * additive rig moves (orbit, push, crane, truck), seeded handheld noise and beat impulses.
 */
export function solveCamera(spec: CameraSpec, ctx: EvalContext, aspect: number, seed: number, key: string): CameraState {
  const lens = evalNumber(spec.lens, ctx);
  const short = shortSideFov(lens);
  const vfov = aspect >= 1 ? short : 2 * Math.atan(Math.tan(short / 2) / aspect);

  let distance =
    typeof spec.distance === "number" ? spec.distance : spec.distance.radius / Math.sin((short * spec.distance.fill) / 2);
  let azimuth = spec.azimuth * DEG;
  let elevation = spec.elevation * DEG;
  let roll = 0;
  let truck = 0;
  let crane = 0;
  const absT = ctx.sceneStart + ctx.t;

  for (const move of spec.moves) {
    if (move.rig === "handheld") {
      const r = rng(seed, key, "handheld");
      const wobble = (amp: number) => {
        let v = 0;
        for (const mult of [1, 2.3, 4.1]) v += Math.sin(2 * Math.PI * move.frequency * mult * absT + r() * 6.283) / mult;
        return v * amp;
      };
      azimuth += wobble(move.amount * DEG);
      elevation += wobble(move.amount * 0.7 * DEG);
      roll += wobble(move.amount * 0.4 * DEG);
      continue;
    }
    if (move.rig === "impulse") {
      const every = move.on === "downbeat" ? ctx.grid.beatsPerBar : 1;
      const k = beatImpulse(ctx.grid, absT, { every, decay: lengthToSeconds(move.decay, ctx.fps, ctx.grid) });
      distance *= 1 - move.scale * k;
      roll += (impulseIndex(ctx.grid, absT, every) % 2 === 0 ? 1 : -1) * move.roll * DEG * k;
      continue;
    }
    const from = move.from === undefined ? 0 : resolveTimeRef(move.from, ctx);
    const to = move.to === undefined ? ctx.sceneLength : resolveTimeRef(move.to, ctx);
    const e = applyEase(move.ease, ctx.t - from, to - from, ctx.fps);
    if (move.rig === "orbit") azimuth += move.degrees * DEG * e;
    if (move.rig === "pushIn") distance *= 1 - move.amount * e;
    if (move.rig === "pullBack") distance *= 1 + move.amount * e;
    if (move.rig === "crane") crane += move.amount * e;
    if (move.rig === "truck") truck += move.amount * e;
  }

  const target = new THREE.Vector3(...evalVec3(spec.target, ctx));
  const offset = new THREE.Vector3(
    distance * Math.cos(elevation) * Math.sin(azimuth),
    distance * Math.sin(elevation),
    distance * Math.cos(elevation) * Math.cos(azimuth),
  );
  const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
  const position = target.clone().add(offset).addScaledVector(right, truck);
  target.addScaledVector(right, truck);
  position.y += crane;

  return { position, target, roll, vfov: vfov / DEG };
}

export function applyCamera(camera: THREE.PerspectiveCamera, state: CameraState, aspect: number) {
  camera.position.copy(state.position);
  camera.up.set(0, 1, 0);
  camera.lookAt(state.target);
  camera.rotateZ(state.roll);
  camera.fov = state.vfov;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

/**
 * Apparent camera speed between two states (radians of view rotation per second plus relative
 * dolly speed). Drives motion-reactive chromatic aberration.
 */
export function cameraSpeed(a: CameraState, b: CameraState, dt: number): number {
  const dirA = a.target.clone().sub(a.position).normalize();
  const dirB = b.target.clone().sub(b.position).normalize();
  const angle = dirA.angleTo(dirB);
  const travel = a.position.distanceTo(b.position) / Math.max(1e-3, a.position.distanceTo(a.target));
  return (angle + travel + Math.abs(a.roll - b.roll)) / dt;
}
