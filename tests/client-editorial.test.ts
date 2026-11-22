import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { parseBrief } from "../src/engine/client/brief";
import { editorialLayout } from "../src/engine/client/editorial";
import { planProject } from "../src/engine/client/plan";
import { compileFilm } from "../src/engine/compile/compile";
import { studioScene, stageStudioCut } from "../src/engine/client/studio-cut";
import { editorialContinuityOpacity } from "../src/engine/client/shot-continuity";
import { ASPECTS, type AspectId } from "../src/stage3d/schema";
import type { FilmSpecInput } from "../src/engine/schema/film";

const draft = {
  schemaVersion: "2", id: "demo", brand: { name: "Demo", color: "#244bca" },
  hero: "home.png", hook: "An immediate reason to look", cta: "Get started", durationSeconds: 14, fps: 30,
  features: [
    { title: "Place", body: "Find the next visit.", asset: "home.png" },
    { title: "Progress", body: "See the plan change.", asset: "progress.mp4", trim: { startSeconds: 0, endSeconds: 3.5 } },
  ],
  editorial: {
    template: "studio-cut-v1", proposition: { title: "Make the plan visible", body: "All in one place." },
    productLabel: "Field planning", logo: "mark.png", audio: { file: "score.wav", license: "Original synthetic score" },
    heroFraming: { "9:16": { fit: "cover", focal: { x: 0.6, y: 0.5 } } },
  },
};
const catalog = [
  { path: "home.png", kind: "image" as const, sha256: "still", durationSeconds: null },
  { path: "progress.mp4", kind: "video" as const, sha256: "video", durationSeconds: 3.5 },
];

test("the opt-in template resolves the authored beats, cues, media and aspect framing through FilmSpec", () => {
  const plan = planProject(parseBrief(draft).brief, catalog);
  assert.equal(plan.totalFrames, 420);
  assert.equal(plan.filmSpec.look, "studio");
  assert.deepEqual(plan.shots.map(({ id, startFrame, durationFrames }) => [id, startFrame, durationFrames]), [
    ["hook", 0, 60], ["proposition", 60, 75], ["feature-1", 135, 90], ["feature-2", 225, 105], ["cta", 330, 90],
  ]);
  assert.deepEqual(plan.editorial?.cues.map(({ frame }) => frame), [0, 60, 135, 225, 330]);
  assert.equal(plan.shots[0].asset?.aspectPresentations?.["9x16"]?.fit, "cover");
  assert.equal(plan.shots[3].asset?.sourceRange?.endSeconds, 3.5);
});

test("editorial briefs reject path traversal, unrecognized options and incomplete feature sets", () => {
  assert.throws(() => parseBrief({ ...draft, editorial: { ...draft.editorial, logo: "../mark.png" } }), /editorial\.logo/);
  assert.throws(() => parseBrief({ ...draft, editorial: { ...draft.editorial, audio: { file: "score.wav" } } }), /editorial\.audio\.license/);
  assert.throws(() => parseBrief({ ...draft, features: draft.features.slice(0, 1) }), /two to four/);
});

test("each aspect stages copy, screen and mark in distinct, platform-safe regions", () => {
  const positions = [];
  for (const [aspect, frame] of Object.entries(ASPECTS)) {
    const key = aspect as AspectId;
    const hook = editorialLayout(key, frame, "hook");
    const proposition = editorialLayout(key, frame, "proposition");
    const ending = editorialLayout(key, frame, "cta");
    positions.push([hook.media?.left, hook.media?.top]);
    assert.notDeepEqual(hook.media, proposition.media);
    for (const layout of [hook, proposition, ending]) {
      for (const box of [layout.eyebrow, layout.headline, layout.body, layout.media, layout.logo]) {
        if (!box) continue;
        assert.ok(box.left >= layout.safe.left && box.left + box.width <= layout.safe.left + layout.safe.width + 1e-9);
        assert.ok(box.top >= layout.safe.top && box.top + box.height <= layout.safe.top + layout.safe.height + 1e-9);
      }
      if (layout.media) {
        const a = layout.media;
        const b = layout.headline;
        assert.ok(a.left >= b.left + b.width || a.left + a.width <= b.left || a.top >= b.top + b.height || a.top + a.height <= b.top);
      }
    }
  }
  assert.equal(new Set(positions.map((position) => JSON.stringify(position))).size, 3);
});


