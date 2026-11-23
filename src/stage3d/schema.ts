import { z } from "zod";
import { AnimNumberSchema, AnimVec3Schema, Vec3Schema } from "../engine/time/animatable";
import { EaseSchema } from "../engine/time/ease";
import { LengthSchema, TimeRefSchema } from "../engine/time/timeRef";

/**
 * Schema slice owned by the 3D engine (see docs/ARCHITECTURE.md §2.6). The M2 planner composes
 * this slice into the full FilmSpec; until then a Film3DSpec is the 3D engine's own entry point.
 */

// ── Color ────────────────────────────────────────────────────────────────────────────────────
export const PaletteRoleSchema = z.enum(["base", "surface", "ink", "primary", "accent", "glow"]);
export type PaletteRole = z.infer<typeof PaletteRoleSchema>;
export const PaletteSchema = z.record(PaletteRoleSchema, z.string().regex(/^#[0-9a-fA-F]{6}$/));
export type Palette = z.infer<typeof PaletteSchema>;

/** "#22d3ee" or a palette role like "palette.primary" (keeps looks swappable). */
export const ColorRefSchema = z.union([
  z.string().regex(/^#[0-9a-fA-F]{6}$/),
  z.templateLiteral(["palette.", PaletteRoleSchema]),
]);
export type ColorRef = z.infer<typeof ColorRefSchema>;

// ── Shapes & materials ───────────────────────────────────────────────────────────────────────
/** Shapes with a shared (u,v) parameterization; any of them can morph into any other. */
export const MorphShapeSchema = z.enum(["sphere", "icosahedron", "roundedBox", "torus", "torusKnot"]);
export type MorphShape = z.infer<typeof MorphShapeSchema>;
export const PrimitiveShapeSchema = z.union([MorphShapeSchema, z.enum(["capsule", "cylinder", "plane", "sweptSheet"])]);
export type PrimitiveShape = z.infer<typeof PrimitiveShapeSchema>;

export const MaterialPresetSchema = z.enum([
  "chrome",
  "liquidChrome",
  "brushedMetal",
  "glass",
  "iridescentGlass",
  "ceramic",
  "obsidian",
  "neonEmissive",
  "wireGlow",
]);
export type MaterialPreset = z.infer<typeof MaterialPresetSchema>;

export const MaterialSchema = z.union([
  MaterialPresetSchema,
  z.object({
    preset: MaterialPresetSchema,
    color: ColorRefSchema.optional(),
    emissive: ColorRefSchema.optional(),
    roughness: AnimNumberSchema.optional(),
    metalness: AnimNumberSchema.optional(),
    emissiveIntensity: AnimNumberSchema.optional(),
    iridescence: AnimNumberSchema.optional(),
  }),
]);
export type MaterialSpec = z.infer<typeof MaterialSchema>;

// ── Nodes ────────────────────────────────────────────────────────────────────────────────────
const EnterSchema = z.object({
  style: z.enum(["scale", "rise", "none"]),
  at: TimeRefSchema.default(0),
  length: LengthSchema.default(0.8),
  ease: EaseSchema.default("appleHero"),
});
const ExitSchema = z.object({
  style: z.enum(["scale", "sink"]),
  at: TimeRefSchema,
  length: LengthSchema.default(0.5),
  ease: EaseSchema.default("smooth"),
});

const NodeCommon = {
  id: z.string().min(1),
  position: AnimVec3Schema.default([0, 0, 0]),
  /** Degrees, XYZ order. */
  rotation: AnimVec3Schema.default([0, 0, 0]),
  /** Uniform scale. */
  scale: AnimNumberSchema.default(1),
  enter: EnterSchema.optional(),
  exit: ExitSchema.optional(),
};

export const PrimitiveNodeSchema = z.object({
  ...NodeCommon,
  type: z.literal("primitive"),
  shape: PrimitiveShapeSchema,
  /** Optional per-axis geometry dimensions relative to the primitive's nominal size. */
  dimensions: Vec3Schema.refine((values) => values.every((value) => value > 0 && value <= 5), "Dimensions must be in (0, 5]").optional(),
  material: MaterialSchema,
});

export const MorphNodeSchema = z.object({
  ...NodeCommon,
  type: z.literal("morph"),
  /** Shapes in order. keys[i] is when the morph *into* shapes[i] starts (keys[0] is usually 0). */
  shapes: z.array(MorphShapeSchema).min(1),
  keys: z.array(TimeRefSchema).min(1),
  morphLength: LengthSchema.default(0.9),
  ease: EaseSchema.default("appleHero"),
  material: MaterialSchema,
  /** Grid resolution (u around, v pole-to-pole). */
  resolution: z.tuple([z.number().int().min(16), z.number().int().min(8)]).default([384, 192]),
  surfaceNoise: z
    .object({ amount: AnimNumberSchema, frequency: z.number().default(1.6), speed: z.number().default(0.35) })
    .optional(),
});

export const LogoNodeSchema = z.object({
  ...NodeCommon,
  type: z.literal("logo"),
  /** SVG file under public/. */
  src: z.string(),
  /** Extrusion depth, relative to logo width 1. */
  depth: z.number().positive().default(0.12),
  bevel: z.number().nonnegative().default(0.012),
  material: MaterialSchema,
});

const FormTargetSchema = z.union([
  /** Follow a morph or logo node in the same scene (position, rotation, scale and shape). */
  z.object({ node: z.string() }),
  z.object({ shape: MorphShapeSchema, scale: z.number().default(1) }),
]);

export const ParticlesNodeSchema = z.object({
  ...NodeCommon,
  type: z.literal("particles"),
  count: z.number().int().min(1).max(400_000),
  emitter: z.object({
    shape: z.enum(["sphere", "shell", "box", "disc"]),
    radius: z.number().positive(),
    /** Box half-extents; defaults to radius on every axis. */
    extent: Vec3Schema.optional(),
  }),
  /** World-space particle diameter. */
  size: z.number().positive().default(0.02),
  color: ColorRefSchema,
  colorB: ColorRefSchema.optional(),
  /** HDR multiplier; values above ~1.5 bloom. */
  intensity: AnimNumberSchema.default(2),
  opacity: AnimNumberSchema.default(1),
  drift: z
    .object({ amount: AnimNumberSchema, frequency: z.number().default(0.6), speed: z.number().default(0.25) })
    .optional(),
  /** Vortex angular speed (radians per second near the axis). */
  swirl: AnimNumberSchema.default(0),
  form: z
    .object({
      target: FormTargetSchema,
      /** 0 = free cloud, 1 = fully formed. */
      progress: AnimNumberSchema,
      /** Fraction of the progress range used to stagger particles (0 = all at once). */
      stagger: z.number().min(0).max(0.95).default(0.6),
      jitter: z.number().default(0.01),
    })
    .optional(),
  /** Bokeh strength for out-of-focus particles (in-shader depth of field). */
  bokeh: z.number().nonnegative().default(0.06),
});

export const NodeSchema = z.discriminatedUnion("type", [
  PrimitiveNodeSchema,
  MorphNodeSchema,
  LogoNodeSchema,
  ParticlesNodeSchema,
]);
export type NodeSpec = z.infer<typeof NodeSchema>;
export type MorphNodeSpec = z.infer<typeof MorphNodeSchema>;
export type LogoNodeSpec = z.infer<typeof LogoNodeSchema>;
export type ParticlesNodeSpec = z.infer<typeof ParticlesNodeSchema>;
export type PrimitiveNodeSpec = z.infer<typeof PrimitiveNodeSchema>;

// ── World ────────────────────────────────────────────────────────────────────────────────────
export const BackdropSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("void"), color: ColorRefSchema.default("palette.base") }),
  z.object({
    type: z.literal("gradient"),
    inner: ColorRefSchema,
    outer: ColorRefSchema.default("palette.base"),
  }),
  z.object({
    type: z.literal("grid"),
    line: ColorRefSchema.default("palette.primary"),
    base: ColorRefSchema.default("palette.base"),
    cell: z.number().positive().default(0.5),
    height: z.number().default(-1.2),
    glow: AnimNumberSchema.default(1.4),
    /** Grid scroll speed toward the camera, cells per second. */
    scroll: z.number().default(0),
  }),
]);
export type BackdropSpec = z.infer<typeof BackdropSchema>;

