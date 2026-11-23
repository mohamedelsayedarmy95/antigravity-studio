import { z } from "zod";
import type { SpringPresetName } from "../motion/springPresets";
import type { Reveal, TypeRole } from "../layer2d/schema";
import type { LightingSpec, Palette, PostOverride, TransitionSpec } from "../stage3d/schema";

/**
 * Looks carry the taste: palette, type system, motion feel, default lighting, post and transitions.
 * A FilmSpec names a look and overrides only what it must. M2 ships the type and motion parts;
 * M6 deepens lighting, materials and grading.
 */

export interface TypeStyle {
  /** Key into FONT_FAMILIES. */
  family: "display" | "sans" | "mono";
  weight: number;
  /** Size as a fraction of the frame's short side, so type scales with the frame. */
  size: number;
  tracking: number; // em
  lineHeight: number;
  uppercase?: boolean;
}

export interface Look {
  id: string;
  palette: Palette;
  type: Record<TypeRole, TypeStyle>;
  reveal: Reveal;
  spring: SpringPresetName;
  lighting: LightingSpec["rig"];
  transition: TransitionSpec["type"];
  post: PostOverride;
}

const TYPE_BASE: Record<TypeRole, TypeStyle> = {
  display: { family: "display", weight: 800, size: 0.1, tracking: -0.03, lineHeight: 1.02 },
  headline: { family: "sans", weight: 700, size: 0.066, tracking: -0.025, lineHeight: 1.08 },
  title: { family: "sans", weight: 600, size: 0.046, tracking: -0.015, lineHeight: 1.15 },
  body: { family: "sans", weight: 400, size: 0.028, tracking: -0.005, lineHeight: 1.4 },
  label: { family: "mono", weight: 500, size: 0.018, tracking: 0.14, lineHeight: 1.3, uppercase: true },
  numeric: { family: "display", weight: 800, size: 0.12, tracking: -0.02, lineHeight: 1 },
};

export const LOOKS = {
  cyber: {
    id: "cyber",
    palette: { base: "#04060a", surface: "#0c1624", ink: "#e8edf2", primary: "#22d3ee", accent: "#a3ff12", glow: "#eaf4ff" },
    type: TYPE_BASE,
    reveal: "scramble",
    spring: "teslaTelemetry",
    lighting: "neonGels",
    transition: "glitchSlice",
    post: { toneMapping: "aces", bloom: { intensity: 1.1, threshold: 0.9 }, vignette: { darkness: 0.6, offset: 0.28 }, grain: 0.035 },
  },
  keynote: {
    id: "keynote",
    palette: { base: "#030303", surface: "#141416", ink: "#f5f5f7", primary: "#2997ff", accent: "#bf5af2", glow: "#ffffff" },
    type: {
      ...TYPE_BASE,
      display: { family: "sans", weight: 700, size: 0.1, tracking: -0.04, lineHeight: 1.02 },
      numeric: { family: "sans", weight: 700, size: 0.12, tracking: -0.04, lineHeight: 1 },
    },
    reveal: "maskedRise",
    spring: "appleHero",
    lighting: "studioSoftbox",
    transition: "dissolve",
    post: { toneMapping: "agx", bloom: { intensity: 0.6, threshold: 0.95 }, vignette: { darkness: 0.45, offset: 0.3 }, grain: 0.02 },
  },
  studio: {
    id: "studio",
    palette: { base: "#dadde7", surface: "#f9f7f1", ink: "#172039", primary: "#244bca", accent: "#244bca", glow: "#f4f4ff" },
    type: {
      ...TYPE_BASE,
      display: { family: "display", weight: 700, size: 0.079, tracking: -0.035, lineHeight: 0.99 },
      headline: { family: "display", weight: 700, size: 0.066, tracking: -0.03, lineHeight: 1.03 },
      body: { family: "sans", weight: 500, size: 0.029, tracking: -0.008, lineHeight: 1.28 },
      label: { family: "mono", weight: 500, size: 0.018, tracking: 0.11, lineHeight: 1.25, uppercase: true },
    },
    reveal: "maskedRise",
    spring: "appleHero",
    lighting: "studioSoftbox",
    // eslint-disable-next-line @remotion/non-pure-animation -- A FilmSpec cut, evaluated by the frame-based stage.
    transition: "cut",
    post: { toneMapping: "agx", exposure: 1.08, bloom: false, dof: false, vignette: false, grain: 0 },
  },
} satisfies Record<string, Look>;

export type LookId = keyof typeof LOOKS;
export const LookIdSchema = z.enum(Object.keys(LOOKS) as [LookId, ...LookId[]]);