// Creative Fusion: concise contractual tests; this is NOT a substitute for final render QC.
const beatsForCreativeTest = [
  { id: "hook", title: "An immediate reason to look", body: "Demo", label: "Field planning" },
  { id: "proposition", title: "Make the plan visible", body: "All in one place.", label: "" },
  { id: "feature-1", title: "Place", body: "Find the next visit.", label: "One" },
  { id: "feature-2", title: "Progress", body: "See the plan change.", label: "" },
  { id: "cta", title: "Get started", body: "Every plan moves forward.", label: "Demo" },
];
const creativeFingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("legacy Studio Cut payload fingerprints remain unchanged", () => {
  const expected = [
    ["studio-cut-v1", "measured", "6ee63fa263a1ca7ec347d63b8778f2e2d804587363719fc21a011a100a305e48"],
    ["studio-cut-v1", "expressive", "ed97ddf5ed4850d8084ff02ca4464d8f37257e0640c21c58b7157c9068b3b9a5"],
    ["studio-cut-v2", "measured", "c27cf5e298e9b4748ccea78c3603fefddc618dd27935238cb684dd417dd7a493"],
  ] as const;
  for (const [template, motion, digest] of expected) {
    const payload = beatsForCreativeTest.map((beat) => studioScene(beat, "75f", motion, template, "Start the change"));
    assert.equal(creativeFingerprint(payload), digest, `${template}/${motion}`);
  }
});

test("creative fusion is deterministic, shot-distinct and opt-in", () => {
  const ids = ["hook", "proposition", "feature-1", "feature-2", "feature-3", "feature-4", "cta"];
  const directed = ids.map((id) => studioScene(
    { id, title: `Title ${id}`, body: `Body ${id}`, label: "Brand" },
    "75f", "expressive", "studio-cut-v2", "Close with confidence"));
  const measured = ids.map((id) => studioScene(
    { id, title: `Title ${id}`, body: `Body ${id}`, label: "Brand" },
    "75f", "measured", "studio-cut-v2", "Close with confidence"));
  assert.deepEqual(directed, ids.map((id) => studioScene(
    { id, title: `Title ${id}`, body: `Body ${id}`, label: "Brand" },
    "75f", "expressive", "studio-cut-v2", "Close with confidence")));
  const silhouettes = directed.map((scene) => JSON.stringify(scene.world?.nodes?.map((node) =>
    node.type === "primitive" ? [node.dimensions, node.rotation] : [node.type])));
  assert.equal(new Set(silhouettes).size, ids.length);
  assert.ok(new Set(directed.map((scene) => scene.camera?.moves?.[0]?.rig)).size >= 4);
  for (let i = 0; i < directed.length; i++) {
    const scene = directed[i];
    assert.equal(scene.id, measured[i].id);
    assert.equal(scene.length, measured[i].length);
    assert.equal(measured[i].transitionIn?.type, "cut");
    const expected = { proposition: "lightSweep", "feature-2": "dissolve", "feature-4": "dissolve", cta: "dissolve" } as const;
    assert.equal(scene.transitionIn?.type, expected[scene.id as keyof typeof expected] ?? "cut");
    const copy = (overlay: typeof scene.overlay) => overlay?.map((item) =>
      [item.id, item.kind === "text" ? item.content : null]);
    assert.deepEqual(copy(scene.overlay), copy(measured[i].overlay));
    const distance = scene.camera?.distance;
    const lens = scene.camera?.lens;
    if (typeof distance !== "number" || typeof lens !== "number") {
      throw new Error("Expressive direction must author numeric distance and lens");
    }
    assert.ok(Math.abs(distance / lens - 5.5 / 45) < 0.0001);
    assert.ok(scene.world?.nodes?.every((node) => node.id.startsWith("gallery-")));
    if (i > 0) assert.notEqual(scene.camera?.moves?.[0]?.rig, directed[i - 1].camera?.moves?.[0]?.rig);
  }
  const make = (motion: "measured" | "expressive") => planProject(parseBrief({
    ...draft, editorial: { ...draft.editorial, template: "studio-cut-v2", motion, closingStatement: "Close with confidence" },
  }).brief, catalog);
  const before = make("measured");
  const after = make("expressive");
  assert.deepEqual(after.shots, before.shots);
  assert.deepEqual(after.editorial?.cues, before.editorial?.cues);
  assert.equal(after.totalFrames, before.totalFrames);
});

