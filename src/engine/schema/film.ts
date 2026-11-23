import { z } from "zod";
import { LengthSchema, TimeRefSchema } from "../time/timeRef";
import { OverlayElementSchema } from "../../layer2d/schema";
import { LookIdSchema } from "../../looks";
import {
  ASPECTS,
  BackdropSchema,
  CameraSchema,
  LightingSchema,
  NodeSchema,
  PaletteRoleSchema,
  PostSchema,
  TransitionSchema,
  type AspectId,
} from "../../stage3d/schema";

/**
 * FilmSpec: the engine's input contract. One validated object drives the whole film; the
 * compiler (src/engine/compile) turns it into a frame-exact plan for the 3D stage and 2D layer.
 * Composed from the slices each module owns (3D: stage3d/schema, 2D: layer2d/schema).
 */

export const AspectIdSchema = z.enum(Object.keys(ASPECTS) as [AspectId, ...AspectId[]]);

const HexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const FilmSceneSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "scene ids are lowercase-kebab (they become markers)"),
  length: LengthSchema,
  /** From the previous scene (scene 0: from black). Default for later scenes: the look's transition. */
  transitionIn: TransitionSchema.optional(),
  world: z
    .object({
      backdrop: BackdropSchema.optional(),
      /** Default: the look's lighting rig. */
      lighting: LightingSchema.optional(),
      nodes: z.array(NodeSchema).default([]),
    })
    .default({ nodes: [] }),
  camera: CameraSchema.optional(),
  post: PostSchema.optional(),
  overlay: z.array(OverlayElementSchema).default([]),
  /** Scene-relative markers, published film-wide as "<scene>.<name>". */
  markers: z.record(z.string(), TimeRefSchema).default({}),
});

export const FilmSpecSchema = z.object({
  schemaVersion: z.literal("1"),
  id: z.string().regex(/^[a-z0-9-]+$/, "film ids are lowercase-kebab (they become composition ids)"),
  seed: z.number().int(),
  look: LookIdSchema,
  /** Overrides individual palette roles of the look. */
  palette: z.partialRecord(PaletteRoleSchema, HexSchema).default({}),
  output: z
    .object({ fps: z.number().int().positive().default(60), aspects: z.array(AspectIdSchema).min(1).default(["16x9", "9x16", "1x1"]) })
    .default({ fps: 60, aspects: ["16x9", "9x16", "1x1"] }),
  audio: z.object({
    /** Musical grid. M4 replaces the manual grid with analysis of the music track. */
    grid: z.object({ bpm: z.number().positive(), offset: z.number().default(0), beatsPerBar: z.number().int().positive().default(4) }),
    /** Scene cuts snap to the nearest bar or beat. */
    quantize: z.enum(["bar", "beat", "none"]).default("beat"),
  }),
  /** Named numeric series for charts and telemetry. */
  data: z.record(z.string(), z.array(z.number()).min(1)).default({}),
  /** Film-level markers (absolute TimeRefs). */
  markers: z.record(z.string(), TimeRefSchema).default({}),
  post: PostSchema.optional(),
  timeline: z.array(FilmSceneSchema).min(1),
});

export type FilmSpec = z.infer<typeof FilmSpecSchema>;
export type FilmSpecInput = z.input<typeof FilmSpecSchema>;
export type FilmScene = z.infer<typeof FilmSceneSchema>;
