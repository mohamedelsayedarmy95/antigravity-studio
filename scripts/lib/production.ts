import { spawnSync } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { isPortablePath, type ClientBrief } from "../../src/engine/client/brief";
import type { planProject } from "../../src/engine/client/plan";
import { compileFilm } from "../../src/engine/compile/compile";
import { AspectIdSchema, type FilmSpecInput } from "../../src/engine/schema/film";
import { ASPECTS, type AspectId } from "../../src/stage3d/schema";
import { mediaDirectory, mediaSha256, type scanProject } from "./client-media";

export const productionProfile = z.enum(["preview", "silent-picture", "final-audio"]);
export type ProductionProfile = z.infer<typeof productionProfile>;
type Plan = ReturnType<typeof planProject>;
type Asset = Awaited<ReturnType<typeof scanProject>>["assets"][number];

export async function validateFilm(input: unknown, publicDirectory: string) {
  if (typeof input !== "object" || input === null) throw new Error("FilmSpec JSON must be an object");
  const film = compileFilm(input as FilmSpecInput);
  const { fps, durationInFrames, stage, spec } = film;
  if (new Set(spec.output.aspects).size !== spec.output.aspects.length) {
    throw new Error("output.aspects must contain distinct aspect ratios");
  }
  if (!Number.isSafeInteger(fps) || !Number.isSafeInteger(durationInFrames) || durationInFrames < 1) {
    throw new Error("FilmSpec must compile to a positive safe frame count and frame rate");
  }
  for (const scene of stage.scenes) {
    if (Math.round((scene.start + scene.length) * fps) <= Math.round(scene.start * fps)) {
      throw new Error("timeline scene " + scene.id + " must occupy at least one output frame");
    }
  }
  const assets = new Set(spec.timeline.flatMap(({ world }) => world.nodes.flatMap((node) => node.type === "logo" ? [node.src] : [])));
  for (const src of assets) {
    if (!isPortablePath(src) || path.posix.extname(src).toLowerCase() !== ".svg") {
      throw new Error("FilmSpec logo src must be a portable public-relative SVG path: " + src);
    }
    const root = await realpath(publicDirectory);
    const parent = path.posix.dirname(src);
    try {
      const directory = parent === "." ? root : await mediaDirectory(root, parent);
      const file = path.join(directory, path.posix.basename(src));
      if (!(await lstat(file)).isFile() || path.relative(file, await realpath(file)) !== "") {
        throw new Error("expected a regular file without links or junctions");
      }
    } catch (error) {
      throw new Error("FilmSpec logo SVG is missing or outside the public directory: " + src + " (" + (error as Error).message + ")");
    }
  }
  return film;
}

export function validateProductionPlan(profile: ProductionProfile, brief: ClientBrief, plan: Plan, assets: readonly Asset[]) {
  if (!brief.renderRights) throw new Error("Render requires a renderRights declaration in the brief covering licensing and privacy");
  if (profile !== "preview" && brief.fps !== 30) throw new Error("The master profile requires a 30 fps brief");
  if (profile === "final-audio" && !plan.editorial) throw new Error("Final audio master requires an editorial audio bed with a license declaration");
  if (plan.totalFrames !== brief.durationSeconds * brief.fps ||
      plan.shots.some(({ durationFrames }) => !Number.isSafeInteger(durationFrames) || durationFrames < 1)) {
    throw new Error("Compiled timeline must match the brief duration and allocate positive whole frames to each shot");
  }
  const catalog = new Map(assets.map((asset) => [asset.path, asset]));
  const selected = new Set(plan.shots.flatMap(({ asset }) => asset ? [asset.path] : []));
  for (const file of selected) {
    const asset = catalog.get(file);
    if (!asset) throw new Error("Selected file is absent from manifest: " + file);
    if (asset.sampleAspectRatio || asset.rotation % 90 !== 0) {
      throw new Error(file + ": render requires square pixels and right-angle orientation");
    }
    if (asset.kind === "video") {
      const { primaries, transfer } = asset.color;
      if ((primaries && !["bt709", "unknown", "unspecified"].includes(primaries)) ||
          (transfer && !["bt709", "iec61966-2-1", "unknown", "unspecified"].includes(transfer))) {
        throw new Error(file + ": unsupported color profile. Supply an SDR sRGB or BT.709 derivative.");
      }
    }
  }
}

export async function readJson(file: string, label: string): Promise<unknown> {
  try {
    return JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new Error(label + " is unreadable or malformed: " + (error as Error).message);
  }
}

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const frame = z.int().nonnegative();
const artifact = z.object({ filename: z.string(), sha256: digest });
const productionReceipt = z.object({
  profile: z.enum(["silent-picture", "final-audio"]),
  expectedFrames: z.int().positive(),
  samples: z.array(z.object({ aspect: AspectIdSchema, frame, files: z.tuple([artifact, artifact]) })),
});
const reviewSheet = artifact.extend({ aspect: AspectIdSchema, frames: z.tuple([frame, frame, frame]) });
const note = z.string().trim().min(1).max(1000);
const evidenceSchema = z.strictObject({
  schemaVersion: z.literal("1"), masterSha256: digest,
  visualReview: z.strictObject({ reviewer: note, notes: note }),
  creativeApproval: z.strictObject({ director: note, decision: z.literal("approved") }).optional(),
  audioRightsReference: note.optional(),
  synchronizationReview: note.optional(),
  audioLimits: z.strictObject({ minLufs: z.number(), maxLufs: z.number(), maxTruePeakDbtp: z.number().max(0) })
    .refine(({ minLufs, maxLufs }) => minLufs <= maxLufs, "minLufs cannot exceed maxLufs").optional(),
});
const audioSources = z.object({
  audio: z.object({ file: note.refine(isPortablePath), license: note,
    cues: z.array(z.object({ file: note.refine(isPortablePath), license: note })).optional() }),
  audioSha256: digest,
  soundCueSources: z.array(z.object({ file: note, sourceSha256: digest, startFrame: frame })),
});

