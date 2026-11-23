import test from "node:test";
import assert from "node:assert/strict";
import { compileFilm } from "../src/engine/compile/compile";
import { stageStudioCut, studioScene } from "../src/engine/client/studio-cut";
import { studioScreenMotion } from "../src/engine/client/shot-recipes";

test("Obsidian follows the authored result and keeps depth behind the readable screen in every aspect", () => {
  const beat = { id: "feature-2", title: "Assign", body: "Pick a team", label: "" };
  const result = { localFrame: 42, title: "Assigned", body: "Shown in the actual capture" };
  const baseline = studioScene(beat, "90f", "expressive", "studio-cut-v2", undefined, result);
  const obsidian = studioScene(beat, "90f", "expressive", "studio-cut-v2", undefined, result, "obsidian");
  assert.equal(baseline.world?.nodes?.length, 0);
  const film = { schemaVersion: "1", id: "obsidian-test", seed: 1, look: "studio", audio: { grid: { bpm: 120 }, quantize: "none" }, timeline: [obsidian] } as const;
  for (const aspect of ["16x9", "9x16", "1x1"] as const) {
    const staged = stageStudioCut({ ...film, timeline: [...film.timeline], output: { fps: 30, aspects: [aspect] } },
      aspect, {}, "studio-cut-v2", "expressive", "obsidian");
    const { stage, overlays } = compileFilm(staged);
    const scene = stage.scenes[0].spec;
    assert.deepEqual(scene.world.nodes.map((node) => node.type === "primitive" && node.shape), ["sweptSheet", "sweptSheet"]);
    assert.deepEqual(scene.world.nodes.map((node) => Array.isArray(node.position) ? node.position[2] : undefined), [-1, -2.55]);
    assert.equal(Math.round(overlays.find((item) => item.element.id === "result-headline")!.inSec * 30), 42);
    const intensity = scene.world.lighting.intensity;
    assert.ok(typeof intensity === "object" && "keys" in intensity);
    assert.equal(intensity.keys[1].at, "42f");
  }
  assert.match(studioScreenMotion("feature-2", 0, 90, 1080, 30, true).transform, /rotateY\(-7/);
  assert.match(studioScreenMotion("feature-2", 89, 90, 1080, 30, true).transform, /rotateY\(0\.000deg\)/);
  assert.doesNotMatch(studioScreenMotion("feature-2", 0, 90, 1080, 30).transform, /rotateY/);
});
