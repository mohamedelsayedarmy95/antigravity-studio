import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { FILMS } from "../src/films";
import { factoryEncoding, verifyFactoryMp4 } from "../scripts/lib/client-render";
import { makeMasterReviewSheet } from "../scripts/lib/master-review";
import { muxEditorialAudio, prepareEditorialAudio } from "../scripts/lib/editorial-audio";

const root = path.resolve(import.meta.dirname, "..");
const rights = { origin: "synthetic", approved: true, license: "Local test generator", privacy: "Synthetic only" };
const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const ffmpeg = (...args: string[]) => execFileSync("ffmpeg", ["-nostdin", "-v", "error", ...args]);

async function folder(t: TestContext) {
  const temp = await mkdtemp(path.join(await realpath(tmpdir()), "vfs-governance-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  return temp;
}

function cli(script: string, args: string[], expected: number, diagnostic: RegExp) {
  const result = spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
    cwd: root, encoding: "utf8", timeout: 90000, windowsHide: true,
  });
  if (result.error) throw result.error;
  const output = result.stdout + result.stderr;
  assert.equal(result.status, expected, output);
  assert.match(output, diagnostic);
}

const validate = (args: string[], expected: number, diagnostic: RegExp) =>
  cli("scripts/validate-production.ts", args, expected, diagnostic);
const factory = (...args: Parameters<typeof validate>) => cli("scripts/factory.ts", ...args);

test("production CLI compiles current FilmSpec and rejects unsupported versions, scenes, and timeline output", async (t) => {
  const file = path.join(await folder(t), "film.json");
  const spec = FILMS[0];
  const run = async (input: unknown, code: number, diagnostic: RegExp) => {
    await writeFile(file, JSON.stringify(input));
    validate(["--film", file], code, diagnostic);
  };
  await run(spec, 0, /FilmSpec.*frames/);
  await run({ ...spec, schemaVersion: "2" }, 1, /schemaVersion/);
  await run({ ...spec, timeline: [{ ...spec.timeline[0], camera: { rig: "absent" } }] }, 1, /timeline\.0\.camera/);
  await run({ ...spec, timeline: [{ ...spec.timeline[0], world: {
    nodes: [{ id: "bad-morph", type: "morph", shapes: ["sphere", "torus"], keys: [0], material: "ceramic" }],
  } }] }, 1, /morph.*shapes.*keys/i);
  await run({ ...spec, timeline: [spec.timeline[0], spec.timeline[0]] }, 1, /duplicate scene/);
  await run({ ...spec, output: { ...spec.output, aspects: ["1x1", "1x1"] } }, 1, /duplicate|distinct/);
  const logo = (src: string) => ({ ...spec, timeline: [{ ...spec.timeline[0], world: {
    nodes: [{ id: "test-logo", type: "logo", material: "ceramic", src }],
  } }] });
  await run(logo("../logo.svg"), 1, /portable.*SVG/i);
  await run(logo("brand/missing.svg"), 1, /missing.*SVG|SVG.*missing/i);
});

test("governed brief preflight reuses Factory and real render rejects a missing final audio program", async (t) => {
  const temp = await folder(t);
  const project = path.join(temp, "client");
  const briefFile = path.join(project, "brief.json");
  const output = path.join(temp, "reports");
  const projectArgs = ["--project", project, "--out", output];
  factory(["init", "--name", "client", "--parent", temp], 0, /Project created/);
  const brief = JSON.parse(await readFile(briefFile, "utf8"));
  const selected = "sample.png";
  ffmpeg("-f", "lavfi", "-i", "color=blue:size=64x96", "-frames:v", "1", "-threads", "1",
    path.join(project, "assets", "screenshots", selected));
  const configured = { ...brief, fps: 30, hero: selected, features: brief.features.map((feature: object) => ({ ...feature, asset: selected })) };
  const save = (input: unknown) => writeFile(briefFile, JSON.stringify(input));
  await save(configured);
  factory(["validate", ...projectArgs], 0, /Validated/);
  validate([...projectArgs], 1, /renderRights declaration/);
  await save({ ...configured, renderRights: rights, hero: "../sample.png" });
  validate([...projectArgs], 1, /hero/);
  await save({ ...configured, renderRights: rights, hero: "missing.png" });
  validate([...projectArgs], 1, /missing or failed media analysis/);
  await save({ ...configured, renderRights: rights, fps: 60 });
  validate([...projectArgs, "--production", "silent-picture"], 1, /30 fps/);
  await save({ ...configured, renderRights: rights });
  validate([...projectArgs, "--production", "silent-picture"], 0, /silent-picture.*preflight/i);
  factory(["render", ...projectArgs, "--profile", "preview", "--production", "silent-picture"], 1, /requires --profile master/);
  factory(["render", ...projectArgs, "--production", "silent-picture", "--frame", "1"], 1, /full timeline only/);
  factory(["render", ...projectArgs, "--production", "final-audio"], 1, /requires.*audio/i);
});

