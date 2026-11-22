import type { AspectId } from "../../stage3d/schema";

export type EditorialInsets = { top: number; right: number; bottom: number; left: number };
export type EditorialMotion = "measured" | "expressive";
export type EditorialSafeAreas = Partial<Record<AspectId, EditorialInsets>>;
export type EditorialBinding = { safeAreas: EditorialSafeAreas; motion: EditorialMotion; logoFile: string };
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

export function editorialLayout(aspect: AspectId, frame: { width: number; height: number }, scene: string, overrides?: EditorialSafeAreas) {
  const inset = overrides?.[aspect] ?? safeDefaults[aspect];
  const { width, height } = frame;
  const safe = {
    left: width * inset.left, top: height * inset.top,
    width: width * (1 - inset.left - inset.right), height: height * (1 - inset.top - inset.bottom),
  };
  const place = ([x, y, w, h]: Box) => ({
    left: safe.left + safe.width * x, top: safe.top + safe.height * y, width: safe.width * w, height: safe.height * h,
  });
  if (scene === "cta") {
    return {
      safe, align: "center" as const, media: undefined,
      logo: place([0.33, 0.10, 0.34, 0.28]), eyebrow: place([0.03, 0.435, 0.94, 0.085]),
      headline: place([0.03, 0.54, 0.94, 0.21]), body: place([0.06, 0.77, 0.88, 0.14]),
    };
  }
  const arrangement = scene === "hook" || scene === "proposition" ? scene :
    Number(scene.split("-")[1]) % 2 ? "detail" : "action";
  const spread = spreads[aspect][arrangement];
  const [x, y, w, h] = spread.copy;
  return {
    safe, align: spread.align ?? "start" as const, logo: undefined, media: place(spread.media),
    eyebrow: place([x, y, w, h * 0.17]),
    headline: place([x, y + h * 0.18, w, h * 0.56]),
    body: place([x, y + h * 0.76, w, h * 0.24]),
  };
}