export function pngPixelHash(file: string, aspect?: AspectId) {
  const result = spawnSync("ffmpeg", ["-nostdin", "-v", "error", "-xerror", "-threads", "1",
    "-protocol_whitelist", "file", "-f", "png_pipe", "-i", file, "-frames:v", "1", "-threads", "1",
    "-pix_fmt", "rgba", "-f", "framehash", "-hash", "sha256", "-"],
  { encoding: "utf8", windowsHide: true, timeout: 30000 });
  const hash = result.stdout?.trim().match(/,\s*([a-f0-9]{64})$/)?.[1];
  const dimensions = aspect && ASPECTS[aspect];
  if (result.error || result.status !== 0 || result.stderr?.trim() || !hash ||
      (dimensions && !result.stdout.includes(`#dimensions 0: ${dimensions.width}x${dimensions.height}`))) {
    throw new Error("Cannot verify PNG pixel evidence: " + path.basename(file));
  }
  return hash;
}

export function verifySamplePixels(first: string, second: string, aspect: AspectId) {
  if (pngPixelHash(first, aspect) !== pngPixelHash(second, aspect)) {
    throw new Error("Sampled PNG pixels differ for " + aspect + ". Repeat the render and investigate frame determinism.");
  }
}

async function verifiedArtifact(batch: string, entry: z.infer<typeof artifact>, name: string) {
  if (entry.filename !== name) throw new Error("Production evidence expected " + name);
  const file = path.join(batch, name);
  const stat = await lstat(file).catch(() => undefined);
  if (!stat?.isFile() || path.relative(file, await realpath(file)) !== "" || await mediaSha256(file) !== entry.sha256) {
    throw new Error("Production evidence is missing, linked or changed: " + name);
  }
  return file;
}

export async function verifyProductionEvidence(input: {
  record: unknown; reviewSheets: unknown; editorial: unknown; batch: string; evidenceFile: string;
  aspect: AspectId; masterHash: string; frames: number;
  audio?: { integratedLufs: number; truePeakDbtp: number };
  release: boolean;
}) {
  const { batch, aspect, masterHash, audio } = input;
  const record = productionReceipt.safeParse(input.record);
  if (!record.success) throw new Error("Production receipt is missing or invalid. Render a new governed master.");
  const { profile, expectedFrames, samples } = record.data;
  if (input.frames !== expectedFrames) throw new Error("Master frame count differs from the approved production timeline");
  if ((profile === "final-audio") !== Boolean(audio)) throw new Error("Master audio streams do not match the production profile");
  if (input.release && profile !== "final-audio") throw new Error("Final handoff requires a final-audio master");
  const evidence = evidenceSchema.parse(await readJson(input.evidenceFile, "Production evidence JSON"));
  if (evidence.masterSha256 !== masterHash) throw new Error("Production evidence SHA-256 identifies a different master");
  const selected = samples.filter((sample) => sample.aspect === aspect);
  if (selected.length !== 1 || selected[0].frame >= expectedFrames) throw new Error("Production receipt needs one in-range determinism sample pair for " + aspect);
  const sheets = z.array(reviewSheet).safeParse(input.reviewSheets);
  const reviews = sheets.success ? sheets.data.filter((sheet) => sheet.aspect === aspect) : [];
  if (reviews.length !== 1 || reviews[0].frames[2] >= expectedFrames ||
      !reviews[0].frames.every((index, i, indices) => i === 0 || index > indices[i - 1])) {
    throw new Error("Production receipt needs a valid encoded-picture review sheet for " + aspect);
  }
  pngPixelHash(await verifiedArtifact(batch, reviews[0], "review-" + aspect + ".png"));
  const files = await Promise.all(selected[0].files.map((file, i) =>
    verifiedArtifact(batch, file, `determinism-${aspect}-${i === 0 ? "a" : "b"}.png`)));
  verifySamplePixels(files[0], files[1], aspect);

  if (audio) {
    const { creativeApproval, audioRightsReference, synchronizationReview, audioLimits } = evidence;
    if (!creativeApproval || !audioRightsReference || !synchronizationReview || !audioLimits) {
      throw new Error("Final evidence requires creativeApproval, audioRightsReference, synchronizationReview and audioLimits");
    }
    const sources = audioSources.safeParse(input.editorial);
    if (!sources.success || sources.data.soundCueSources.length !== (sources.data.audio.cues?.length ?? 0) ||
        sources.data.soundCueSources.some((source, index) =>
          source.file !== sources.data.audio.cues?.[index].file || source.startFrame >= expectedFrames)) {
      throw new Error("Final master receipt requires licensed audio source and cue hashes");
    }
    if (audio.integratedLufs < audioLimits.minLufs || audio.integratedLufs > audioLimits.maxLufs) {
      throw new Error("Master loudness " + audio.integratedLufs + " LUFS falls outside the requested range");
    }
    if (audio.truePeakDbtp > audioLimits.maxTruePeakDbtp) {
      throw new Error("Master true peak " + audio.truePeakDbtp + " dBTP exceeds the requested limit");
    }
  }
  return profile;
}