async function masterFixture(t: TestContext, audio: boolean) {
  const temp = await folder(t);
  const batch = path.join(temp, "batch");
  await mkdir(batch);
  const master = path.join(batch, "film-1x1.mp4");
  const picture = audio ? path.join(temp, "picture.mp4") : master;
  ffmpeg("-f", "lavfi", "-i", "testsrc2=size=1080x1080:rate=30:duration=0.8",
    "-c:v", "libx264", "-threads:v", "2", "-preset", "veryfast", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709", picture);
  const sound = { file: "bed.wav", license: "Synthetic", cues: [{ file: "cue.wav", license: "Synthetic" }] };
  let editorial;
  if (audio) {
    const project = path.join(temp, "synthetic");
    const audioRoot = path.join(project, "assets", "audio");
    await mkdir(audioRoot, { recursive: true });
    ffmpeg("-f", "lavfi", "-i", "sine=frequency=350:sample_rate=48000:duration=1", path.join(audioRoot, sound.file));
    ffmpeg("-f", "lavfi", "-i", "sine=frequency=600:sample_rate=48000:duration=0.08", path.join(audioRoot, sound.cues[0].file));
    const bed = await prepareEditorialAudio({ project, scratch: temp, file: sound.file, gainDb: 0, totalFrames: 24, fps: 30,
      effects: [{ file: sound.cues[0].file, startFrame: 10, gainDb: -12 }] });
    await muxEditorialAudio({ video: picture, audio: bed.file, output: master });
    editorial = { audio: sound, audioSha256: bed.sourceSha256, soundCueSources: bed.effects };
  }
  const sha256 = sha(await readFile(master));
  const qa = verifyFactoryMp4(master, "1x1", 30, 24, audio, "high");
  const sheet = "review-1x1.png";
  makeMasterReviewSheet(master, path.join(batch, sheet), "1x1", [0, 10, 20]);
  const samples = await Promise.all(["a", "b"].map(async (take) => {
    const filename = "determinism-1x1-" + take + ".png";
    ffmpeg("-f", "lavfi", "-i", "color=blue:size=1080x1080", "-frames:v", "1", "-threads", "1", path.join(batch, filename));
    return { filename, sha256: sha(await readFile(path.join(batch, filename))) };
  }));
  const evidenceFile = path.join(temp, "approval.json");
  const reportFile = path.join(batch, "render-report.json");
  const receipt = {
    schemaVersion: "1", profile: "master", frame: null, encoder: factoryEncoding("master", 30), rightsDeclaration: rights,
    files: [{ filename: path.basename(master), sha256, aspect: "1x1", qa }],
    reviewSheets: [{ aspect: "1x1", filename: sheet, frames: [0, 10, 20], sha256: sha(await readFile(path.join(batch, sheet))) }],
    production: { profile: audio ? "final-audio" : "silent-picture", expectedFrames: 24, samples: [{ aspect: "1x1", frame: 10, files: samples }] },
    ...(editorial ? { editorial } : {}),
  };
  const visual = { schemaVersion: "1", masterSha256: sha256, visualReview: { reviewer: "Synthetic test reviewer", notes: "Fixture reviewed" } };
  await writeFile(reportFile, JSON.stringify(receipt));
  return { temp, batch, master, evidenceFile, reportFile, receipt, visual };
}

test("silent picture lock verifies media and PNG evidence with creative approval pending", async (t) => {
  const { master, batch, evidenceFile, reportFile, visual, receipt } = await masterFixture(t, false);
  const args = ["--master", master, "--evidence", evidenceFile];
  await writeFile(evidenceFile, JSON.stringify(visual));
  validate(args, 0, /silent-picture.*creative approval pending/i);
  await writeFile(evidenceFile, JSON.stringify({ ...visual, masterSha256: "0".repeat(64) }));
  validate(args, 1, /identifies a different master/);
  await writeFile(evidenceFile, JSON.stringify(visual));
  const file = receipt.production.samples[0].files[1];
  await writeFile(path.join(batch, file.filename), "corrupted PNG");
  file.sha256 = sha(Buffer.from("corrupted PNG"));
  await writeFile(reportFile, JSON.stringify(receipt));
  validate(args, 1, /PNG pixel/i);
});

test("final handoff requires matching human approval and measured audio limits, and rejects bad final media", async (t) => {
  const { master, temp, evidenceFile, reportFile, receipt, visual } = await masterFixture(t, true);
  const args = ["deliver", "--master", master, "--out", path.join(temp, "out"), "--release", "--evidence", evidenceFile];
  const approval = { ...visual, creativeApproval: { director: "Synthetic test director", decision: "approved" },
    audioRightsReference: "Synthetic audio provenance fixture", synchronizationReview: "Cue timing reviewed",
    audioLimits: { minLufs: -50, maxLufs: -12, maxTruePeakDbtp: -1 } };
  await writeFile(evidenceFile, JSON.stringify(visual));
  factory(args, 1, /creativeApproval|audioRightsReference/);
  await writeFile(evidenceFile, JSON.stringify({ ...approval, audioLimits: { ...approval.audioLimits, minLufs: -12, maxLufs: -11 } }));
  factory(args, 1, /loudness/i);
  await writeFile(evidenceFile, JSON.stringify({ ...approval, audioLimits: { ...approval.audioLimits, maxTruePeakDbtp: -70 } }));
  factory(args, 1, /true peak/i);
  await writeFile(evidenceFile, JSON.stringify(approval));
  await writeFile(reportFile, JSON.stringify({ ...receipt, production: { ...receipt.production, expectedFrames: 23 } }));
  factory(args, 1, /frame.count/i);
  const originalMaster = await readFile(master);
  const invalidMp4 = Buffer.concat([Buffer.from([0, 0, 0, 8]), Buffer.from("ftyp")]);
  await writeFile(master, invalidMp4);
  await writeFile(reportFile, JSON.stringify({ ...receipt, files: [{ ...receipt.files[0], sha256: sha(invalidMp4) }] }));
  factory(args, 1, /Cannot inspect generated MP4/i);
  assert.deepEqual(await readdir(path.join(temp, "out")), []);
  await writeFile(master, originalMaster);
  await writeFile(reportFile, JSON.stringify(receipt));
  factory(args, 0, /final-audio.*local handoff/i);
  const [delivery] = await readdir(path.join(temp, "out"));
  assert.equal(sha(await readFile(path.join(temp, "out", delivery, "master.mp4"))), visual.masterSha256);
});
