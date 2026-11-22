import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBrief } from "../src/engine/client/brief";
import { editorialLayout } from "../src/engine/client/editorial";
import { planProject } from "../src/engine/client/plan";
import { ASPECTS, type AspectId } from "../src/stage3d/schema";

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
