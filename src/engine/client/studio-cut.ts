import type { ClientBrief } from "./brief";
import type { FilmSpecInput } from "../schema/film";
import type { Vec3 } from "../time/animatable";
import { ASPECTS, type AspectId } from "../../stage3d/schema";
import { editorialLayout, type EditorialSafeAreas, type StudioTemplate } from "./editorial";

export function studioScene(
  beat: { id: string; title: string; body: string; label: string },
  length: `${number}f`,
  motion: NonNullable<ClientBrief["editorial"]>["motion"],
  template: StudioTemplate,
  closingStatement?: string,
): FilmSpecInput["timeline"][number] {
  const closing = beat.id === "cta";
  const hook = beat.id === "hook";
  const proposition = beat.id === "proposition";
  const directed = template === "studio-cut-v2";
  const move = motion === "expressive" ? 1.5 : 1;
  const set = closing ? { inner: "#23386e", outer: "#0d1535", ceramic: "#3c508e", edge: "#2b407e" } :
    { inner: "#fff7ec", outer: "#e6eaf5", ceramic: "#8297cd", edge: "#acbada" };

  return {
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
  };
}

/** Place the actual 3D relief under each aspect's product plane. Camera distance and lens match studioScene. */
export function stageStudioCut(spec: FilmSpecInput, aspect: AspectId, safeAreas: EditorialSafeAreas, template?: StudioTemplate): FilmSpecInput {
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
    const { media, eyebrow } = editorialLayout(aspect, frame, scene.id, safeAreas, template);
    const centerX = media ? media.left + media.width / 2 : frame.width * 0.88;
    const centerY = media ? media.top + media.height / 2 : frame.height * 0.85;
    const side = centerX >= frame.width / 2 ? 1 : -1;
    const x = (centerX - frame.width / 2) * worldShortSide / shortSide + side * 0.24;
    const copyBelow = media && eyebrow.top >= media.top + media.height;
    const y = (frame.height / 2 - centerY) * worldShortSide / shortSide + (copyBelow ? 0.40 : -0.41);
    return { ...scene, world: { ...scene.world, nodes: scene.world.nodes?.map((node, index) => {
      const position: Vec3 = [x + index * 0.04 * side, y - index * 0.16, -0.68 - index * 0.32];
      if (node.type === "primitive" && typeof node.material === "object" && node.material.color?.startsWith("#")) {
        return { ...node, position, material: { ...node.material, color: tint(node.material.color as `#${string}`) } };
      }
      return { ...node, position };
    }) } };
  }) };
}