export const LightingSchema = z.object({
  rig: z.enum(["stripRim", "studioSoftbox", "neonGels"]),
  intensity: AnimNumberSchema.default(1),
  /** Environment rotation around Y, degrees (animate it for light sweeps across metal). */
  rotation: AnimNumberSchema.default(0),
});
export type LightingSpec = z.infer<typeof LightingSchema>;

// ── Camera ───────────────────────────────────────────────────────────────────────────────────
const MoveWindow = {
  from: TimeRefSchema.optional(),
  to: TimeRefSchema.optional(),
  ease: EaseSchema.default("smooth"),
};
export const CameraMoveSchema = z.discriminatedUnion("rig", [
  z.object({ rig: z.literal("orbit"), degrees: z.number(), ...MoveWindow }),
  z.object({ rig: z.literal("pushIn"), amount: z.number(), ...MoveWindow }),
  z.object({ rig: z.literal("pullBack"), amount: z.number(), ...MoveWindow }),
  z.object({ rig: z.literal("crane"), amount: z.number(), ...MoveWindow }),
  z.object({ rig: z.literal("truck"), amount: z.number(), ...MoveWindow }),
  z.object({ rig: z.literal("handheld"), amount: z.number(), frequency: z.number().default(0.35) }),
  z.object({
    rig: z.literal("impulse"),
    on: z.enum(["beat", "downbeat"]),
    /** Fractional push toward the subject on each hit. */
    scale: z.number().default(0.015),
    /** Roll kick in degrees, alternating direction per hit. */
    roll: z.number().default(0.6),
    decay: LengthSchema.default(0.22),
  }),
]);
export type CameraMove = z.infer<typeof CameraMoveSchema>;

