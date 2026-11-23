import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants, createWriteStream } from "node:fs";
import { lstat, mkdir, mkdtemp, open, readFile, realpath, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { renderRightsSchema } from "../../src/engine/client/brief";
import { copyWithoutAccessUpdate, isWithin, mediaSha256 } from "./client-media";
import { factoryEncoding, verifyFactoryMp4 } from "./client-render";
import { verifyProductionEvidence } from "./production";

const fps = 30;
const deliveryEncoder = {
  codec: "h264", h264Profile: "high", colorSpace: "bt709", pixelFormat: "yuv420p",
  fps, crf: 18, preset: "medium", maxVideoBitrateBps: 8_000_000, bufferBits: 16_000_000,
} as const;
const masterReceipt = z.object({
  schemaVersion: z.literal("1"), profile: z.literal("master"), frame: z.null(),
  frames: z.undefined().optional(), sourceFrameRange: z.undefined().optional(),
  rightsDeclaration: z.unknown(), encoder: z.record(z.string(), z.unknown()),
  production: z.unknown().optional(), reviewSheets: z.unknown().optional(), editorial: z.unknown().optional(),
  files: z.array(z.object({
    filename: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
    aspect: z.enum(["16x9", "9x16", "1x1"]), qa: z.record(z.string(), z.unknown()),
  })).min(1),
});

async function requireUnlinkedFile(file: string, label: string) {
  if (!(await lstat(file)).isFile() || path.relative(file, await realpath(file)) !== "") {
    throw new Error(label + " must be a regular file without links or junctions");
  }
}

export async function resolveDeliveryMaster(file: string) {
  const master = path.resolve(file);
  if (path.extname(master).toLowerCase() !== ".mp4") throw new Error("Delivery requires a factory master MP4");
  await requireUnlinkedFile(master, "Master MP4");
  const batch = path.dirname(master);
  const receipt = path.join(batch, "render-report.json");
  await requireUnlinkedFile(receipt, "Master receipt");
  return { master, batch, receipt };
}

async function snapshot(source: string, target: string) {
  if (process.platform === "win32") {
    if (copyWithoutAccessUpdate([{ source, target }]).length) throw new Error("Cannot securely snapshot the master input");
    return;
  }
  const handle = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat({ bigint: true });
    const current = await lstat(source, { bigint: true });
    if (!before.isFile() || current.dev !== before.dev || current.ino !== before.ino ||
        path.relative(source, await realpath(source)) !== "") throw new Error("Master input changed while opening it");
    await pipeline(handle.createReadStream({ autoClose: false }), createWriteStream(target, { flags: "wx" }));
    const after = await handle.stat({ bigint: true });
    if (after.size !== before.size || after.ctimeNs !== before.ctimeNs || after.mtimeNs !== before.mtimeNs) {
      throw new Error("Master input changed during snapshot");
    }
  } finally {
    await handle.close();
  }
}

async function readMasterReceipt(file: string, filename: string) {
  let data: unknown;
  try { data = JSON.parse(await readFile(file, "utf8")); }
  catch { throw new Error("Master render-report.json is unreadable or malformed"); }
  const parsed = masterReceipt.safeParse(data);
  if (!parsed.success) throw new Error("A full master render-report.json is required");
  if (!renderRightsSchema.safeParse(parsed.data.rightsDeclaration).success) {
    throw new Error("Master receipt requires an affirmative operator render rights declaration");
  }
  if (!isDeepStrictEqual(parsed.data.encoder, factoryEncoding("master", fps))) {
    throw new Error("Master receipt does not record the factory 30 fps master encoder");
  }
  const matching = parsed.data.files.filter((entry) => entry.filename.toLowerCase() === filename.toLowerCase());
  if (matching.length !== 1) throw new Error("Master receipt must identify the selected MP4 exactly once");
  const [entry] = matching;
  if (entry.filename !== filename) throw new Error("Master receipt filename does not match the selected MP4");
  const expectedFrames = Number(entry.qa.nb_frames);
  if (!Number.isSafeInteger(expectedFrames) || expectedFrames < 1) throw new Error("Master receipt has invalid frame-count QA");
  return { ...entry, expectedFrames, audio: entry.qa.audio !== undefined,
    production: parsed.data.production, reviewSheets: parsed.data.reviewSheets, editorial: parsed.data.editorial };
}

const localMp4Input = (file: string) => ["-protocol_whitelist", "file", "-f", "mov", "-enable_drefs", "0", "-i", file];

function ffmpeg(args: string[], action: string) {
  const result = spawnSync("ffmpeg", ["-nostdin", "-v", "error", "-xerror", ...args], {
    encoding: "utf8", windowsHide: true, timeout: 600_000,
  });
  if (result.error || result.status !== 0 || result.stderr.trim()) throw new Error(action);
  return result.stdout.trim();
}

async function requireMp4Header(file: string) {
  const handle = await open(file, "r");
  try {
    const header = Buffer.alloc(8);
    if ((await handle.read(header, 0, header.length, 0)).bytesRead !== header.length || header.toString("ascii", 4) !== "ftyp") {
      throw new Error("Master input must use the factory MP4 container");
    }
  } finally {
    await handle.close();
  }
}

function audioPacketHash(input: string) {
  const hash = ffmpeg([...localMp4Input(input), "-map", "0:a:0", "-c:a", "copy", "-f", "hash", "-hash", "sha256", "-"],
    "Cannot verify copied AAC packets");
  if (!/^SHA256=[a-f0-9]{64}$/i.test(hash)) throw new Error("Cannot verify copied AAC packets");
  return hash;
}

