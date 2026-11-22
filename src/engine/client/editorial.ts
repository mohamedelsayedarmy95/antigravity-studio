import type { AspectId } from "../../stage3d/schema";
import type { ShotDirection } from "./focus";

export type EditorialInsets = { top: number; right: number; bottom: number; left: number };
export type EditorialMotion = "measured" | "expressive";
export type EditorialSafeAreas = Partial<Record<AspectId, EditorialInsets>>;
export type StudioTemplate = "studio-cut-v1" | "studio-cut-v2";
export type EditorialBinding = { safeAreas: EditorialSafeAreas; motion: EditorialMotion; logoFile: string;
  template?: StudioTemplate; direction?: Record<string, ShotDirection | undefined> };
type Box = readonly [left: number, top: number, width: number, height: number];
type Spread = { copy: Box; media: Box; align?: "center" };

const safeDefaults: Record<AspectId, EditorialInsets> = {
  "16x9": { left: 0.065, right: 0.065, top: 0.09, bottom: 0.09 },
  "9x16": { left: 0.075, right: 0.095, top: 0.10, bottom: 0.18 },
  "1x1": { left: 0.082, right: 0.082, top: 0.08, bottom: 0.08 },
};

const spreads: Record<AspectId, Record<"hook" | "proposition" | "detail" | "action", Spread>> = {
  "16x9": {
    hook: { copy: [0, 0.24, 0.355, 0.57], media: [0.40, 0.10, 0.60, 0.80] },
    proposition: { copy: [0.61, 0.23, 0.39, 0.58], media: [0, 0.12, 0.56, 0.76] },
    detail: { copy: [0, 0.21, 0.33, 0.62], media: [0.38, 0.06, 0.62, 0.88] },
    action: { copy: [0.63, 0.22, 0.37, 0.60], media: [0, 0.04, 0.59, 0.92] },
  },
  "9x16": {
    hook: { copy: [0, 0.035, 0.985, 0.37], media: [0, 0.425, 1, 0.53] },
    proposition: { copy: [0, 0.60, 1, 0.38], media: [0, 0.02, 1, 0.54] },
    detail: { copy: [0, 0.015, 0.96, 0.38], media: [0, 0.40, 1, 0.58] },
    action: { copy: [0, 0.64, 1, 0.35], media: [0, 0.02, 1, 0.59] },
  },
  "1x1": {
    hook: { copy: [0, 0.015, 1, 0.37], media: [0, 0.42, 1, 0.56], align: "center" },
    proposition: { copy: [0, 0.61, 1, 0.39], media: [0.12, 0, 0.88, 0.58] },
    detail: { copy: [0, 0.03, 0.93, 0.38], media: [0.06, 0.42, 0.94, 0.56] },
    action: { copy: [0, 0.61, 1, 0.39], media: [0, 0, 0.96, 0.59] },
  },
};

const directedPortrait: typeof spreads["9x16"] = {
  hook: { copy: [0, 0.025, 1, 0.27], media: [0, 0.31, 1, 0.63] },
  proposition: { copy: [0, 0.67, 1, 0.32], media: [0, 0.02, 1, 0.62] },
  detail: { copy: [0, 0.03, 1, 0.26], media: [0, 0.30, 1, 0.65] },
  action: { copy: [0, 0.70, 1, 0.30], media: [0, 0.025, 1, 0.645] },
};

/** Expressive v2: shot-specific art direction for each output ratio.
 * Coordinates are relative to the platform-safe rectangle, not the full frame.
 * The measured and v1 arrangements above remain completely untouched.
 */
const expressiveSpreads: Record<AspectId, Record<Exclude<ExpressiveBeat, "cta">, Spread>> = {
  "16x9": {
    hook:          { copy: [0.01, 0.20, 0.37, 0.62], media: [0.43, 0.07, 0.57, 0.84] },
    proposition:   { copy: [0.62, 0.22, 0.38, 0.61], media: [0.02, 0.12, 0.54, 0.77] },
    "feature-1":  { copy: [0.01, 0.17, 0.35, 0.66], media: [0.43, 0.08, 0.57, 0.84] },
    "feature-2":  { copy: [0.62, 0.18, 0.38, 0.67], media: [0.01, 0.06, 0.55, 0.87] },
    "feature-3":  { copy: [0.05, 0.22, 0.38, 0.60], media: [0.49, 0.08, 0.49, 0.84] },
    "feature-4":  { copy: [0.64, 0.22, 0.36, 0.64], media: [0.04, 0.10, 0.54, 0.82] },
  },
  "9x16": {
    hook:          { copy: [0.04, 0.06, 0.92, 0.26], media: [0.02, 0.36, 0.96, 0.59] },
    proposition:   { copy: [0.04, 0.69, 0.92, 0.30], media: [0.03, 0.03, 0.94, 0.62] },
    "feature-1":  { copy: [0.05, 0.06, 0.88, 0.26], media: [0.02, 0.37, 0.98, 0.59] },
    "feature-2":  { copy: [0.07, 0.72, 0.89, 0.27], media: [0.03, 0.04, 0.94, 0.64] },
    "feature-3":  { copy: [0.03, 0.10, 0.94, 0.23], media: [0.08, 0.38, 0.85, 0.58], align: "center" },
    "feature-4":  { copy: [0.06, 0.70, 0.90, 0.29], media: [0.07, 0.05, 0.88, 0.61] },
  },
  "1x1": {
    hook:          { copy: [0.04, 0.03, 0.92, 0.36], media: [0.08, 0.43, 0.85, 0.54], align: "center" },
    proposition:   { copy: [0.07, 0.65, 0.88, 0.34], media: [0.09, 0.04, 0.83, 0.57] },
    "feature-1":  { copy: [0.03, 0.05, 0.86, 0.34], media: [0.15, 0.42, 0.82, 0.55] },
    "feature-2":  { copy: [0.09, 0.68, 0.87, 0.31], media: [0.03, 0.03, 0.88, 0.61] },
    "feature-3":  { copy: [0.06, 0.05, 0.88, 0.35], media: [0.02, 0.45, 0.90, 0.52], align: "center" },
    "feature-4":  { copy: [0.08, 0.69, 0.85, 0.30], media: [0.10, 0.05, 0.86, 0.60] },
  },
};

