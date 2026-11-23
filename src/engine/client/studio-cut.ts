import type { ClientBrief } from "./brief";
import type { FilmSpecInput } from "../schema/film";
import type { Vec3 } from "../time/animatable";
import { ASPECTS, type AspectId } from "../../stage3d/schema";
import { editorialLayout, type EditorialMotion, type EditorialSafeAreas, type StudioArtDirection, type StudioTemplate } from "./editorial";
import { studioBrandWash, studioExpressivePost } from "./studio-finishing";
import { obsidianScene, stageObsidian } from "./studio-obsidian";

/** Creative fusion: Qwen's contrast, Gemini's sculptural silhouettes, Claude's shot grammar,
 * Grok's motion variety, and the fifth candidate's strict legacy compatibility.
 * No new FilmSpec types, assets, dependencies, or renderer entrypoints are required.
 */
type Hex = `#${string}`;
type BeatId = "hook" | "proposition" | "feature-1" | "feature-2" | "feature-3" | "feature-4" | "cta";
type Tone = "paper" | "silver" | "mist" | "night";
type Move =
  | { rig: "orbit"; degrees: number; ease: "smooth" | "expoOut" }
  | { rig: "pushIn"; amount: number; ease: "smooth" | "expoOut" }
  | { rig: "pullBack" | "truck"; amount: number; ease: "smooth" | "expoOut"; from: number; to: number };
type SetPiece = {
  id: string;
  dimensions: Vec3;
  rotation: Vec3;
  surface: "primary" | "edge" | "accent";
  roughness: number;
};
type ArtDirection = {
  tone: Tone;
  lens: number;
  azimuth: number;
  elevation: number;
  lightAngle: number;
  lightIntensity: number;
  exposure?: number;
  move: Move;
  headlineAt: number;
  bodyAt: number;
  pieces: readonly SetPiece[];
};
const tones: Record<Tone, { inner: Hex; outer: Hex; primary: Hex; edge: Hex; accent: Hex }> = {
  paper:  { inner: "#fff7ec", outer: "#e6eaf5", primary: "#8297cd", edge: "#acbada", accent: "#d9c7b9" },
  silver: { inner: "#f3f7ff", outer: "#dce6f6", primary: "#7289c3", edge: "#a9bce2", accent: "#c5d0e7" },
  mist:   { inner: "#fff5e9", outer: "#e9edf8", primary: "#8fa4d0", edge: "#b0bedc", accent: "#d6c6b4" },
  night:  { inner: "#23386e", outer: "#0d1535", primary: "#3c508e", edge: "#2b407e", accent: "#6176b5" },
};
const piece = (id: string, dimensions: Vec3, rotation: Vec3, surface: SetPiece["surface"], roughness: number): SetPiece =>
  ({ id, dimensions, rotation, surface, roughness });

/** Each beat has a distinct purpose; effects support product comprehension rather than obscure it.
 *  Framing stays calibrated to existing 2D screen layouts. Shot-specific lens/distance are coupled.
 */
