import { z } from "zod";
import { Easing } from "remotion";
import { appSpring, SPRING_PRESETS, type SpringPresetName } from "../../motion/springPresets";

const springNames = Object.keys(SPRING_PRESETS) as [SpringPresetName, ...SpringPresetName[]];

export const EaseSchema = z.union([
  z.enum(springNames),
  z.enum(["linear", "hold", "smooth", "expoOut", "expoInOut"]),
  z.tuple([z.number(), z.number(), z.number(), z.number()]), // cubic-bezier
]);
export type Ease = z.infer<typeof EaseSchema>;

const isSpring = (ease: Ease): ease is SpringPresetName =>
  typeof ease === "string" && ease in SPRING_PRESETS;

const smooth = Easing.inOut(Easing.cubic);
const expoOut = Easing.out(Easing.exp);
const expoInOut = Easing.inOut(Easing.exp);

/**
 * Eased progress for a segment that started `elapsed` seconds ago and lasts `duration` seconds.
 * Springs are fitted to the segment duration (they may overshoot past 1, by design).
 * Works with fractional time, which motion-blur sub-sampling relies on.
 */
export function applyEase(ease: Ease, elapsed: number, duration: number, fps: number): number {
  if (elapsed <= 0) return 0;
  if (duration <= 0) return 1;
  if (ease === "hold") return elapsed >= duration ? 1 : 0;
  if (isSpring(ease)) {
    return appSpring({ frame: elapsed * fps, fps, preset: ease, durationInFrames: duration * fps });
  }
  const p = Math.min(1, elapsed / duration);
  if (ease === "linear") return p;
  if (ease === "smooth") return smooth(p);
  if (ease === "expoOut") return expoOut(p);
  if (ease === "expoInOut") return expoInOut(p);
  const [x1, y1, x2, y2] = ease;
  return Easing.bezier(x1, y1, x2, y2)(p);
}
