import { z } from "zod";
import { beatImpulse } from "./beatGrid";
import { applyEase, EaseSchema } from "./ease";
import { LengthSchema, lengthToSeconds, resolveTimeRef, TimeRefSchema, type TimeContext } from "./timeRef";

/**
 * Animatable parameters. Anything in a config that can move accepts one of:
 *   5                                         constant
 *   { keys: [{ at: "0b", value: 1 }, { at: "4b", value: 2, ease: "appleHero" }] }
 *   { base: 1, mod: { source: "beat", amount: 0.05 } }     beat-reactive pulse on top of a base
 * Evaluation is a pure function of scene time, so every frame (and sub-frame) is reproducible.
 */

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3Schema>;

export const ModSchema = z.object({
  /** Impulse source. M4 adds spectral sources (bass, mid, treble, onset) from audio analysis. */
  source: z.enum(["beat", "downbeat"]),
  amount: z.union([z.number(), Vec3Schema]),
  decay: LengthSchema.optional(),
});
export type Mod = z.infer<typeof ModSchema>;

function animatable<T extends z.ZodType>(value: T) {
  const track = z.object({
    keys: z
      .array(z.object({ at: TimeRefSchema, value, ease: EaseSchema.optional() }))
      .min(1),
  });
  const modulated = z.object({
    base: z.union([value, track]),
    mod: z.union([ModSchema, z.array(ModSchema)]),
  });
  return z.union([value, track, modulated]);
}

export const AnimNumberSchema = animatable(z.number());
export const AnimVec3Schema = animatable(Vec3Schema);
export type AnimNumber = z.infer<typeof AnimNumberSchema>;
export type AnimVec3 = z.infer<typeof AnimVec3Schema>;

export interface EvalContext extends TimeContext {
  /** Scene-relative time in seconds (may be fractional between frames). */
  t: number;
}

type Track<T> = { keys: Array<{ at: z.infer<typeof TimeRefSchema>; value: T; ease?: z.infer<typeof EaseSchema> }> };
type Modulated<T> = { base: T | Track<T>; mod: Mod | Mod[] };

// Arrays are excluded explicitly: every array has a built-in `.keys` method, so a Vec3 like
// [0, 1, 0] would otherwise be mistaken for a keyframe track.
const isPlainObject = (a: unknown): a is object => typeof a === "object" && a !== null && !Array.isArray(a);
const isTrack = <T>(a: unknown): a is Track<T> => isPlainObject(a) && "keys" in a;
const isModulated = <T>(a: unknown): a is Modulated<T> => isPlainObject(a) && "base" in a;

/**
 * Additive keyframes: value = v0 + Σ (v_i − v_{i−1}) · ease_i(t). Each segment's ease runs from the
 * previous key to its own key; springs keep settling past their key instead of being cut off.
 */
function evalTrack<T>(track: Track<T>, ctx: EvalContext, add: (a: T, b: T, k: number) => T, sub: (a: T, b: T) => T): T {
  const keys = track.keys
    .map((k) => ({ ...k, sec: resolveTimeRef(k.at, ctx) }))
    .sort((a, b) => a.sec - b.sec);
  let value = keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    const start = keys[i - 1].sec;
    const progress = applyEase(keys[i].ease ?? "smooth", ctx.t - start, keys[i].sec - start, ctx.fps);
    value = add(value, sub(keys[i].value, keys[i - 1].value), progress);
  }
  return value;
}

function modAmount(mod: Mod, ctx: EvalContext): number {
  const decay = mod.decay === undefined ? 0.18 : lengthToSeconds(mod.decay, ctx.fps, ctx.grid);
  const every = mod.source === "downbeat" ? ctx.grid.beatsPerBar : 1;
  return beatImpulse(ctx.grid, ctx.sceneStart + ctx.t, { every, decay });
}

const toMods = (m: Mod | Mod[]) => (Array.isArray(m) ? m : [m]);

export function evalNumber(a: AnimNumber, ctx: EvalContext): number {
  if (typeof a === "number") return a;
  const add = (x: number, y: number, k: number) => x + y * k;
  const sub = (x: number, y: number) => x - y;
  if (isModulated<number>(a)) {
    const base = typeof a.base === "number" ? a.base : evalTrack(a.base, ctx, add, sub);
    return toMods(a.mod).reduce((v, m) => v + (typeof m.amount === "number" ? m.amount : m.amount[0]) * modAmount(m, ctx), base);
  }
  if (isTrack<number>(a)) return evalTrack(a, ctx, add, sub);
  return a;
}

export function evalVec3(a: AnimVec3, ctx: EvalContext): Vec3 {
  const add = (x: Vec3, y: Vec3, k: number): Vec3 => [x[0] + y[0] * k, x[1] + y[1] * k, x[2] + y[2] * k];
  const sub = (x: Vec3, y: Vec3): Vec3 => [x[0] - y[0], x[1] - y[1], x[2] - y[2]];
  if (isModulated<Vec3>(a)) {
    const base = isTrack<Vec3>(a.base) ? evalTrack(a.base, ctx, add, sub) : a.base;
    return toMods(a.mod).reduce<Vec3>((v, m) => {
      const k = modAmount(m, ctx);
      const amt: Vec3 = typeof m.amount === "number" ? [m.amount, m.amount, m.amount] : m.amount;
      return add(v, amt, k);
    }, base);
  }
  if (isTrack<Vec3>(a)) return evalTrack(a, ctx, add, sub);
  return a;
}
