/**
 * CPOS creative shot grammar for Studio Cut v2 / expressive only.
 * Frame-addressable (no global state), source-accurate (never simulates UI state), and
 * bounded to the existing editorial media rectangle. Rendering remains seek-order independent.
 */
export type StudioRecipe = "tension-reveal" | "solution-reveal" | "guided-proof";

export const studioRecipeFor = (shotId: string): StudioRecipe =>
  shotId === "hook" ? "tension-reveal" :
    shotId === "proposition" ? "solution-reveal" : "guided-proof";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const fixed = (n: number) => (Math.abs(n) < 0.00005 ? 0 : n).toFixed(3);

export type StudioScreenMotion = Readonly<{
  recipe: StudioRecipe;
  transform: string;
}>;

/**
 * Screen and UI annotations share this transform. The main viewport stays layout-safe;
 * the entrance is a short, bounded edit (never continual zoom that can hide content).
 * All units are derived from the short side, so 9:16 / 16:9 / 1:1 feel comparable.
 */
export function studioScreenMotion(
  shotId: string, localFrame: number, shotFrames: number, shortSide: number, fps: number,
): StudioScreenMotion {
  const recipe = studioRecipeFor(shotId);
  const seconds = Math.max(0, localFrame) / Math.max(1, fps);
  const shotSeconds = Math.max(1, shotFrames) / Math.max(1, fps);
  const enter = smooth(seconds / (recipe === "tension-reveal" ? 0.54 : recipe === "solution-reveal" ? 0.48 : 0.4));
  const outro = smooth(Math.max(0, seconds - Math.max(0, shotSeconds - 0.4)) / 0.4);
  const settle = 1 - enter;
  const magnitude = Math.max(0, shortSide);
  // Stop motion before the cut, and keep screen detail legible after the reveal.
  const drift = Math.sin(clamp01(seconds / Math.max(0.5, shotSeconds)) * Math.PI) * (1 - outro);
  const odd = /feature-(?:2|4)$/.test(shotId);
  let x = 0, y = 0, rotation = 0, scale = 1;
  if (recipe === "tension-reveal") {
    y = magnitude * (0.035 * settle - 0.009 * drift);
    rotation = -0.7 * settle;
    scale = 0.94 + 0.06 * enter + 0.012 * drift;
  } else if (recipe === "solution-reveal") {
    x = magnitude * (-0.075 * settle + 0.007 * drift);
    rotation = 1.55 * settle;
    scale = 1.055 - 0.055 * enter + 0.008 * drift;
  } else {
    const side = odd ? -1 : 1;
    x = side * magnitude * (0.052 * settle + 0.004 * drift);
    y = -magnitude * 0.012 * settle;
    rotation = side * 0.95 * settle;
    scale = 0.965 + 0.035 * enter + 0.008 * drift;
  }
  return {
    recipe,
    transform: `translate3d(${fixed(x)}px, ${fixed(y)}px, 0) rotate(${fixed(rotation)}deg) scale(${fixed(scale)})`,
  };
}

/** Project a user-authored tap on the decoded source into the *screen-local* viewport.
 * Return undefined if it falls outside the visible crop or after a focus/zoom.
 */
export function studioTapPosition(geometry: {
  left: number; top: number; width: number; height: number;
  viewport: { width: number; height: number };
}, tap: { x: number; y: number }): { left: number; top: number } | undefined {
  const left = geometry.left + tap.x * geometry.width;
  const top = geometry.top + tap.y * geometry.height;
  const margin = 10;
  if (![left, top, geometry.width, geometry.height].every(Number.isFinite) ||
    left < margin || top < margin || left > geometry.viewport.width - margin || top > geometry.viewport.height - margin) {
    return undefined;
  }
  return { left, top };
}

/** Localized, frame-exact visual feedback. A tap is never invented: caller supplies its target. */
export function studioTapPulse(phase: number, at: number): { opacity: number; scale: number } {
  const age = (phase - at) / 0.11;
  if (age < 0 || age >= 1) return { opacity: 0, scale: 0.5 };
  return { opacity: 0.92 * (1 - smooth(age)), scale: 0.48 + 1.45 * smooth(age) };
}
