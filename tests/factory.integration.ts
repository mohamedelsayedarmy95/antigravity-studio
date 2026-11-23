import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function factory(...args: string[]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/factory.ts", ...args], {
    cwd: root, encoding: "utf8", timeout: 30000, windowsHide: true,
  });
  if (result.error) throw result.error;
  return { code: result.status, output: result.stdout + result.stderr };
}

test("factory CLI scans local stills and videos, publishes deterministic reports and fails usefully", async (t) => {
  const scratch = await mkdtemp(path.join(tmpdir(), "factory integration "));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const parent = path.join(scratch, "Existing Projects");
  const project = path.join(parent, "trial");
  const screens = path.join(project, "assets", "screenshots");
  const out = path.join(scratch, "output");
  const open = factory("init", "--name", "trial", "--template", "mobile-app", "--parent", parent);
  assert.equal(open.code, 0, open.output);
  assert.match(open.output, /Project created/);
  const collision = factory("init", "--name", "trial", "--parent", parent);
  assert.equal(collision.code, 1, collision.output);
  assert.match(collision.output, /already exists/);

  const home = path.join(screens, "home.jpg");
  const clip = path.join(screens, "feature.mp4");
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "color=blue:size=96x160:duration=1",
    "-frames:v", "1", home]);
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=96x160:rate=30:duration=1",
    "-c:v", "mpeg4", "-pix_fmt", "yuv420p", clip]);
  await copyFile(home, path.join(screens, "duplicate.jpg"));
  const lastWeek = new Date(Date.now() - 7 * 86400000);
  await utimes(home, lastWeek, lastWeek);
  const original = await lstat(home);

  const scanned = factory("scan", "--project", project, "--out", out);
  assert.equal(scanned.code, 0, scanned.output);
  const validated = factory("validate", "--project", project, "--out", out);
  assert.equal(validated.code, 0, validated.output);
  assert.match(validated.output, /Validated 3 shots and 900 frames/);
  const names = await readdir(out);
  assert.equal(names.length, 2, "scan and validate reuse the exact same manifest");
  const manifest = JSON.parse(await readFile(path.join(out, names.find((name) => name.startsWith("manifest-"))!), "utf8"));
  assert.deepEqual(manifest.assets.map((asset: { path: string }) => asset.path), ["duplicate.jpg", "feature.mp4", "home.jpg"]);
  assert.equal(manifest.assets[2].duplicateOf, "duplicate.jpg");
  assert.equal(manifest.assets[1].durationSeconds, 1);
  assert.equal(manifest.assets[1].fps, 30);
  assert.match(manifest.assets[1].container, /mp4/);
  assert.ok(manifest.assets[1].codecProfile);
  assert.equal(manifest.analysis.privacy, "unverified");
  assert.equal(manifest.analysis.licensing, "unverified");
  const originalAfter = await lstat(home);
  assert.equal(originalAfter.mtimeMs, original.mtimeMs);
  assert.equal(originalAfter.birthtimeMs, original.birthtimeMs);
  if (process.platform === "win32") assert.equal(originalAfter.atimeMs, original.atimeMs);

  const inside = factory("scan", "--project", project, "--out", path.join(screens, "inside"));
  assert.equal(inside.code, 1, inside.output);
  assert.match(inside.output, /outside the input project/);
  await assert.rejects(lstat(path.join(screens, "inside")), { code: "ENOENT" });
  const traversal = factory("scan", "--project", project, "--assets-dir", "../Other", "--out", out);
  assert.equal(traversal.code, 1, traversal.output);
  assert.match(traversal.output, /project-relative/);

  await mkdir(path.join(screens, "broken"));
  await writeFile(path.join(screens, "broken", "fake.jpg"), "a corrupt test fixture");
  const badScan = factory("scan", "--project", project, "--out", out);
  assert.equal(badScan.code, 1, badScan.output);
  assert.match(badScan.output, /invalid-media broken\/fake.jpg/);
  const selectedOnly = factory("validate", "--project", project, "--out", out);
  assert.equal(selectedOnly.code, 0, selectedOnly.output);
  await unlink(clip);
  const missing = factory("validate", "--project", project, "--out", out);
  assert.equal(missing.code, 1, missing.output);
  assert.match(missing.output, /features\.0\.asset.*feature\.mp4/);
});

test("a resolved report path inside the project gets the actionable refusal", async (t) => {
  const scratch = await mkdtemp(path.join(tmpdir(), "factory report alias "));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const project = path.join(scratch, "project");
  const alias = path.join(scratch, "alias");
  await mkdir(project);
  await symlink(project, alias, process.platform === "win32" ? "junction" : "dir");
  const result = factory("scan", "--project", project, "--out", path.join(alias, "reports"));
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /outside the input project.*resolves inside/);
  await assert.rejects(lstat(path.join(project, "reports")), { code: "ENOENT" });
});

test("Windows snapshots report one unreadable source and continue with later inputs", { skip: process.platform !== "win32" }, async (t) => {
  const scratch = await mkdtemp(path.join(tmpdir(), "factory snapshot "));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const input = path.join(scratch, "válid test.jpg");
  const output = path.join(scratch, "copy");
  await writeFile(input, "snapshot test bytes");
  const old = new Date(Date.now() - 7 * 86400000);
  await utimes(input, old, old);
  const original = await lstat(input);
  const result = spawnSync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-File", path.join(root, "scripts/lib/snapshot-media.ps1"),
  ], {
    input: JSON.stringify([
      { source: path.join(scratch, "missing"), target: path.join(scratch, "bad copy") },
      { source: input, target: output },
    ]),
    encoding: "utf8", timeout: 10000, windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  const [failure] = JSON.parse(result.stdout);
  assert.equal(failure.index, 0);
  assert.match(failure.message, /without changing access time/);
  assert.equal(await readFile(output, "utf8"), "snapshot test bytes");
  assert.equal((await lstat(input)).atimeMs, original.atimeMs);
});
