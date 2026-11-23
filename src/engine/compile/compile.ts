import { beatsToSeconds, secondsPerBeat, type BeatGrid } from "../time/beatGrid";
import { lengthToSeconds, resolveTimeRef, type TimeContext } from "../time/timeRef";
import { LOOKS, type Look } from "../../looks";
import type { OverlayElement } from "../../layer2d/schema";
import { planFilm, type FilmPlan } from "../../stage3d/plan";
import type { Film3DInput, Palette } from "../../stage3d/schema";
import { FilmSpecSchema, type FilmSpec, type FilmSpecInput } from "../schema/film";

/**
 * FilmSpec compiler: validate → resolve look → snap scene cuts to the beat grid → resolve markers
 * → check references → plan the 3D stage → time every 2D element. Pure and deterministic; all
 * problems are reported together with their field paths.
 */

export interface PlannedOverlay {
  key: string;
  sceneId: string;
  element: OverlayElement;
  /** Absolute seconds. */
  inSec: number;
  /** Exit starts here. */
  outSec: number;
  /** Fully gone here (outSec + exit length). */
  endSec: number;
}

export interface CutSnap {
  sceneId: string;
  requestedEnd: number;
  snappedEnd: number;
}

export interface CompiledFilm {
  spec: FilmSpec;
  look: Look;
  palette: Palette;
  stage: FilmPlan;
  overlays: PlannedOverlay[];
  markers: Record<string, number>;
  snaps: CutSnap[];
  fps: number;
  durationInFrames: number;
}

export class FilmSpecError extends Error {
  constructor(
    readonly filmId: string,
    readonly issues: string[],
  ) {
    super(`Film "${filmId}" has ${issues.length} problem${issues.length === 1 ? "" : "s"}:\n${issues.map((i) => `  • ${i}`).join("\n")}`);
    this.name = "FilmSpecError";
  }
}

/** Exit animation length in seconds. */
export const EXIT_SECONDS = 0.35;

const MARKER_REF = /^@([A-Za-z0-9_:.-]+?)(?:[+-]\d+(?:\.\d+)?(?:s|f|b))?$/;

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function suggest(name: string, known: string[]): string {
  const best = known.map((k) => ({ k, d: editDistance(name, k) })).sort((x, y) => x.d - y.d)[0];
  // Roughly "less than half the name changed": catches dropped/duplicated letters in real typos.
  return best && best.d <= Math.max(2, Math.ceil(name.length * 0.45)) ? ` Did you mean "${best.k}"?` : "";
}

/** Every string in a value that looks like a marker reference, with its path. */
function* markerRefs(value: unknown, path: string): Generator<{ path: string; ref: string }> {
  if (typeof value === "string" && value.startsWith("@")) yield { path, ref: value };
  else if (Array.isArray(value)) for (let i = 0; i < value.length; i++) yield* markerRefs(value[i], `${path}.${i}`);
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) yield* markerRefs(v, `${path}.${k}`);
}

/** Snap cumulative cut points to the grid; every scene keeps at least one quantum. */
function snapCuts(lengths: number[], ids: string[], grid: BeatGrid, quantum: number): { lengths: number[]; snaps: CutSnap[] } {
  const out: number[] = [];
  const snaps: CutSnap[] = [];
  let cursor = 0;
  lengths.forEach((len, i) => {
    const requested = cursor + len;
    let end = requested;
    if (quantum > 0) {
      end = grid.offset + Math.round((requested - grid.offset) / quantum) * quantum;
      if (end < cursor + quantum - 1e-9) end = cursor + quantum;
    }
    if (Math.abs(end - requested) > 1e-6) snaps.push({ sceneId: ids[i], requestedEnd: requested, snappedEnd: end });
    out.push(end - cursor);
    cursor = end;
  });
  return { lengths: out, snaps };
}

