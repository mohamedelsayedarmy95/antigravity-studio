import { z } from "zod";
import { EaseSchema } from "../engine/time/ease";
import { LengthSchema, TimeRefSchema } from "../engine/time/timeRef";
import { ColorRefSchema } from "../stage3d/schema";

/**
 * Schema slice owned by the 2D layer: kinetic typography, counters, charts and HUD elements that
 * sit above the 3D stage. Positions and sizes are fractions of the aspect's safe area, never pixels,
 * so one element definition lays out correctly in 16:9, 9:16 and 1:1.
 */

export const AnchorSchema = z.enum(["center", "top", "bottom", "left", "right", "topLeft", "topRight", "bottomLeft", "bottomRight"]);
export type Anchor = z.infer<typeof AnchorSchema>;

export const TypeRoleSchema = z.enum(["display", "headline", "title", "body", "label", "numeric"]);
export type TypeRole = z.infer<typeof TypeRoleSchema>;

export const RevealSchema = z.enum(["maskedRise", "perGlyph", "scramble", "typewriter", "blurIn", "fade", "hold"]);
export type Reveal = z.infer<typeof RevealSchema>;

const Common = {
  id: z.string().optional(),
  anchor: AnchorSchema.default("center"),
  /** Offset from the anchor, as a fraction of the safe area ([x, y], y down). */
  offset: z.tuple([z.number(), z.number()]).default([0, 0]),
  /** Box width as a fraction of the safe area width. */
  width: z.number().min(0.05).max(1).default(0.8),
  align: z.enum(["start", "center", "end"]).optional(),
  /** When the element starts appearing (scene-relative TimeRef; default: scene start). */
  at: TimeRefSchema.optional(),
  /** When the exit starts (default: so the exit finishes just before the scene's cut). */
  out: TimeRefSchema.optional(),
  exit: z.enum(["fade", "rise", "sink", "none"]).default("fade"),
  color: ColorRefSchema.optional(),
};

export const TextElementSchema = z.object({
  ...Common,
  kind: z.literal("text"),
  content: z.string().min(1),
  role: TypeRoleSchema.default("headline"),
  /** Defaults to the look's reveal. */
  reveal: RevealSchema.optional(),
  /** Phrases drawn in the accent color. */
  emphasis: z.array(z.string()).default([]),
});

export const CounterElementSchema = z.object({
  ...Common,
  kind: z.literal("counter"),
  from: z.number().default(0),
  to: z.number(),
  length: LengthSchema.default("2b"),
  ease: EaseSchema.default("expoOut"),
  decimals: z.number().int().min(0).max(6).default(0),
  prefix: z.string().default(""),
  suffix: z.string().default(""),
  role: TypeRoleSchema.default("numeric"),
  label: z.string().optional(),
});

export const ChartElementSchema = z.object({
  ...Common,
  kind: z.literal("chart"),
  chart: z.enum(["line", "area", "bar", "ring", "sparkline"]),
  /** Key into the film's `data`. */
  data: z.string(),
  length: LengthSchema.default("2b"),
  /** Height as a fraction of the safe area height (ring: diameter as a fraction of the box width). */
  height: z.number().min(0.05).max(1).default(0.28),
  label: z.string().optional(),
  showValue: z.boolean().default(true),
  /** Ring charts: value at which the ring is full. */
  max: z.number().positive().default(100),
  suffix: z.string().default(""),
});

export const HudElementSchema = z.object({
  ...Common,
  kind: z.literal("hud"),
  preset: z.enum(["brackets", "reticle", "telemetry"]),
  /** Brackets: frame height as a fraction of the safe area height. */
  height: z.number().min(0.05).max(1).default(0.4),
  label: z.string().optional(),
  /** Telemetry rows. Numeric values roll in like counters. */
  rows: z.array(z.object({ label: z.string(), value: z.union([z.number(), z.string()]), suffix: z.string().default("") })).default([]),
});

export const OverlayElementSchema = z.discriminatedUnion("kind", [TextElementSchema, CounterElementSchema, ChartElementSchema, HudElementSchema]);
export type OverlayElement = z.infer<typeof OverlayElementSchema>;
export type TextElement = z.infer<typeof TextElementSchema>;
export type CounterElement = z.infer<typeof CounterElementSchema>;
export type ChartElement = z.infer<typeof ChartElementSchema>;
export type HudElement = z.infer<typeof HudElementSchema>;
