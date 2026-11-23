import assert from "node:assert/strict";
import { test } from "node:test";
import { studioBrandWash, studioExpressivePost } from "../src/engine/client/studio-finishing";
import { masterReviewFrames } from "../scripts/lib/master-review";
import { studioScene, stageStudioCut } from "../src/engine/client/studio-cut";
import { ASPECTS, type AspectId } from "../src/stage3d/schema";
import type { FilmSpecInput } from "../src/engine/schema/film";

test("expressive look uses unified finishing without new GPU effects", () => {
  const beat = (id: string) => ({ id, title: id, body: "Copy", label: "Brand" });
  for (const id of ["hook", "proposition", "feature-1", "feature-2", "feature-3", "feature-4", "cta"]) {
    const current = studioScene(beat(id), "75f", "expressive", "studio-cut-v2");
    assert.deepEqual(current.post, studioExpressivePost(id));
    assert.equal(current.post?.toneMapping, "agx");
    assert.equal(current.post?.bloom, false);
    assert.equal(current.post?.dof, false);
    assert.equal(current.post?.grain, 0.012);
    const legacy = studioScene(beat(id), "75f", "measured", "studio-cut-v2");
    assert.notDeepEqual(current.post, legacy.post);
  }
});

test("brand wash is deterministic, bounded, and only affects expressive gallery backgrounds", () => {
  assert.equal(studioBrandWash("#ffffff", "#000000", 0.1), "#e6e6e6");
  assert.equal(studioBrandWash("palette.surface", "#1100aa", 0.1), "palette.surface");
  assert.equal(studioBrandWash("#ffffff", "not-a-color", 0.1), "#ffffff");
  assert.throws(() => studioBrandWash("#ffffff", "#000000", 0.20), /fraction/);
  const shot = studioScene({ id: "hook", title: "Hello", body: "World", label: "Logo" }, "60f", "expressive", "studio-cut-v2");
  const spec = (color: `#${string}`): FilmSpecInput => ({
    schemaVersion: "1", id: "color-finish", seed: 1, look: "studio", palette: { primary: color },
    output: { fps: 30, aspects: ["9x16"] }, audio: { grid: { bpm: 120 }, quantize: "none" }, timeline: [shot],
  });
  for (const aspect of Object.keys(ASPECTS) as AspectId[]) {
    const first = stageStudioCut(spec("#e31b45"), aspect, {}, "studio-cut-v2", "expressive");
    const second = stageStudioCut(spec("#0b67db"), aspect, {}, "studio-cut-v2", "expressive");
    assert.notDeepEqual(first.timeline[0].world?.backdrop, second.timeline[0].world?.backdrop);
    const unchanged = stageStudioCut(spec("#e31b45"), aspect, {}, "studio-cut-v2", "measured");
    assert.deepEqual(unchanged.timeline[0].world?.backdrop, shot.world?.backdrop);
  }
});

test("master review selects distinct midpoint frames from real shot boundaries", () => {
  assert.deepEqual(masterReviewFrames([
    { id: "hook", startFrame: 0, durationFrames: 60 },
    { id: "feature-1", startFrame: 135, durationFrames: 90 },
    { id: "cta", startFrame: 330, durationFrames: 90 },
  ]), [29, 179, 374]);
  assert.throws(() => masterReviewFrames([{ id: "hook", startFrame: 0, durationFrames: 0 }]), /hook/);
});