const direction: Record<BeatId, ArtDirection> = {
  hook: {
    tone: "paper", lens: 40, azimuth: -5, elevation: 5, lightAngle: -24, lightIntensity: 1.0, exposure: 1.43,
    move: { rig: "pullBack", amount: 0.105, from: 0.08, to: 1.42, ease: "smooth" },
    headlineAt: -0.55, bodyAt: 0.20,
    pieces: [
      piece("gallery-hook-platform", [2.03, 0.43, 0.32], [13, -12, -5], "primary", 0.53),
    ],
  },
  proposition: {
    tone: "silver", lens: 50, azimuth: 8, elevation: 7, lightAngle: 31, lightIntensity: 0.94, exposure: 1.39,
    move: { rig: "truck", amount: 0.22, from: 0.05, to: 1.50, ease: "expoOut" },
    headlineAt: 0.06, bodyAt: 0.27,
    pieces: [
      piece("gallery-value-column", [0.35, 1.65, 0.26], [16, 17, 8], "primary", 0.48),
      piece("gallery-value-lintel", [1.65, 0.34, 0.29], [23, 11, -9], "edge", 0.63),
      piece("gallery-value-threshold", [1.28, 0.16, 0.17], [10, 5, -4], "accent", 0.72),
    ],
  },
  "feature-1": {
    tone: "mist", lens: 52, azimuth: -7, elevation: 9, lightAngle: -19, lightIntensity: 0.97, exposure: 1.45,
    move: { rig: "pushIn", amount: 0.063, ease: "expoOut" }, headlineAt: 0.04, bodyAt: 0.20,
    pieces: [
      piece("gallery-detail-pedestal", [1.12, 0.90, 0.29], [25, -14, -11], "primary", 0.56),
      piece("gallery-detail-cap", [0.72, 0.31, 0.23], [25, -14, -11], "edge", 0.65),
    ],
  },
  "feature-2": {
    tone: "silver", lens: 42, azimuth: 9, elevation: 3, lightAngle: 29, lightIntensity: 0.93, exposure: 1.46,
    move: { rig: "orbit", degrees: -6, ease: "smooth" }, headlineAt: 0.13, bodyAt: 0.31,
    pieces: [
      piece("gallery-motion-fin-a", [0.30, 1.50, 0.24], [16, -19, 12], "primary", 0.50),
      piece("gallery-motion-fin-b", [0.29, 1.13, 0.20], [16, 16, -12], "edge", 0.61),
      piece("gallery-motion-base", [1.35, 0.17, 0.20], [8, -7, -5], "accent", 0.71),
    ],
  },
  "feature-3": {
    tone: "paper", lens: 47, azimuth: -4, elevation: 6, lightAngle: -31, lightIntensity: 0.98, exposure: 1.42,
    move: { rig: "truck", amount: 0.14, from: 0.10, to: 1.25, ease: "smooth" },
    headlineAt: 0.07, bodyAt: 0.23,
    pieces: [
      piece("gallery-proof-folio", [1.33, 1.29, 0.19], [25, -14, -14], "primary", 0.51),
      piece("gallery-proof-offset", [0.55, 1.56, 0.18], [15, 17, 11], "edge", 0.65),
    ],
  },
  "feature-4": {
    tone: "mist", lens: 44, azimuth: 6, elevation: 5, lightAngle: 21, lightIntensity: 0.94, exposure: 1.47,
    move: { rig: "pullBack", amount: 0.053, from: 0.12, to: 1.20, ease: "smooth" },
    headlineAt: 0.12, bodyAt: 0.28,
    pieces: [
      piece("gallery-proof-horizon", [2.08, 0.34, 0.27], [14, 8, -7], "primary", 0.55),
      piece("gallery-proof-spine", [0.27, 1.57, 0.20], [15, -13, 8], "edge", 0.66),
      piece("gallery-proof-underlay", [1.55, 0.17, 0.15], [8, 5, -3], "accent", 0.70),
    ],
  },
  cta: {
    tone: "night", lens: 45, azimuth: 0, elevation: 4, lightAngle: 0, lightIntensity: 0.84,
    move: { rig: "pushIn", amount: 0.025, ease: "expoOut" }, headlineAt: 0.14, bodyAt: 0.27,
    pieces: [
      piece("gallery-close-rule", [1.86, 0.19, 0.20], [12, 0, -4], "edge", 0.64),
    ],
  },
};
/** Motivated, short GPU transitions: expose value, let actions cut crisply, resolve calmly.
 *  The 3D compositor already supports these modes; 2D continuity is handled separately. */
