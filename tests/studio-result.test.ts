import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBrief } from "../src/engine/client/brief";
import { planProject } from "../src/engine/client/plan";
import { compileFilm } from "../src/engine/compile/compile";

const briefInput = {
  schemaVersion: "2", id: "field-demo", brand: { name: "Field Demo", color: "#244bca" },
  hook: "Plan the visit", hero: "map.png", cta: "Open the plan", fps: 30, durationSeconds: 14,
  features: [
    { title: "Find the stop", body: "Read the route", asset: "map.png" },
    { title: "Assign the stop", body: "Choose the owner", asset: "recording.mp4", trim: { startSeconds: 0.5, endSeconds: 4 },
      result: { sourceFrame: 94, title: "Assignment saved", body: "The owner is visible in the schedule" } },
  ],
  editorial: { template: "studio-cut-v2", motion: "expressive", productLabel: "Field planning",
    proposition: { title: "Work in view", body: "Share one schedule" }, logo: "mark.png",
    audio: { file: "score.wav", license: "Synthetic" } },
};
const assets = [
  { path: "map.png", sha256: "map", kind: "image" as const, durationSeconds: null },
  { path: "recording.mp4", sha256: "clip", kind: "video" as const, durationSeconds: 5 },
];

test("an authored result replaces copy on its actual trimmed source frame and keeps the same recording shot", () => {
  const plan = planProject(parseBrief(briefInput).brief, assets);
  assert.equal(plan.totalFrames, 420);
  const proof = plan.shots.find((shot) => shot.id === "feature-2")!;
  assert.deepEqual(proof.result, { ...briefInput.features[1].result, localFrame: 79, movieFrame: 304 });
  const copy = compileFilm(plan.filmSpec).overlays.filter((o) => o.sceneId === "feature-2");
  assert.equal(Math.round(copy.find((o) => o.element.id === "headline")!.endSec * 30), 304);
  const result = copy.find((o) => o.element.id === "result-headline")!;
  assert.equal(Math.round(result.inSec * 30), 304);
  assert.ok(result.element.kind === "text" && result.element.reveal === "hold");
});

test("result annotations reject stills, out-of-trim frames, and other editorial modes", () => {
  const options = parseBrief(briefInput).brief;
  assert.throws(() => planProject({ ...options, features: [options.features[0], {
    ...options.features[1], asset: "map.png", trim: undefined,
  }] }, assets), /requires a recording/);
  assert.throws(() => planProject({ ...options, features: [options.features[0], {
    ...options.features[1], result: { sourceFrame: 130, title: "Too late", body: "Outside the trim" },
  }] }, assets), /result.*trim/i);
  assert.throws(() => parseBrief({ ...briefInput, editorial: { ...briefInput.editorial, motion: "measured" } }), /results require/);
});

test("sound cue offsets stay in their declared shot and resolve once to a movie frame", () => {
  const create = (offsetFrames: number) => parseBrief({ ...briefInput, editorial: { ...briefInput.editorial,
    audio: { ...briefInput.editorial.audio, cues: [{ atShot: "hook", file: "click.wav", license: "Synthetic", offsetFrames }] },
  } }).brief;
  assert.equal(planProject(create(59), assets).editorial?.resolvedSoundCues?.[0].startFrame, 59);
  assert.throws(() => planProject(create(60), assets), /sound cue.*outside/i);
});
