import type { FilmSpecInput } from "../schema/film";
import type { Vec3 } from "../time/animatable";

type Scene = FilmSpecInput["timeline"][number];
type Box = { left: number; top: number; width: number; height: number };

export function obsidianScene(scene: Scene, resultFrame?: number): Scene {
  const close = scene.id === "cta";
  const hero = scene.id === "proposition";
  const proof = resultFrame !== undefined;
  const light = proof ? {
    keys: [
      { at: "0f" as const, value: 1.25 },
      { at: `${resultFrame}f` as const, value: 1.25 },
      { at: `${resultFrame + 7}f` as const, value: 1.95, ease: "smooth" as const },
      { at: `${resultFrame + 21}f` as const, value: 1.62, ease: "smooth" as const },
    ],
  } : hero ? 1.88 : close ? 1.73 : 1.40;
  return {
    ...scene,
    world: {
      backdrop: { type: "gradient", inner: hero ? "#435d89" : "#263a63", outer: "#060914" },
      lighting: { rig: "studioSoftbox", intensity: light, rotation: hero ? -39 : proof ? 29 : -17 },
      nodes: [
        {
          type: "primitive", id: "obsidian-fold", shape: "sweptSheet",
          dimensions: [2.75, 1.6, 1.15], rotation: [9, hero ? -23 : 16, close ? 13 : hero ? -34 : proof ? -27 : -17],
          material: { preset: "obsidian", color: "#435574", roughness: 0.18, metalness: 0.62,
            emissive: "palette.primary", emissiveIntensity: close ? 0.11 : 0.055 },
        },
        {
          type: "primitive", id: "obsidian-rim", shape: "sweptSheet",
          dimensions: [2.25, 1.18, 0.90], rotation: [-18, 28, close ? -20 : 15],
          material: { preset: "brushedMetal", color: "#445a82", roughness: 0.21, metalness: 0.75,
            emissive: "palette.primary", emissiveIntensity: 0.035 },
        },
      ],
    },
    post: {
      toneMapping: "agx", exposure: 1.14, bloom: false, dof: false, chromaticAberration: false,
      vignette: false, grain: 0.012,
    },
    camera: {
      ...scene.camera,
      distance: scene.camera?.distance ?? 5.5,
      moves: hero ? [{ rig: "truck", amount: 0.29, from: 0, to: 1.4, ease: "smooth" }]
        : close ? [{ rig: "pullBack", amount: 0.065, from: 0.15, to: 1.30, ease: "smooth" }]
        : proof ? [{ rig: "pushIn", amount: 0.052, from: `${resultFrame}f`, to: `${resultFrame + 20}f`, ease: "smooth" }]
        : [{ rig: "orbit", degrees: scene.id === "hook" ? 10 : -7, ease: "smooth" }],
    },
    overlay: scene.overlay?.map((element) => {
      if (element.kind !== "text" || element.id === "action") return element;
      const color = element.id === "eyebrow" ? "#9edcd6" : element.role === "body" ? "#d4deed" : "#ffffff";
      return { ...element, color };
    }),
  };
}

export function stageObsidian(scene: Scene, frame: { width: number; height: number }, media?: Box): Scene {
  const shortSide = Math.min(frame.width, frame.height);
  const widthUnits = frame.width * 3.2 / shortSide;
  const heightUnits = frame.height * 3.2 / shortSide;
  const aimX = media ? ((media.left + media.width / 2) / frame.width - 0.5) * widthUnits : 0;
  const aimY = media ? (0.5 - (media.top + media.height / 2) / frame.height) * heightUnits : 0;
  return {
    ...scene,
    world: {
      ...scene.world,
      nodes: scene.world?.nodes?.map((node) => {
        const near = node.id === "obsidian-fold";
        const position: Vec3 = near
          ? [aimX * 0.70, Math.min(-0.90, aimY - heightUnits * 0.42), -1.0]
          : [-aimX * 0.52, Math.max(1.05, aimY + heightUnits * 0.37), -2.55];
        return { ...node, position };
      }),
    },
  };
}
