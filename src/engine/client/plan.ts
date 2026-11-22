import { compileFilm } from "../compile/compile";
import type { FilmSpecInput } from "../schema/film";
import type { ClientBrief } from "./brief";
import type { ScreenPresentation } from "./screen";

interface AssetForPlan {
  path: string;
  sha256: string;
  kind: "image" | "video";
  durationSeconds: number | null;
}

const aspectId = { "16:9": "16x9", "9:16": "9x16", "1:1": "1x1" } as const;

export function planProject(brief: ClientBrief, assets: readonly AssetForPlan[]) {
  const byPath = new Map(assets.map((asset) => [asset.path, asset]));
  function bind(path: string, field: string, trim?: { startSeconds: number; endSeconds: number }, presentation?: ScreenPresentation) {
    const asset = byPath.get(path);
    if (!asset) throw new Error(field + ': "' + path + '" is missing or failed media analysis. Check the scan diagnostics and exact filename.');
    if (trim && (asset.durationSeconds === null || trim.endSeconds > asset.durationSeconds)) {
      throw new Error(field.replace(/\.asset$/, ".trim") + ": trim requires a video and must fit within its measured duration");
    }
    const sourceRange = asset.durationSeconds === null ? null : trim ?? { startSeconds: 0, endSeconds: asset.durationSeconds };
    return { path: asset.path, sha256: asset.sha256, kind: asset.kind, sourceRange, ...(presentation ? { presentation } : {}) };
  }

  const beats = [
    { id: "hook", title: brief.hook, body: brief.brand.name, weight: 0.2, asset: bind(brief.hero, "hero", undefined, brief.heroPresentation) },
    ...brief.features.map((feature, index) => ({
      id: "feature-" + (index + 1), title: feature.title, body: feature.body,
      weight: 0.6 / brief.features.length, asset: bind(feature.asset, "features." + index + ".asset", feature.trim, feature.presentation),
    })),
    { id: "cta", title: brief.cta, body: brief.brand.name, weight: 0.2, asset: null },
  ];
  const totalFrames = brief.durationSeconds * brief.fps;
  let fraction = 0;
  let start = 0;
  const timeline: FilmSpecInput["timeline"] = beats.map((beat, index) => {
    fraction += beat.weight;
    const end = index === beats.length - 1 ? totalFrames : Math.round(totalFrames * fraction);
    const length = ((end - start) + "f") as `${number}f`;
    start = end;
    return {
      id: beat.id, length, transitionIn: { type: "cut" },
      overlay: [
        { kind: "text", role: "headline", anchor: "top", content: beat.title, exit: "none" },
        { kind: "text", role: "body", anchor: "bottom", content: beat.body, exit: "none" },
      ],
    };
  });
  const spec = {
    schemaVersion: "1", id: brief.id, seed: 1, look: brief.look,
    palette: { primary: brief.brand.color },
    output: { fps: brief.fps, aspects: brief.aspectRatios.map((ratio) => aspectId[ratio]) },
    audio: { grid: { bpm: 120 }, quantize: "none" },
    timeline,
  } satisfies FilmSpecInput;
  const compiled = compileFilm(spec);
  return {
    schemaVersion: "1" as const,
    purpose: "ingestion-plan" as const,
    locale: brief.locale,
    assetDirectory: brief.assets.directory,
    totalFrames: compiled.durationInFrames,
    filmSpec: compiled.spec,
    shots: compiled.stage.scenes.map((scene, index) => ({
      id: scene.id,
      startFrame: Math.round(scene.start * compiled.fps),
      durationFrames: Math.round(scene.length * compiled.fps),
      asset: beats[index].asset,
    })),
  };
}
