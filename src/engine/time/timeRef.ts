import { z } from "zod";
import { beatsToSeconds, type BeatGrid } from "./beatGrid";

/**
 * Time grammar (subset implemented in M1; M2 adds markers like "@drop").
 *   number      seconds
 *   "1.5s"      seconds
 *   "90f"       frames
 *   "2b"        beats
 *   "40%"       fraction of the scene's length          (TimeRef only)
 *   "bar 5"     start of absolute bar 5, 1-based        (TimeRef only)
 *   "2 bars"    bars                                    (Length only)
 */
export const TimeRefSchema = z.union([
  z.number(),
  z.templateLiteral([z.number(), "s"]),
  z.templateLiteral([z.number(), "f"]),
  z.templateLiteral([z.number(), "b"]),
  z.templateLiteral([z.number(), "%"]),
  z.templateLiteral(["bar ", z.number()]),
  /** Marker, optionally offset: "@drop", "@scene:hud+2b", "@logo-0.5s". */
  z.templateLiteral(["@", z.string()]),
]);
export type TimeRef = z.infer<typeof TimeRefSchema>;

export const LengthSchema = z.union([
  z.number().nonnegative(),
  z.templateLiteral([z.number(), "s"]),
  z.templateLiteral([z.number(), "f"]),
  z.templateLiteral([z.number(), "b"]),
  z.templateLiteral([z.number(), " bars"]),
  z.templateLiteral([z.number(), " bar"]),
]);
export type Length = z.infer<typeof LengthSchema>;

export interface TimeContext {
  fps: number;
  grid: BeatGrid;
  /** Absolute start of the scene, seconds. */
  sceneStart: number;
  /** Scene length, seconds. */
  sceneLength: number;
  /** Named markers, absolute seconds (scene:<id>, scene:<id>:end, film and scene markers). */
  markers?: Readonly<Record<string, number>>;
}

const MARKER = /^@([A-Za-z0-9_:.-]+?)(?:([+-])(\d+(?:\.\d+)?)(s|f|b))?$/;

const NUM = String.raw`(-?\d+(?:\.\d+)?)`;
const SUFFIX = new RegExp(`^${NUM}(s|f|b|%)$`);
const BAR_AT = new RegExp(`^bar ${NUM}$`);
const BARS = new RegExp(`^${NUM} bars?$`);

/** Converts a Length to seconds. */
export function lengthToSeconds(length: Length, fps: number, grid: BeatGrid): number {
  if (typeof length === "number") return length;
  const bars = BARS.exec(length);
  if (bars) return beatsToSeconds(grid, Number(bars[1]) * grid.beatsPerBar);
  const m = SUFFIX.exec(length);
  if (m) {
    const n = Number(m[1]);
    if (m[2] === "s") return n;
    if (m[2] === "f") return n / fps;
    if (m[2] === "b") return beatsToSeconds(grid, n);
  }
  throw new Error(`Invalid length "${length}". Use seconds (2, "2s"), frames ("90f"), beats ("4b") or bars ("2 bars").`);
}

/** Resolves a TimeRef to seconds relative to the scene start. */
export function resolveTimeRef(ref: TimeRef, ctx: TimeContext): number {
  if (typeof ref === "number") return ref;
  if (ref.startsWith("@")) {
    const m = MARKER.exec(ref);
    if (!m) throw new Error(`Invalid marker reference "${ref}". Use "@name", "@name+2b" or "@name-0.5s".`);
    const at = ctx.markers?.[m[1]];
    if (at === undefined) {
      const known = Object.keys(ctx.markers ?? {}).join(", ") || "none";
      throw new Error(`Unknown marker "@${m[1]}". Known markers: ${known}.`);
    }
    let offset = 0;
    if (m[2]) {
      const n = Number(m[3]) * (m[2] === "-" ? -1 : 1);
      offset = m[4] === "s" ? n : m[4] === "f" ? n / ctx.fps : beatsToSeconds(ctx.grid, n);
    }
    return at + offset - ctx.sceneStart;
  }
  const bar = BAR_AT.exec(ref);
  if (bar) {
    const absolute = ctx.grid.offset + beatsToSeconds(ctx.grid, (Number(bar[1]) - 1) * ctx.grid.beatsPerBar);
    return absolute - ctx.sceneStart;
  }
  const m = SUFFIX.exec(ref);
  if (m) {
    const n = Number(m[1]);
    if (m[2] === "s") return n;
    if (m[2] === "f") return n / ctx.fps;
    if (m[2] === "b") return beatsToSeconds(ctx.grid, n);
    if (m[2] === "%") return (n / 100) * ctx.sceneLength;
  }
  throw new Error(`Invalid time reference "${ref}". Use seconds, "90f", "2b", "40%" or "bar 5".`);
}
