import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBrief, starterBrief } from "../src/engine/client/brief";
import { planProject } from "../src/engine/client/plan";

test("strict briefs reject unsafe asset paths and unknown keys", () => {
  const brief = starterBrief("example");
  for (const asset of ["../outside.jpg", "C:/file.jpg", "other.jpg:stream", "folder/NUL.jpg"]) {
    assert.throws(() => parseBrief({ ...brief, hero: asset }), /hero/);
  }
  assert.throws(() => parseBrief({ ...brief, brand: { ...brief.brand, typo: 42 } }), /brand/);
  assert.throws(() => parseBrief({ ...brief, schemaVersion: "99" }), /schemaVersion/);
});

test("v1 migration is pure and yields the same normalized contract as v2", () => {
  const source = {
    schemaVersion: "1", id: "sample", appName: "Sample", appColor: "#8070ff",
    hook: "See Sample", cta: "Get Sample", screenshots: ["home.jpg", "actions.mov", "unused.jpg"],
    features: [{ title: "Actions", subtitle: "Use the action menu", screenshot: "actions.mov" }],
    aspectRatios: ["9:16", "16:9", "1:1"],
  };
  const before = JSON.stringify(source);
  const { brief, sourceVersion } = parseBrief(source);
  assert.equal(sourceVersion, "1");
  assert.equal(JSON.stringify(source), before);
  assert.equal(brief.schemaVersion, "2");
  assert.equal(brief.hero, "home.jpg");
  assert.equal(brief.features[0].asset, "actions.mov");
  assert.deepEqual(parseBrief(brief).brief, brief);
});

test("the planner binds only selected assets and honors exact frame duration and trims", () => {
  const { brief } = parseBrief(starterBrief("sample"));
  const files = [
    { path: brief.hero, sha256: "a", kind: "image" as const, durationSeconds: null },
    { path: brief.features[0].asset, sha256: "b", kind: "video" as const, durationSeconds: 10 },
    { path: "unused.jpg", sha256: "c", kind: "image" as const, durationSeconds: null },
  ];
  const plan = planProject(brief, files);
  assert.deepEqual(plan.shots.map((shot) => shot.asset?.path ?? null), [files[0].path, files[1].path, null]);
  assert.equal(plan.totalFrames, 900);
  assert.equal(plan.shots.reduce((sum, shot) => sum + shot.durationFrames, 0), 900);
  const literal = planProject({ ...brief, hook: "@Example" }, files);
  assert.equal(literal.filmSpec.timeline[0].overlay[0].kind, "text");
  assert.deepEqual(literal.filmSpec.timeline[0].overlay[0], { ...plan.filmSpec.timeline[0].overlay[0], content: "@Example" });
  assert.throws(() => planProject(brief, files.slice(0, 1)), /features\.0\.asset/);
  const short = { ...brief, features: [{ ...brief.features[0], trim: { startSeconds: 9, endSeconds: 11 } }] };
  assert.throws(() => planProject(short, files), /features\.0\.trim/);
});
