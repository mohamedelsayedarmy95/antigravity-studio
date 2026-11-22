import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { factoryEncoding, verifyFactoryMp4 } from "../scripts/lib/client-render";

const root = path.resolve(import.meta.dirname, "..");

async function scratch(t: TestContext) {
  const temp = await realpath(tmpdir());
  const folder = await mkdtemp(path.join(temp, "factory-delivery-"));
  assert.equal(path.dirname(folder), temp);
  t.after(() => rm(folder, { recursive: true, force: true }));
  return folder;
}

function factory(...args: string[]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/factory.ts", ...args], {
    cwd: root, encoding: "utf8", timeout: 60000, windowsHide: true,
  });
  if (result.error) throw result.error;
  return { code: result.status, output: result.stdout + result.stderr };
}

const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");

function audioPackets(file: string) {
  return execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-i", file, "-map", "0:a:0", "-c:a", "copy",
    "-f", "streamhash", "-hash", "sha256", "-"], { encoding: "utf8" }).trim();
}

test("local delivery tests receipt authority and creates a frame-exact derivative without changing the master", async (t) => {
  const temp = await scratch(t);
  const batch = path.join(temp, "master-batch");
  const master = path.join(batch, "synthetic-1x1.mp4");
  const report = path.join(batch, "render-report.json");
  const out = path.join(temp, "review");
  await mkdir(batch);
  await mkdir(out);
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1080x1080:rate=30:duration=0.8",
    "-f", "lavfi", "-i", "sine=frequency=350:sample_rate=48000:duration=0.8",
    "-c:v", "libx264", "-threads:v", "2", "-preset", "veryfast", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709", "-c:a", "aac", "-ac", "2",
    "-metadata", "comment=private signed synthetic notes", master]);
  const masterHash = sha(await readFile(master));
  const qa = verifyFactoryMp4(master, "1x1", 30, 24, true, "high");
  const receipt = {
    schemaVersion: "1", profile: "master", frame: null, encoder: factoryEncoding("master", 30),
    rightsDeclaration: { origin: "synthetic", approved: true, license: "private signed synthetic notes", privacy: "private operator notes" },
    files: [{ filename: path.basename(master), sha256: masterHash, aspect: "1x1", qa }],
    editorial: { audio: { file: "private-score.wav" } },
  };
  const deliver = (file = master, output = out) => factory("deliver", "--master", file, "--out", output);

  await writeFile(report, JSON.stringify({ ...receipt, rightsDeclaration: { ...receipt.rightsDeclaration, approved: false } }));
  const denied = deliver();
  assert.equal(denied.code, 1, denied.output);
  assert.match(denied.output, /approval|rights/i);
  assert.deepEqual(await readdir(out), []);

  await writeFile(report, JSON.stringify({ ...receipt, files: [{ ...receipt.files[0], sha256: "0".repeat(64) }] }));
  const tampered = deliver();
  assert.equal(tampered.code, 1, tampered.output);
  assert.match(tampered.output, /SHA-256|hash/i);
  assert.deepEqual(await readdir(out), []);

  await writeFile(report, JSON.stringify({ ...receipt, files: [{ ...receipt.files[0], qa: { ...qa, width: 1920 } }] }));
  const badQa = deliver();
  assert.equal(badQa.code, 1, badQa.output);
  assert.match(badQa.output, /QA|conformance/i);
  assert.deepEqual(await readdir(out), []);

  const reportText = JSON.stringify(receipt);
  await writeFile(report, reportText);
  const inside = deliver(master, path.join(batch, "must-not-create"));
  assert.equal(inside.code, 1, inside.output);
  assert.match(inside.output, /outside|inside/i);
  await assert.rejects(lstat(path.join(batch, "must-not-create")), { code: "ENOENT" });
  const alias = path.join(temp, "alias");
  await symlink(batch, alias, process.platform === "win32" ? "junction" : "dir");
  const linked = deliver(path.join(alias, path.basename(master)));
  assert.equal(linked.code, 1, linked.output);
  assert.match(linked.output, /link|junction/i);
  const linkedOut = path.join(temp, "alias-out");
  await symlink(out, linkedOut, process.platform === "win32" ? "junction" : "dir");
  const aliasedDestination = deliver(master, linkedOut);
  assert.equal(aliasedDestination.code, 1, aliasedDestination.output);
  assert.match(aliasedDestination.output, /link|junction/i);
  assert.deepEqual(await readdir(out), []);

  const result = deliver();
  assert.equal(result.code, 0, result.output);
  const [published, ...extra] = await readdir(out);
  assert.ok(published);
  assert.deepEqual(extra, []);
  const delivery = path.join(out, published);
  assert.deepEqual((await readdir(delivery)).sort(), ["delivery-report.json", "review.mp4"]);
  const derivative = path.join(delivery, "review.mp4");
  assert.equal(verifyFactoryMp4(derivative, "1x1", 30, 24, true, "high").constantFrameRate, true);
  assert.equal(audioPackets(derivative), audioPackets(master));
  const tags = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format_tags:stream_tags", "-of", "json", derivative], { encoding: "utf8" });
  assert.doesNotMatch(tags, /private signed synthetic notes/);
  const review = await readFile(path.join(delivery, "delivery-report.json"), "utf8");
  assert.match(review, /local-review/);
  assert.match(review, /not-established/);
  assert.match(review, new RegExp(masterHash));
  assert.doesNotMatch(review, /private|rightsDeclaration|privacy|license|synthetic-1x1/);
  assert.equal(sha(await readFile(master)), masterHash);
  assert.equal(await readFile(report, "utf8"), reportText);
});