const directedTransitions = {
  proposition: { type: "lightSweep", length: "8f", color: "palette.glow" },
  "feature-2": { type: "dissolve", length: "6f", color: "palette.glow" },
  "feature-4": { type: "dissolve", length: "6f", color: "palette.glow" },
  cta: { type: "dissolve", length: "10f", color: "palette.glow" },
} satisfies Partial<Record<BeatId, NonNullable<FilmSpecInput["timeline"][number]["transitionIn"]>>>;

const artFor = (id: string): ArtDirection => direction[id as BeatId] ?? direction["feature-1"];
/** Maintains roughly the same product-plane size at a new focal length. */
const distanceForLens = (lens: number) => Math.round(lens * 5.5 / 45 * 1000) / 1000;

export function studioScene(
  beat: { id: string; title: string; body: string; label: string },
  length: `${number}f`,
  motion: NonNullable<ClientBrief["editorial"]>["motion"],
  template: StudioTemplate,
  closingStatement?: string,
  result?: { localFrame: number; title: string; body: string },
  artDirection?: StudioArtDirection,
): FilmSpecInput["timeline"][number] {
  const closing = beat.id === "cta";
  const hook = beat.id === "hook";
  const proposition = beat.id === "proposition";
  const directed = template === "studio-cut-v2";
  const move = motion === "expressive" ? 1.5 : 1;
  const set = closing ? { inner: "#23386e", outer: "#0d1535", ceramic: "#3c508e", edge: "#2b407e" } :
    { inner: "#fff7ec", outer: "#e6eaf5", ceramic: "#8297cd", edge: "#acbada" };

  const baseline = {
    id: beat.id, length, transitionIn: { type: "cut" },
    world: {
      backdrop: { type: "gradient", inner: set.inner, outer: set.outer },
      lighting: { rig: "studioSoftbox", intensity: closing ? 0.84 : 0.96, rotation: proposition ? -34 : 29 },
      nodes: [
        { type: "primitive", id: "upper-slab", shape: "roundedBox", rotation: [29, proposition ? -18 : 18, -15],
          dimensions: [1.64, 1.03, 0.28], material: { preset: "ceramic", color: set.ceramic, roughness: 0.58 } },
        { type: "primitive", id: "lower-slab", shape: "roundedBox", rotation: [29, proposition ? -18 : 18, -15],
          dimensions: [1.60, 1.10, 0.36], material: { preset: "ceramic", color: set.edge, roughness: 0.65 } },
      ],
    },
    post: closing ? undefined : { toneMapping: "aces", exposure: 1.48 },
    camera: {
      lens: 45, target: [0, 0, 0], azimuth: proposition ? -7 : 4, elevation: 5, distance: 5.5,
      moves: directed && hook ? [{ rig: "pullBack", amount: 0.09, from: 0.2, to: 1.4, ease: "smooth" }] :
        directed && proposition ? [{ rig: "truck", amount: 0.24, from: 0, to: 1.5, ease: "expoOut" }] :
        hook ? [{ rig: "pushIn", amount: 0.072 * move, ease: "expoOut" }] :
        [{ rig: "orbit", degrees: (closing ? 9 : proposition ? -7 : 4) * move, ease: "smooth" }],
    },
    overlay: [
      ...(beat.label ? [{ id: "eyebrow", kind: "text" as const, role: closing ? "title" as const : "label" as const, content: beat.label, reveal: "fade" as const,
        exit: "none" as const, color: closing ? "#c5d4ff" as const : "#263a78" as const, at: 0 }] : []),
      { id: "headline", kind: "text", role: hook || closing ? "display" : "headline", content: closing && closingStatement ? closingStatement : beat.title,
        reveal: closing ? directed ? "maskedRise" : "perGlyph" : hook ? "fade" : "maskedRise", exit: "none",
        color: closing ? "#ffffff" : "palette.ink", at: hook ? -0.7 : directed && closing ? 0.14 : 0.07 },
      ...(beat.body ? [{ id: "body", kind: "text" as const, role: "body" as const, content: beat.body,
        reveal: "fade" as const, exit: "none" as const, color: closing ? "#dbe4ff" as const : "#34405b" as const, at: hook ? 0.18 : 0.22 }] : []),
      ...(closing && closingStatement ? [{ id: "action", kind: "text" as const, role: "title" as const, content: beat.title,
        reveal: "fade" as const, exit: "none" as const, color: "#142649" as const, at: 0.44 }] : []),
    ],
  } satisfies FilmSpecInput["timeline"][number];

  // Preserve every existing v1 and measured-v2 scene, including output IDs, overlay and timing.
  if (template !== "studio-cut-v2" || motion !== "expressive") return baseline;

  const art = artFor(beat.id);
  const tone = tones[art.tone];
  const resultAt = result ? `${result.localFrame}f` as const : undefined;
  const scene: FilmSpecInput["timeline"][number] = {
    ...baseline,
    transitionIn: directedTransitions[beat.id as keyof typeof directedTransitions] ?? baseline.transitionIn,
    world: {
      backdrop: { type: "gradient", inner: tone.inner, outer: tone.outer },
      lighting: { rig: "studioSoftbox", intensity: art.lightIntensity, rotation: art.lightAngle },
      nodes: (result ? [] : art.pieces).map((p) => ({
        type: "primitive" as const,
        id: p.id,
        shape: "roundedBox" as const,
        dimensions: p.dimensions,
        rotation: p.rotation,
        material: { preset: "ceramic" as const, color: tone[p.surface], roughness: p.roughness },
      })),
    },
    post: studioExpressivePost(beat.id),
    camera: {
      ...baseline.camera,
      lens: art.lens,
      distance: distanceForLens(art.lens),
      azimuth: art.azimuth,
      elevation: art.elevation,
      moves: [art.move],
    },
    overlay: [...baseline.overlay.map((overlay) => {
      if (overlay.id === "headline") {
        return { ...overlay, at: hook ? 0 : art.headlineAt, reveal: hook ? "hold" as const : "maskedRise" as const,
          ...(resultAt ? { out: resultAt } : {}) };
      }
      if (overlay.id === "body") return { ...overlay, at: art.bodyAt, ...(resultAt ? { out: resultAt } : {}) };
      return overlay;
    }), ...(result ? [
      { id: "result-headline", kind: "text" as const, role: "headline" as const, content: result.title,
        reveal: "hold" as const, exit: "none" as const, color: "palette.ink" as const, at: resultAt },
      { id: "result-body", kind: "text" as const, role: "body" as const, content: result.body,
        reveal: "hold" as const, exit: "none" as const, color: "#34405b" as const, at: resultAt },
    ] : [])],
  };
  return artDirection === "obsidian" ? obsidianScene(scene, result?.localFrame) : scene;
}