export const CameraSchema = z.object({
  /** Focal length in mm (full-frame equivalent, applied to the frame's short side). */
  lens: AnimNumberSchema.default(50),
  target: AnimVec3Schema.default([0, 0, 0]),
  azimuth: z.number().default(0),
  elevation: z.number().default(8),
  /** Explicit distance, or frame a bounding radius so it fills `fill` of the short side. */
  distance: z.union([z.number().positive(), z.object({ radius: z.number().positive(), fill: z.number().min(0.05).max(1.5) })]),
  moves: z.array(CameraMoveSchema).default([]),
});
export type CameraSpec = z.infer<typeof CameraSchema>;

// ── Post ─────────────────────────────────────────────────────────────────────────────────────
// Post settings are written as *overrides* (every field optional, no zod defaults) and resolved
// in order DEFAULT_POST ← film.post ← scene.post by resolvePost(), so a scene that only sets
// bloom.intensity keeps the film's threshold, radius and everything else.
const BloomSchema = z.object({
  intensity: AnimNumberSchema.optional(),
  threshold: z.number().optional(),
  smoothing: z.number().optional(),
  radius: z.number().optional(),
});
const DofSchema = z.object({
  /** "target" = camera target distance, so focus follows the camera rig. */
  focus: z.union([z.literal("target"), z.number().positive()]).optional(),
  range: z.number().positive().optional(),
  bokeh: AnimNumberSchema.optional(),
});
const ChromaticSchema = z.object({
  /** "motion" scales with camera velocity and beat impulses; "constant" is a fixed lens defect. */
  mode: z.enum(["motion", "constant"]).optional(),
  amount: z.number().optional(),
});
const VignetteSchema = z.object({ darkness: z.number().optional(), offset: z.number().optional() });

export const PostSchema = z.object({
  toneMapping: z.enum(["aces", "agx"]).optional(),
  exposure: AnimNumberSchema.optional(),
  bloom: z.union([BloomSchema, z.literal(false)]).optional(),
  dof: z.union([DofSchema, z.literal(false)]).optional(),
  chromaticAberration: z.union([ChromaticSchema, z.literal(false)]).optional(),
  vignette: z.union([VignetteSchema, z.literal(false)]).optional(),
  /** Film grain amplitude in display units (0.02–0.05 is subtle). Seeded, frame-stable. */
  grain: z.number().min(0).max(0.2).optional(),
});
export type PostOverride = z.infer<typeof PostSchema>;