type ExpressiveBeat = "hook" | "proposition" | "feature-1" | "feature-2" | "feature-3" | "feature-4" | "cta";
const expressiveCta: Record<AspectId, { logo: Box; eyebrow: Box; headline: Box; body: Box; action: Box }> = {
  "16x9": { logo: [0.39, 0.06, 0.22, 0.25], eyebrow: [0.10, 0.34, 0.80, 0.07],
    headline: [0.12, 0.44, 0.76, 0.18], body: [0.21, 0.64, 0.58, 0.10], action: [0.31, 0.79, 0.38, 0.15] },
  "9x16": { logo: [0.29, 0.05, 0.42, 0.26], eyebrow: [0.08, 0.35, 0.84, 0.08],
    headline: [0.05, 0.48, 0.90, 0.17], body: [0.08, 0.69, 0.84, 0.08], action: [0.10, 0.81, 0.80, 0.14] },
  "1x1": { logo: [0.35, 0.06, 0.30, 0.23], eyebrow: [0.08, 0.34, 0.84, 0.07],
    headline: [0.07, 0.44, 0.86, 0.17], body: [0.10, 0.65, 0.80, 0.10], action: [0.22, 0.80, 0.56, 0.15] },
};

export function editorialLayout(aspect: AspectId, frame: { width: number; height: number }, scene: string,
  overrides?: EditorialSafeAreas, template: StudioTemplate = "studio-cut-v1", motion: EditorialMotion = "measured") {
  const inset = overrides?.[aspect] ?? safeDefaults[aspect];
  const { width, height } = frame;
  const safe = {
    left: width * inset.left, top: height * inset.top,
    width: width * (1 - inset.left - inset.right), height: height * (1 - inset.top - inset.bottom),
  };
  const place = ([x, y, w, h]: Box) => ({
    left: safe.left + safe.width * x, top: safe.top + safe.height * y, width: safe.width * w, height: safe.height * h,
  });
  const expressive = template === "studio-cut-v2" && motion === "expressive";
  if (scene === "cta" && expressive) {
    const cta = expressiveCta[aspect];
    return { safe, align: "center" as const, media: undefined,
      logo: place(cta.logo), eyebrow: place(cta.eyebrow), headline: place(cta.headline),
      body: place(cta.body), action: place(cta.action) };
  }
  if (scene === "cta") {
    const directed = template === "studio-cut-v2";
    return {
      safe, align: "center" as const, media: undefined,
      logo: place(directed ? [0.33, 0.075, 0.34, 0.27] : [0.33, 0.10, 0.34, 0.28]),
      eyebrow: place(directed ? [0.03, 0.375, 0.94, 0.085] : [0.03, 0.435, 0.94, 0.085]),
      headline: place(directed ? [0.03, 0.475, 0.94, 0.18] : [0.03, 0.54, 0.94, 0.21]),
      body: place(directed ? [0.06, 0.66, 0.88, 0.105] : [0.06, 0.77, 0.88, 0.14]),
      action: directed ? place([0.03, 0.79, 0.94, 0.14]) : undefined,
    };
  }
  const arrangement = scene === "hook" || scene === "proposition" ? scene :
    Number(scene.split("-")[1]) % 2 ? "detail" : "action";
  const expressiveSpread = expressive ? expressiveSpreads[aspect][scene as Exclude<ExpressiveBeat, "cta">] : undefined;
  const spread = expressiveSpread ?? (template === "studio-cut-v2" && aspect === "9x16" ? directedPortrait : spreads[aspect])[arrangement];
  const [x, y, w, h] = spread.copy;
  return {
    safe, align: spread.align ?? "start" as const, logo: undefined, media: place(spread.media), action: undefined,
    eyebrow: place([x, y, w, h * 0.17]),
    headline: place([x, y + h * 0.18, w, h * 0.56]),
    body: place([x, y + h * 0.76, w, h * 0.24]),
  };
}
