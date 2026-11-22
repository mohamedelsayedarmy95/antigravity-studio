import assert from "node:assert/strict";
import { test } from "node:test";
import { compileFilm } from "../src/engine/compile/compile";
import type { FilmSpecInput } from "../src/engine/schema/film";
import { compositeAt } from "../src/stage3d/plan";

function stage(transitionIn: FilmSpecInput["timeline"][number]["transitionIn"]) {
  return compileFilm({
    schemaVersion: "1", id: "stage-boundary", seed: 1, look: "studio",
    output: { fps: 30, aspects: ["16x9"] },
    audio: { grid: { bpm: 120 }, quantize: "none" },
    timeline: [
      { id: "hook", length: "64f", transitionIn: { type: "cut" } },
      { id: "proposition", length: "81f", transitionIn: { type: "cut" } },
      { id: "feature-1", length: "90f", transitionIn },
    ],
  }).stage;
}

test("a frame-authored hard cut selects the incoming GPU scene on the DOM's first frame", () => {
  const plan = stage({ type: "cut" });
  const before = compositeAt(plan, 144 / 30);
  const at = compositeAt(plan, 145 / 30);
  assert.equal(before.mode === "single" && before.scene.id, "proposition");
  assert.equal(at.mode === "single" && at.scene.id, "feature-1");
});

test("a frame-aligned transition includes its first frame and excludes its endpoint", () => {
  const plan = stage({ type: "dissolve", length: "8f" });
  const start = compositeAt(plan, 141 / 30);
  const inside = compositeAt(plan, 148 / 30);
  const end = compositeAt(plan, 149 / 30);
  assert.equal(start.mode === "transition" && start.progress, 0);
  assert.ok(inside.mode === "transition" && Math.abs(inside.progress - 7 / 8) < 1e-9);
  assert.equal(end.mode === "single" && end.scene.id, "feature-1");
});