/** Preserve legacy staging byte-for-byte. Expressive scene reliefs are identified by
 *  their `gallery-` node IDs; they adopt the same lens/distance calibration as their camera.
 *  Editorial screen and copy placement is deliberately unchanged until the renderer caller is audited.
 */
export function stageStudioCut(spec: FilmSpecInput, aspect: AspectId, safeAreas: EditorialSafeAreas, template?: StudioTemplate,
  motion: EditorialMotion = "measured", artDirection?: StudioArtDirection): FilmSpecInput {
  const frame = ASPECTS[aspect];
  const shortSide = Math.min(frame.width, frame.height);
  const worldShortSide = 6.35 * 24 / 45;
  const brand = spec.palette?.primary;
  const tint = (base: `#${string}`) => brand ? "#" + [1, 3, 5].map((i) => {
    const pair = (color: string) => Number.parseInt(color.slice(i, i + 2), 16);
    return Math.round(pair(base) * 0.72 + pair(brand) * 0.28).toString(16).padStart(2, "0");
  }).join("") : base;
  return { ...spec, timeline: spec.timeline.map((scene) => {
    if (!scene.world) return scene;
    const expressiveRelief = template === "studio-cut-v2" &&
      scene.world.nodes?.some((node) => node.id.startsWith("gallery-"));
    const lens = scene.camera?.lens;
    const distance = scene.camera?.distance;
    // FilmSpec also supports animated lenses and radius-based framing. Our directed shots use
    // numeric values; otherwise retain the legacy scale instead of doing arithmetic on objects.
    const scale = expressiveRelief && typeof lens === "number" && lens > 0 && typeof distance === "number"
      ? (distance + 0.85) * 24 / lens : worldShortSide;
    const { media, eyebrow } = editorialLayout(aspect, frame, scene.id, safeAreas, template, motion);
    if (artDirection === "obsidian") return stageObsidian(scene, frame, media);
    const centerX = media ? media.left + media.width / 2 : frame.width * 0.88;
    const centerY = media ? media.top + media.height / 2 : frame.height * 0.85;
    const side = centerX >= frame.width / 2 ? 1 : -1;
    const x = (centerX - frame.width / 2) * scale / shortSide + side * 0.24;
    const copyBelow = media && eyebrow.top >= media.top + media.height;
    const y = (frame.height / 2 - centerY) * scale / shortSide + (copyBelow ? 0.40 : -0.41);
    // Keep screen, type and CTA colors untouched; only the existing background receives
    // a subtle brand wash in expressive gallery mode. The legacy palette is identical.
    const backdrop = scene.world.backdrop;
    let finishedBackdrop = backdrop;
    if (expressiveRelief && motion === "expressive" && scene.id !== "cta" && backdrop?.type === "gradient") {
      // Narrow the discriminated union before accessing gradient-only fields.
      // `outer` is optional in FilmSpec: do not invent a value when it is absent.
      finishedBackdrop = {
        ...backdrop,
        inner: studioBrandWash(backdrop.inner, brand, 0.055),
        ...(backdrop.outer === undefined ? {} : { outer: studioBrandWash(backdrop.outer, brand, 0.075) }),
      };
    }
    return { ...scene, world: { ...scene.world, backdrop: finishedBackdrop, nodes: scene.world.nodes?.map((node, index) => {
      const position: Vec3 = [x + index * 0.04 * side, y - index * 0.16, -0.68 - index * 0.32];
      // Slightly staggered depth arrival uses the existing deterministic node transform.
      // Keep positions numeric so screen registration and legacy staging stay exact.
      const axis = node.rotation;
      const stableRotation: Vec3 | undefined = Array.isArray(axis) && axis.length === 3 && axis.every(Number.isFinite)
        ? [axis[0], axis[1], axis[2]] : undefined;
      const spin = expressiveRelief && motion === "expressive" && scene.id !== "cta" &&
        node.id.startsWith("gallery-") && stableRotation
        ? { rotation: { keys: [
          { at: "0f" as const, value: [stableRotation[0] + (index % 2 ? -5 : 6),
            stableRotation[1] + (scene.id === "hook" ? -13 : 8), stableRotation[2] + (index % 2 ? 7 : -7)] as Vec3 },
          { at: `${25 + index * 5}f` as `${number}f`, value: stableRotation, ease: "smooth" as const },
        ] } } : {};
      const arrival = expressiveRelief && motion === "expressive" && scene.id !== "cta" && node.id.startsWith("gallery-")
        ? { scale: { keys: [
          { at: "0f" as const, value: index % 2 === 0 ? 0.95 : 0.92 },
          { at: `${22 + index * 5}f` as `${number}f`, value: 1, ease: "smooth" as const },
        ] } } : {};
      if (node.type === "primitive" && typeof node.material === "object" && node.material.color?.startsWith("#")) {
        return { ...node, ...arrival, ...spin, position, material: { ...node.material, color: tint(node.material.color as `#${string}`) } };
      }
      return { ...node, ...arrival, ...spin, position };
    }) } };
  }) };
}