type AnimNumber = z.infer<typeof AnimNumberSchema>;
export interface ResolvedPost {
  toneMapping: "aces" | "agx";
  exposure: AnimNumber;
  bloom: { intensity: AnimNumber; threshold: number; smoothing: number; radius: number } | false;
  dof: { focus: "target" | number; range: number; bokeh: AnimNumber } | false;
  chromaticAberration: { mode: "motion" | "constant"; amount: number } | false;
  vignette: { darkness: number; offset: number } | false;
  grain: number;
}

const DEFAULT_BLOOM = { intensity: 1, threshold: 0.85, smoothing: 0.2, radius: 0.75 };
const DEFAULT_DOF = { focus: "target" as const, range: 1.2, bokeh: 2 };
const DEFAULT_CA = { mode: "motion" as const, amount: 1 };
const DEFAULT_VIGNETTE = { darkness: 0.55, offset: 0.3 };

export const DEFAULT_POST: ResolvedPost = {
  toneMapping: "aces",
  exposure: 1,
  bloom: DEFAULT_BLOOM,
  dof: false,
  chromaticAberration: false,
  vignette: DEFAULT_VIGNETTE,
  grain: 0.03,
};

const strip = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

function mergeEffect<T extends object>(base: T | false, over: Partial<T> | false | undefined, defaults: T): T | false {
  if (over === undefined) return base;
  if (over === false) return false;
  return { ...defaults, ...(base === false ? {} : base), ...strip(over) };
}

/** DEFAULT_POST ← each override in order. */
export function resolvePost(...overrides: Array<PostOverride | undefined>): ResolvedPost {
  return overrides.reduce<ResolvedPost>((acc, o) => {
    if (!o) return acc;
    return {
      toneMapping: o.toneMapping ?? acc.toneMapping,
      exposure: o.exposure ?? acc.exposure,
      bloom: mergeEffect(acc.bloom, o.bloom, DEFAULT_BLOOM),
      dof: mergeEffect(acc.dof, o.dof, DEFAULT_DOF),
      chromaticAberration: mergeEffect(acc.chromaticAberration, o.chromaticAberration, DEFAULT_CA),
      vignette: mergeEffect(acc.vignette, o.vignette, DEFAULT_VIGNETTE),
      grain: o.grain ?? acc.grain,
    };
  }, DEFAULT_POST);
}

// ── Transitions, scenes, film ────────────────────────────────────────────────────────────────
export const TransitionSchema = z.object({
  type: z.enum(["cut", "dissolve", "noiseDissolve", "lightSweep", "glitchSlice", "zoomThrough"]),
  length: LengthSchema.default("1b"),
  color: ColorRefSchema.default("palette.glow"),
});
export type TransitionSpec = z.infer<typeof TransitionSchema>;

export const SceneSchema = z.object({
  id: z.string().min(1),
  length: LengthSchema,
  /** Transition from the previous scene (scene 0: from black). Centered on the cut. */
  transitionIn: TransitionSchema.optional(),
  world: z.object({
    backdrop: BackdropSchema.default({ type: "void", color: "palette.base" }),
    lighting: LightingSchema,
    nodes: z.array(NodeSchema),
  }),
  camera: CameraSchema,
  /** Per-scene overrides of the film's post settings. */
  post: PostSchema.optional(),
});
export type SceneSpec = z.infer<typeof SceneSchema>;

export const Film3DSchema = z.object({
  id: z.string().min(1),
  seed: z.number().int(),
  fps: z.number().int().positive().default(60),
  grid: z.object({ bpm: z.number().positive(), offset: z.number().default(0), beatsPerBar: z.number().int().default(4) }),
  palette: PaletteSchema,
  /** Look-level post defaults, applied beneath `post` (set by the FilmSpec compiler). */
  lookPost: PostSchema.optional(),
  post: PostSchema.optional(),
  scenes: z.array(SceneSchema).min(1),
});
export type Film3DSpec = z.infer<typeof Film3DSchema>;
export type Film3DInput = z.input<typeof Film3DSchema>;

export const ASPECTS = {
  "16x9": { width: 1920, height: 1080 },
  "9x16": { width: 1080, height: 1920 },
  "1x1": { width: 1080, height: 1080 },
} as const;
export type AspectId = keyof typeof ASPECTS;
