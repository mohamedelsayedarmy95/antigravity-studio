import * as THREE from "three";
import type { BeatGrid } from "../engine/time/beatGrid";
import { lengthToSeconds } from "../engine/time/timeRef";
import { Film3DSchema, resolvePost, type ColorRef, type Film3DInput, type Film3DSpec, type Palette, type ResolvedPost, type SceneSpec, type TransitionSpec } from "./schema";

export interface PlannedTransition {
  type: TransitionSpec["type"];
  color: ColorRef;
  /** Absolute seconds. */
  start: number;
  end: number;
}

export interface PlannedScene {
  index: number;
  id: string;
  spec: SceneSpec;
  post: ResolvedPost;
  /** Absolute seconds: the scene's nominal span (cut to cut). */
  start: number;
  length: number;
  transitionIn: PlannedTransition | null;
  /** Frames during which the scene must be mounted (visible span plus premount). */
  mountStart: number;
  mountEnd: number;
}

export interface FilmPlan {
  spec: Film3DSpec;
  fps: number;
  grid: BeatGrid;
  palette: Palette;
  seed: number;
  /** Absolute-seconds markers available to every TimeRef in the film. */
  markers: Readonly<Record<string, number>>;
  totalSeconds: number;
  durationInFrames: number;
  scenes: PlannedScene[];
}

export type FrameComposite =
  | { mode: "single"; scene: PlannedScene }
  | { mode: "transition"; from: PlannedScene | null; to: PlannedScene; transition: PlannedTransition; progress: number };

const PREMOUNT_FRAMES = 12;

/**
 * Pure planning step: validates the spec, resolves scene lengths on the beat grid, centres each
 * transition on its cut, and computes mount windows. No React, no GPU — unit-testable.
 */
export function planFilm(input: Film3DInput, markers: Readonly<Record<string, number>> = {}): FilmPlan {
  const parsed = Film3DSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid film spec "${(input as { id?: string }).id ?? "?"}":\n${issues}`);
  }
  const spec = parsed.data;
  const fps = spec.fps;
  const grid: BeatGrid = spec.grid;

  let cursor = 0;
  const raw = spec.scenes.map((scene, index) => {
    const length = lengthToSeconds(scene.length, fps, grid);
    if (length <= 0) throw new Error(`Scene "${scene.id}" has zero length.`);
    const start = cursor;
    cursor += length;
    return { scene, index, start, length };
  });
  const totalSeconds = cursor;
  const durationInFrames = Math.round(totalSeconds * fps);

  const scenes: PlannedScene[] = raw.map(({ scene, index, start, length }) => {
    let transitionIn: PlannedTransition | null = null;
    if (scene.transitionIn && scene.transitionIn.type !== "cut") {
      const len = lengthToSeconds(scene.transitionIn.length, fps, grid);
      // Scene 0 fades in from black starting at 0; later transitions are centred on the cut.
      const tStart = index === 0 ? 0 : start - len / 2;
      transitionIn = { type: scene.transitionIn.type, color: scene.transitionIn.color, start: tStart, end: tStart + len };
    }
    return { index, id: scene.id, spec: scene, post: resolvePost(spec.lookPost, spec.post, scene.post), start, length, transitionIn, mountStart: 0, mountEnd: 0 };
  });

  // Visible span: from the start of this scene's incoming transition to the end of the next one's.
  for (const s of scenes) {
    const next = scenes[s.index + 1];
    const visStart = s.transitionIn ? Math.min(s.start, s.transitionIn.start) : s.start;
    const visEnd = next?.transitionIn ? Math.max(s.start + s.length, next.transitionIn.end) : s.start + s.length;
    s.mountStart = Math.max(0, Math.floor(visStart * fps) - PREMOUNT_FRAMES);
    s.mountEnd = Math.min(durationInFrames, Math.ceil(visEnd * fps) + 1);
  }

  const ids = new Set<string>();
  for (const s of scenes) {
    if (ids.has(s.id)) throw new Error(`Duplicate scene id "${s.id}".`);
    ids.add(s.id);
  }

  return { spec, fps, grid, palette: spec.palette, seed: spec.seed, markers, totalSeconds, durationInFrames, scenes };
}

/** What the compositor draws at absolute time t. */
export function compositeAt(plan: FilmPlan, t: number): FrameComposite {
  // Frame timestamps use a single division while scene boundaries accumulate. Treat a
  // sub-nanosecond rounding difference as equality and keep the original motion time.
  const boundaryTime = t + 1e-9;
  for (const s of plan.scenes) {
    const tr = s.transitionIn;
    if (tr && boundaryTime >= tr.start && boundaryTime < tr.end) {
      const from = s.index === 0 ? null : plan.scenes[s.index - 1];
      const progress = Math.max(0, (t - tr.start) / (tr.end - tr.start));
      return { mode: "transition", from, to: s, transition: tr, progress };
    }
  }
  const scene = plan.scenes.find((s) => boundaryTime >= s.start && boundaryTime < s.start + s.length) ?? plan.scenes[plan.scenes.length - 1];
  return { mode: "single", scene };
}

/** Resolves "palette.primary" / "#rrggbb" to a linear-space THREE.Color. */
export function resolveColor(ref: ColorRef, palette: Palette): THREE.Color {
  const hex = ref.startsWith("palette.") ? palette[ref.slice("palette.".length) as keyof Palette] : ref;
  return new THREE.Color(hex); // THREE.Color parses sRGB hex into linear working space.
}
