import { compileFilm } from "../compile/compile";
import type { FilmSpecInput } from "../schema/film";
import type { ClientBrief } from "./brief";
import { sourceFrames, type ScreenPresentation } from "./screen";
import { studioScene } from "./studio-cut";

interface AssetForPlan {
  path: string;
  sha256: string;
  kind: "image" | "video";
  durationSeconds: number | null;
}

const aspectId = { "16:9": "16x9", "9:16": "9x16", "1:1": "1x1" } as const;
function byAspect<T>(values?: Partial<Record<keyof typeof aspectId, T>>) {
  const result: Partial<Record<(typeof aspectId)[keyof typeof aspectId], T>> = {};
  for (const ratio of Object.keys(aspectId) as Array<keyof typeof aspectId>) {
    const value = values?.[ratio];
    if (value !== undefined) result[aspectId[ratio]] = value;
  }
  return result;
}

export function planProject(brief: ClientBrief, assets: readonly AssetForPlan[]) {
  const byPath = new Map(assets.map((asset) => [asset.path, asset]));
  const studio = brief.editorial;
  function bind(path: string, field: string, trim?: { startSeconds: number; endSeconds: number }, presentation?: ScreenPresentation,
    framing?: Partial<Record<keyof typeof aspectId, ScreenPresentation>>) {
    const asset = byPath.get(path);
    if (!asset) throw new Error(field + ': "' + path + '" is missing or failed media analysis. Check the scan diagnostics and exact filename.');
    if (trim && (asset.durationSeconds === null || trim.endSeconds > asset.durationSeconds)) {
      throw new Error(field.replace(/\.asset$/, ".trim") + ": trim requires a video and must fit within its measured duration");
    }
    const sourceRange = asset.durationSeconds === null ? null : trim ?? { startSeconds: 0, endSeconds: asset.durationSeconds };
    return { path: asset.path, sha256: asset.sha256, kind: asset.kind, sourceRange, ...(presentation ? { presentation } : {}),
      ...(framing ? { aspectPresentations: byAspect(framing) } : {}) };
  }

  const hero = bind(brief.hero, "hero", undefined, brief.heroPresentation, studio?.heroFraming);
  const beats = [
    { id: "hook", title: brief.hook, body: brief.brand.name, label: studio?.productLabel ?? "",
      weight: studio ? 2 / 14 : 0.2, asset: hero },
    ...(studio ? [{ id: "proposition", title: studio.proposition.title, body: studio.proposition.body, label: "",
      weight: 2.5 / 14, asset: bind(studio.proposition.asset ?? brief.hero, "editorial.proposition.asset", undefined,
        studio.proposition.presentation ?? brief.heroPresentation,
        studio.proposition.framing ?? (studio.proposition.asset || studio.proposition.presentation ? undefined : studio.heroFraming)) }] : []),
    ...brief.features.map((feature, index) => ({
      id: "feature-" + (index + 1), title: feature.title, body: feature.body, label: feature.label ?? "",
      weight: studio ? (brief.features.length === 2 ? [3, 3.5][index] : 6.5 / brief.features.length) / 14 : 0.6 / brief.features.length,
      asset: bind(feature.asset, "features." + index + ".asset", feature.trim, feature.presentation, feature.framing),
    })),
    { id: "cta", title: brief.cta, body: studio ? studio.closingLine ?? "" : brief.brand.name, label: brief.brand.name,
      weight: 0.2, asset: null },
  ];
  const totalFrames = brief.durationSeconds * brief.fps;
  let fraction = 0;
  let start = 0;
  const results = new Map<string, NonNullable<ClientBrief["features"][number]["result"]> & { localFrame: number; movieFrame: number }>();
  const timeline: FilmSpecInput["timeline"] = beats.map((beat, index) => {
    fraction += beat.weight;
    const end = index === beats.length - 1 ? totalFrames : Math.round(totalFrames * fraction);
    const shotFrames = end - start;
    const length = `${shotFrames}f` as const;
    const shotStart = start;
    start = end;
    if (studio) {
      const featureIndex = beat.id.startsWith("feature-") ? Number(beat.id.slice(8)) - 1 : -1;
      const result = brief.features[featureIndex]?.result;
      if (result) {
        const label = `features.${featureIndex}.result`;
        if (beat.asset?.kind !== "video" || !beat.asset.sourceRange) throw new Error(label + " requires a recording");
        const source = sourceFrames(beat.asset.sourceRange, brief.fps, shotFrames);
        const localFrame = result.sourceFrame - source.start;
        if (result.sourceFrame < source.start || result.sourceFrame >= source.end) {
          throw new Error(label + " frame is outside the recording trim shown in this shot");
        }
        if (localFrame < 18 || shotFrames - localFrame < 12) {
          throw new Error(label + " needs 18 frames of setup and 12 frames of readable result");
        }
        results.set(beat.id, { ...result, localFrame, movieFrame: shotStart + localFrame });
      }
      return studioScene(beat, length, studio.motion, studio.template, studio.closingStatement, results.get(beat.id));
    }
    return {
      id: beat.id, length, transitionIn: { type: "cut" },
      overlay: [
        { kind: "text", role: "headline", anchor: "top", content: beat.title, exit: "none" },
        { kind: "text", role: "body", anchor: "bottom", content: beat.body, exit: "none" },
      ],
    };
  });
  const spec = {
    schemaVersion: "1", id: brief.id, seed: 1, look: studio ? "studio" : brief.look,
    palette: { primary: brief.brand.color },
    output: { fps: brief.fps, aspects: brief.aspectRatios.map((ratio) => aspectId[ratio]) },
    audio: { grid: { bpm: 120 }, quantize: "none" },
    timeline,
  } satisfies FilmSpecInput;
  const compiled = compileFilm(spec);
  const shots = compiled.stage.scenes.map((scene, index) => ({
    id: scene.id,
    startFrame: Math.round(scene.start * compiled.fps),
    durationFrames: Math.round(scene.length * compiled.fps),
    asset: beats[index].asset,
    ...(results.has(scene.id) ? { result: results.get(scene.id) } : {}),
  }));
  const soundCues = studio?.audio.cues?.map((cue) => {
    const shot = shots.find((item) => item.id === cue.atShot);
    if (!shot || cue.offsetFrames >= shot.durationFrames) {
      throw new Error(`Sound cue ${cue.file} is outside its named shot ${cue.atShot}`);
    }
    return { file: cue.file, gainDb: cue.gainDb, startFrame: shot.startFrame + cue.offsetFrames };
  });
  return {
    schemaVersion: "1" as const,
    purpose: "ingestion-plan" as const,
    locale: brief.locale,
    assetDirectory: brief.assets.directory,
    totalFrames: compiled.durationInFrames,
    filmSpec: compiled.spec,
    ...(studio ? { editorial: {
      template: studio.template, logo: studio.logo, audio: studio.audio, motion: studio.motion,
      safeAreas: byAspect(studio.safeAreas),
      ...(studio.direction ? { direction: studio.direction } : {}),
      ...(soundCues?.length ? { resolvedSoundCues: soundCues } : {}),
      cues: shots.map((shot) => ({ scene: shot.id, frame: shot.startFrame })),
    } } : {}),
    shots,
  };
}