const ignoreMissing = (error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; };
type DeliverySource = Awaited<ReturnType<typeof resolveDeliveryMaster>>;

async function inspectMaster(source: DeliverySource, inputReceipt: string, inputMaster: string, evidence?: string, release = false) {
  await snapshot(source.receipt, inputReceipt);
  const selected = await readMasterReceipt(inputReceipt, path.basename(source.master));
  await snapshot(source.master, inputMaster);
  if (await mediaSha256(inputMaster) !== selected.sha256) throw new Error("Master SHA-256 differs from the render receipt");
  await requireMp4Header(inputMaster);
  const { aspect, expectedFrames, audio } = selected;
  const inputQa = verifyFactoryMp4(inputMaster, aspect, fps, expectedFrames, audio, deliveryEncoder.h264Profile);
  if (!isDeepStrictEqual(inputQa, selected.qa)) throw new Error("Master QA differs from the render receipt");
  const production = evidence ? await verifyProductionEvidence({
    record: selected.production, reviewSheets: selected.reviewSheets, editorial: selected.editorial,
    batch: source.batch, evidenceFile: evidence, aspect, masterHash: selected.sha256,
    frames: expectedFrames, audio: inputQa.audio, release,
  }) : undefined;
  return { selected, production, inputQa };
}

export async function validateFactoryMaster(source: DeliverySource, evidence: string) {
  const scratch = await mkdtemp(path.join(await realpath(tmpdir()), "factory-verify-"));
  const inputReceipt = path.join(scratch, "master-report.json");
  const inputMaster = path.join(scratch, "master.mp4");
  try {
    return (await inspectMaster(source, inputReceipt, inputMaster, evidence)).production;
  } finally {
    for (const file of [inputMaster, inputReceipt]) await unlink(file).catch(ignoreMissing);
    await rmdir(scratch).catch(ignoreMissing);
  }
}

export async function deliverFactoryMaster(source: DeliverySource, output: string, releaseEvidence?: string) {
  if (isWithin(source.batch, output)) throw new Error("Delivery output must be outside the master batch");
  const scratch = await mkdtemp(path.join(output, ".delivery-"));
  const prepared = path.join(scratch, "prepared");
  const inputReceipt = path.join(scratch, "master-report.json");
  const inputMaster = path.join(scratch, "master.mp4");
  const video = path.join(prepared, releaseEvidence ? "master.mp4" : "review.mp4");
  const receipt = path.join(prepared, "delivery-report.json");
  try {
    const { selected, production, inputQa } = await inspectMaster(source, inputReceipt, inputMaster, releaseEvidence, Boolean(releaseEvidence));
    const { aspect, expectedFrames, audio } = selected;
    await mkdir(prepared);
    if (production === "final-audio") {
      await rename(inputMaster, video);
      await writeFile(receipt, JSON.stringify({
        schemaVersion: "1", purpose: "final-audio-local-handoff", technical: "pass",
        creativeApproval: "director-declared", audioRights: "operator-evidence-recorded",
        publicationClearance: "not-established", encoder: factoryEncoding("master", fps),
        output: { filename: "master.mp4", aspect, frames: expectedFrames, sha256: selected.sha256, qa: inputQa },
      }, null, 2) + "\n", { flag: "wx" });
      const destination = path.join(output, "final-" + randomUUID());
      await rename(prepared, destination);
      return destination;
    }
    ffmpeg([
      ...localMp4Input(inputMaster), "-map", "0:v:0", ...(audio ? ["-map", "0:a:0", "-c:a", "copy"] : ["-an"]),
      "-map_metadata", "-1", "-map_metadata:s", "-1", "-map_chapters", "-1",
      "-c:v", "libx264", "-threads:v", "2", "-profile:v", deliveryEncoder.h264Profile,
      "-pix_fmt", deliveryEncoder.pixelFormat, "-preset", deliveryEncoder.preset, "-crf", String(deliveryEncoder.crf),
      "-maxrate", String(deliveryEncoder.maxVideoBitrateBps), "-bufsize", String(deliveryEncoder.bufferBits),
      "-fps_mode", "passthrough", "-color_range", "tv", "-colorspace", "bt709",
      "-color_trc", "bt709", "-color_primaries", "bt709", "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709",
      "-movflags", "+faststart", video,
    ], "Cannot encode the local review derivative");
    verifyFactoryMp4(video, aspect, fps, expectedFrames, audio, deliveryEncoder.h264Profile);
    if (audio && audioPacketHash(inputMaster) !== audioPacketHash(video)) throw new Error("Review derivative changed the master AAC packets");
    await writeFile(receipt, JSON.stringify({
      schemaVersion: "1", purpose: "local-review", authorization: "operator-declared-render-rights",
      publicationClearance: "not-established", sourceMasterSha256: selected.sha256, encoder: deliveryEncoder,
      output: { filename: "review.mp4", aspect, frames: expectedFrames, sha256: await mediaSha256(video), audio: audio ? "aac-copy" : null },
    }, null, 2) + "\n", { flag: "wx" });
    const published = path.join(output, "review-" + randomUUID());
    await rename(prepared, published);
    return published;
  } finally {
    for (const file of [video, receipt, inputMaster, inputReceipt]) await unlink(file).catch(ignoreMissing);
    for (const directory of [prepared, scratch]) await rmdir(directory).catch(ignoreMissing);
  }
}