export function compileFilm(input: FilmSpecInput): CompiledFilm {
  const filmId = (input as { id?: string }).id ?? "?";
  const parsed = FilmSpecSchema.safeParse(input);
  if (!parsed.success) {
    throw new FilmSpecError(
      filmId,
      parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    );
  }
  const spec = parsed.data;
  const issues: string[] = [];
  const look: Look = LOOKS[spec.look];
  const palette: Palette = { ...look.palette, ...spec.palette };
  const fps = spec.output.fps;
  const grid: BeatGrid = spec.audio.grid;

  // Scene ids unique; node ids unique per scene.
  const sceneIds = spec.timeline.map((s) => s.id);
  sceneIds.forEach((id, i) => sceneIds.indexOf(id) !== i && issues.push(`timeline.${i}.id: duplicate scene id "${id}"`));
  spec.timeline.forEach((s, si) => {
    const nodeIds = s.world.nodes.map((n) => n.id);
    nodeIds.forEach((id, ni) => nodeIds.indexOf(id) !== ni && issues.push(`timeline.${si}.world.nodes.${ni}.id: duplicate node id "${id}"`));
  });

  // 1. Cuts on the grid.
  const quantum =
    spec.audio.quantize === "bar" ? beatsToSeconds(grid, grid.beatsPerBar) : spec.audio.quantize === "beat" ? secondsPerBeat(grid) : 0;
  const rawLengths = spec.timeline.map((s) => lengthToSeconds(s.length, fps, grid));
  const { lengths, snaps } = snapCuts(rawLengths, sceneIds, grid, quantum);
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));
  const total = lengths.reduce((a, b) => a + b, 0);

  // 2. Markers: automatic scene markers, then film markers, then scene markers.
  const markers: Record<string, number> = {};
  spec.timeline.forEach((s, i) => {
    markers[`scene:${s.id}`] = starts[i];
    markers[`scene:${s.id}:end`] = starts[i] + lengths[i];
  });
  const filmCtx: TimeContext = { fps, grid, sceneStart: 0, sceneLength: total, markers };
  for (const [name, ref] of Object.entries(spec.markers)) {
    try {
      markers[name] = resolveTimeRef(ref, filmCtx);
    } catch (e) {
      issues.push(`markers.${name}: ${(e as Error).message}`);
    }
  }
  spec.timeline.forEach((s, i) => {
    const ctx: TimeContext = { fps, grid, sceneStart: starts[i], sceneLength: lengths[i], markers };
    for (const [name, ref] of Object.entries(s.markers)) {
      try {
        markers[`${s.id}.${name}`] = starts[i] + resolveTimeRef(ref, ctx);
      } catch (e) {
        issues.push(`timeline.${i}.markers.${name}: ${(e as Error).message}`);
      }
    }
  });

  // 3. References: markers, data series, particle form targets.
  const known = Object.keys(markers);
  spec.timeline.forEach((s, i) => {
    // Overlay TimeRefs are at/out. The other strings are literal copy or data keys.
    const overlay = s.overlay.map(({ at, out }) => ({ at, out }));
    for (const { path, ref } of markerRefs({ world: s.world, camera: s.camera, overlay, post: s.post }, `timeline.${i}`)) {
      const m = MARKER_REF.exec(ref);
      if (!m) issues.push(`${path}: invalid marker reference "${ref}" (use "@name", "@name+2b", "@name-0.5s")`);
      else if (!(m[1] in markers)) issues.push(`${path}: unknown marker "@${m[1]}".${suggest(m[1], known)}`);
    }
    s.overlay.forEach((el, ei) => {
      if (el.kind === "chart" && !(el.data in spec.data)) {
        issues.push(`timeline.${i}.overlay.${ei}.data: unknown data series "${el.data}".${suggest(el.data, Object.keys(spec.data))}`);
      }
    });
    s.world.nodes.forEach((n, ni) => {
      if (n.type !== "particles" || !n.form || !("node" in n.form.target)) return;
      const targetId = n.form.target.node;
      const target = s.world.nodes.find((x) => x.id === targetId);
      if (!target || (target.type !== "morph" && target.type !== "logo")) {
        issues.push(`timeline.${i}.world.nodes.${ni}.form.target.node: "${targetId}" must be a morph or logo node in this scene.`);
      }
    });
  });
  if (issues.length) throw new FilmSpecError(spec.id, issues);

  // 4. The 3D stage, with look defaults filled in.
  const film3d: Film3DInput = {
    id: spec.id,
    seed: spec.seed,
    fps,
    grid,
    palette,
    lookPost: look.post,
    post: spec.post,
    scenes: spec.timeline.map((s, i) => ({
      id: s.id,
      length: lengths[i],
      transitionIn: s.transitionIn ?? (i > 0 ? { type: look.transition, length: "1b", color: "palette.glow" } : undefined),
      world: {
        backdrop: s.world.backdrop ?? { type: "void", color: "palette.base" },
        lighting: s.world.lighting ?? { rig: look.lighting, intensity: 1, rotation: 0 },
        nodes: s.world.nodes,
      },
      camera: s.camera ?? { distance: 5 },
      post: s.post,
    })),
  };
  const stage = planFilm(film3d, markers);

  // 5. Time every 2D element. Default exit: finished just before the next transition (or cut).
  const overlays: PlannedOverlay[] = [];
  stage.scenes.forEach((planned, i) => {
    const s = spec.timeline[i];
    const next = stage.scenes[i + 1];
    const cut = next?.transitionIn ? next.transitionIn.start : planned.start + planned.length;
    const ctx: TimeContext = { fps, grid, sceneStart: planned.start, sceneLength: planned.length, markers };
    s.overlay.forEach((element, ei) => {
      const exitLen = element.exit === "none" ? 0 : EXIT_SECONDS;
      const inSec = planned.start + (element.at === undefined ? 0 : resolveTimeRef(element.at, ctx));
      const outSec = element.out === undefined ? cut - exitLen : planned.start + resolveTimeRef(element.out, ctx);
      const endSec = element.exit === "none" && element.out === undefined ? cut : outSec + exitLen;
      if (!(outSec > inSec)) issues.push(`timeline.${i}.overlay.${ei}: exits (${outSec.toFixed(2)}s) before it appears (${inSec.toFixed(2)}s).`);
      overlays.push({ key: `${s.id}/${element.id ?? ei}`, sceneId: s.id, element, inSec, outSec, endSec });
    });
  });
  if (issues.length) throw new FilmSpecError(spec.id, issues);

  return { spec, look, palette, stage, overlays, markers, snaps, fps, durationInFrames: stage.durationInFrames };
}