test("creative fusion relief stays finite behind existing aspect layouts", () => {
  const first = studioScene({ id: "hook", title: "Hello", body: "World", label: "" },
    "60f", "expressive", "studio-cut-v2");
  const legacy = studioScene({ id: "hook", title: "Hello", body: "World", label: "" },
    "60f", "measured", "studio-cut-v2");
  for (const aspect of Object.keys(ASPECTS) as AspectId[]) {
    const spec = (scene: FilmSpecInput["timeline"][number]): FilmSpecInput => ({
      schemaVersion: "1", id: "fusion", seed: 1, look: "studio", palette: { primary: "#244bca" },
      output: { fps: 30, aspects: [aspect] }, audio: { grid: { bpm: 120 }, quantize: "none" }, timeline: [scene],
    });
    const expressive = stageStudioCut(spec(first), aspect, {}, "studio-cut-v2");
    const measured = stageStudioCut(spec(legacy), aspect, {}, "studio-cut-v2");
    for (const shot of [expressive, measured]) {
      for (const node of shot.timeline[0].world?.nodes ?? []) {
        if (node.type === "primitive") {
          const position: unknown = node.position;
          assert.ok(Array.isArray(position) && position.length === 3 && position.every(Number.isFinite));
        }
      }
    }
    const measuredNode = measured.timeline[0].world?.nodes?.[0];
    assert.ok(measuredNode && measuredNode.type === "primitive");
    const frame = ASPECTS[aspect];
    const layout = editorialLayout(aspect, frame, "hook", undefined, "studio-cut-v2");
    const centerX = layout.media!.left + layout.media!.width / 2;
    const side = centerX >= frame.width / 2 ? 1 : -1;
    const expectedX = (centerX - frame.width / 2) * (6.35 * 24 / 45) / Math.min(frame.width, frame.height) + side * 0.24;
    const measuredPosition: unknown = measuredNode.position;
    assert.ok(Array.isArray(measuredPosition));
    assert.equal(measuredPosition[0], expectedX);
  }
});


test("expressive v2 uses one consistent editorial geometry across 3D staging, screen and overlay contracts", () => {
  const ids = ["hook", "proposition", "feature-1", "feature-2", "feature-3", "feature-4", "cta"];
  const rectangles = (layout: ReturnType<typeof editorialLayout>) =>
    [layout.eyebrow, layout.headline, layout.body, layout.media, layout.logo, layout.action].filter((box) => box !== undefined);
  for (const [aspect, frame] of Object.entries(ASPECTS)) {
    const ratio = aspect as AspectId;
    const legacy = ids.map((id) => editorialLayout(ratio, frame, id, undefined, "studio-cut-v2"));
    const measured = ids.map((id) => editorialLayout(ratio, frame, id, undefined, "studio-cut-v2", "measured"));
    assert.deepEqual(measured, legacy, "Measured layouts must remain byte-compatible");
    const expressive = ids.map((id) => editorialLayout(ratio, frame, id, undefined, "studio-cut-v2", "expressive"));
    assert.equal(new Set(expressive.map((layout) => JSON.stringify(layout.media ?? layout.action))).size, 7,
      `${aspect} should use distinct per-beat framing`);
    for (let i = 0; i < ids.length; i++) {
      const layout = expressive[i];
      assert.notDeepEqual(layout, measured[i], `Expressive ${ids[i]} in ${aspect} should be directed`);
      for (const box of rectangles(layout)) {
        assert.ok(box.left >= layout.safe.left - 1e-6);
        assert.ok(box.top >= layout.safe.top - 1e-6);
        assert.ok(box.left + box.width <= layout.safe.left + layout.safe.width + 1e-6);
        assert.ok(box.top + box.height <= layout.safe.top + layout.safe.height + 1e-6);
      }
      if (layout.media) {
        const a = layout.media, b = layout.headline;
        assert.ok(a.left >= b.left + b.width || a.left + a.width <= b.left ||
          a.top >= b.top + b.height || a.top + a.height <= b.top, `${aspect} ${ids[i]} overlap`);
      }
    }
    const directed = studioScene({ id: "hook", title: "Hook", body: "Body", label: "Brand" },
      "60f", "expressive", "studio-cut-v2");
    const film: FilmSpecInput = { schemaVersion: "1", id: "fusion-aspect", seed: 1, look: "studio",
      palette: { primary: "#244bca" }, output: { fps: 30, aspects: [ratio] },
      audio: { grid: { bpm: 120 }, quantize: "none" }, timeline: [directed] };
    const staged = stageStudioCut(film, ratio, {}, "studio-cut-v2", "expressive");
    const media = expressive[0].media!;
    const centerX = media.left + media.width / 2;
    const side = centerX >= frame.width / 2 ? 1 : -1;
    const lens = directed.camera?.lens;
    const distance = directed.camera?.distance;
    if (typeof lens !== "number" || typeof distance !== "number") {
      throw new Error("Expressive direction must author numeric camera calibration");
    }
    // Same short-side projection as stageStudioCut: relief sits behind the camera target.
    const world = (distance + 0.85) * 24 / lens;
    const expectedX = (centerX - frame.width / 2) * world / Math.min(frame.width, frame.height) + side * 0.24;
    const reliefNode = staged.timeline[0].world?.nodes?.[0];
    assert.ok(reliefNode && reliefNode.type === "primitive" && Array.isArray(reliefNode.position));
    assert.equal(reliefNode.position[0], expectedX);
  }
});