test("implicit brief rejects a link and an explicit external brief stays supported", async (t) => {
  const temp = await scratch(t);
  const project = path.join(temp, "implicit-test");
  const initialized = factory("init", "--parent", temp, "--name", "implicit-test");
  assert.equal(initialized.code, 0, initialized.output);
  const brief = path.join(project, "brief.json");
  const external = path.join(temp, "external-brief.json");
  await writeFile(external, await readFile(brief));
  await unlink(brief);
  try {
    await symlink(external, brief, "file");
  } catch (error) {
    if (process.platform !== "win32" || !["EACCES", "EPERM"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
    const directoryAliasTarget = path.join(temp, "brief-directory-target");
    await mkdir(directoryAliasTarget);
    await symlink(directoryAliasTarget, brief, "junction");
  }
  const out = path.join(temp, "reports");
  const implicit = factory("scan", "--project", project, "--out", out);
  assert.equal(implicit.code, 1, implicit.output);
  assert.match(implicit.output, /brief.*(?:link|regular file)/i);
  await assert.rejects(lstat(out), { code: "ENOENT" });
  const explicit = factory("scan", "--project", project, "--brief", external, "--out", out);
  assert.equal(explicit.code, 1, explicit.output);
  assert.match(explicit.output, /no-assets/);
  const [manifest] = await readdir(out);
  assert.match(manifest, /^manifest-/);
});

test("validation requires the source file for each declared editorial audio cue", async (t) => {
  const temp = await scratch(t);
  const project = path.join(temp, "cue-test");
  const initialized = factory("init", "--parent", temp, "--name", "cue-test");
  assert.equal(initialized.code, 0, initialized.output);
  const brief = path.join(project, "brief.json");
  const image = path.join(project, "assets", "screenshots", "home.png");
  const bed = path.join(project, "assets", "audio", "score.wav");
  const cue = path.join(project, "assets", "audio", "tap.wav");
  const out = path.join(temp, "reports");
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "color=blue:size=64x96", "-frames:v", "1", image]);
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=350:duration=1", bed]);
  await copyFile(image, path.join(project, "assets", "logo", "mark.png"));
  await writeFile(brief, JSON.stringify({
    schemaVersion: "2", id: "cue-test", brand: { name: "Cue test", color: "#244bca" },
    hero: "home.png", hook: "See the next step", cta: "Open the plan", durationSeconds: 14, fps: 30,
    features: [
      { title: "Check route", body: "See upcoming stops.", asset: "home.png" },
      { title: "Review the map", body: "See the route in context.", asset: "home.png" },
    ],
    editorial: {
      template: "studio-cut-v1", productLabel: "Field planning", logo: "mark.png",
      proposition: { title: "See your plan", body: "Find the route." },
      audio: { file: "score.wav", license: "Synthetic", cues: [{ file: "tap.wav", license: "Synthetic", atShot: "feature-1" }] },
    },
  }));
  const validate = () => factory("validate", "--project", project, "--out", out);
  const missing = validate();
  assert.equal(missing.code, 1, missing.output);
  assert.match(missing.output, /tap\.wav/);
  assert.ok((await readdir(out)).every((entry) => !entry.startsWith("plan-")));
  await copyFile(bed, cue);
  const present = validate();
  assert.equal(present.code, 0, present.output);
  assert.match(present.output, /Validated .* shots and 420 frames/);
});