test("sound cues are optional, rights-declared and tied to actual feature beats", () => {
  const withCue = { ...draft, editorial: { ...draft.editorial, audio: { ...draft.editorial.audio,
    cues: [{ file: "tap.wav", license: "Original recorded UI tap", atShot: "feature-2", offsetFrames: 3 }] } } };
  const plan = planProject(parseBrief(withCue).brief, catalog);
  assert.equal(plan.editorial?.audio.cues?.[0].gainDb, -12);
  assert.equal(plan.editorial?.audio.cues?.[0].offsetFrames, 3);
  assert.deepEqual(plan.shots.map(({ id, startFrame }) => [id, startFrame]),
    [["hook", 0], ["proposition", 60], ["feature-1", 135], ["feature-2", 225], ["cta", 330]]);
  assert.throws(() => parseBrief({ ...withCue, editorial: { ...withCue.editorial, audio: { ...withCue.editorial.audio,
    cues: [{ file: "tap.wav", license: "Original", atShot: "feature-4" }] } } }), /feature/i);
  assert.throws(() => parseBrief({ ...withCue, editorial: { ...withCue.editorial, audio: { ...withCue.editorial.audio,
    cues: [{ file: "../escape.wav", license: "Original", atShot: "hook" }] } } }), /path|portable/i);
});


test("expressive transitions synchronize GPU cuts with readable 2D continuity", () => {
  const plan = planProject(parseBrief({
    ...draft, editorial: { ...draft.editorial, template: "studio-cut-v2", motion: "expressive" },
  }).brief, catalog);
  const scenes = plan.filmSpec.timeline;
  assert.equal(scenes[1].transitionIn?.type, "lightSweep");
  assert.equal(scenes[3].transitionIn?.type, "dissolve");
  assert.equal(scenes[4].transitionIn?.type, "dissolve");
  assert.deepEqual(scenes.map((shot) => shot.length), ["60f", "75f", "90f", "105f", "90f"]);
  const scheduled = compileFilm(plan.filmSpec).stage;
  assert.equal(scheduled.durationInFrames, plan.totalFrames);
  assert.equal(scheduled.scenes[1].transitionIn?.type, "lightSweep");
  assert.ok(scheduled.scenes[1].transitionIn && scheduled.scenes[1].transitionIn.end - scheduled.scenes[1].transitionIn.start < 0.4);
  // Transition windows are centered on existing nominal boundaries and never alter duration.
  const transition = { start: 2 - 4 / 30, end: 2 + 4 / 30 };
  const boundaries = [
    { start: 0, transitionIn: null },
    { start: 2, transitionIn: transition },
    { start: 4.5, transitionIn: null },
  ];
  const near = (value: number, expected: number) => assert.ok(Math.abs(value - expected) < 1e-9);
  near(editorialContinuityOpacity(boundaries, 0, transition.start), 1);
  near(editorialContinuityOpacity(boundaries, 0, (transition.start + 2) / 2), 0.95);
  near(editorialContinuityOpacity(boundaries, 1, 2), 0.9);
  near(editorialContinuityOpacity(boundaries, 1, (transition.end + 2) / 2), 0.95);
  near(editorialContinuityOpacity(boundaries, 1, transition.end), 1);
  near(editorialContinuityOpacity(boundaries, 2, 5), 1);
});

test("expressive gallery relief gets restrained depth choreography without changing positions", () => {
  const expressive = studioScene({ id: "proposition", title: "Value", body: "Proof", label: "" },
    "75f", "expressive", "studio-cut-v2");
  const film: FilmSpecInput = { schemaVersion: "1", id: "depth-choreography", seed: 1, look: "studio",
    palette: { primary: "#244bca" }, output: { fps: 30, aspects: ["9x16"] },
    audio: { grid: { bpm: 120 }, quantize: "none" }, timeline: [expressive] };
  const staged = stageStudioCut(film, "9x16", {}, "studio-cut-v2", "expressive");
  for (const node of staged.timeline[0].world?.nodes ?? []) {
    assert.ok(node.id.startsWith("gallery-"));
    assert.ok(Array.isArray(node.position));
    assert.ok(node.scale && typeof node.scale === "object" && "keys" in node.scale);
  }
  assert.equal(studioScene({ id: "proposition", title: "Value", body: "Proof", label: "" },
    "75f", "measured", "studio-cut-v2").transitionIn?.type, "cut");
});
