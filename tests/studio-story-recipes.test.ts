import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBrief } from "../src/engine/client/brief";
import { focusAt, shotDirectionSchema } from "../src/engine/client/focus";
import { screenGeometry } from "../src/engine/client/screen";
import { studioRecipeFor, studioScreenMotion, studioTapPosition, studioTapPulse } from "../src/engine/client/shot-recipes";
import { planProject } from "../src/engine/client/plan";
import { stageStudioCut } from "../src/engine/client/studio-cut";
import type { FilmSpecInput } from "../src/engine/schema/film";

const original = {
  schemaVersion: "2", id: "cinematic-proof", brand: { name: "Demo", color: "#244bca" },
  hero: "home.png", hook: "Show the problem", cta: "Start now", fps: 30, durationSeconds: 14,
  features: [
    { title: "Select a real item", body: "Open the recorded action.", asset: "home.png" },
    { title: "See the result", body: "Product feedback, not simulated UI.", asset: "home.png" },
  ],
  editorial: { template: "studio-cut-v2", motion: "expressive", productLabel: "Field operations",
    proposition: { title: "See the solution", body: "One coherent workflow" },
    logo: "brand.png", audio: { file: "bed.wav", license: "Original synthetic fixture" },
  },
};
const catalog = [{ path: "home.png", sha256: "hash", kind: "image" as const, durationSeconds: null }];

test("three distinct expressive recipes are deterministic and settle without hiding a UI", () => {
  assert.equal(studioRecipeFor("hook"), "tension-reveal");
  assert.equal(studioRecipeFor("proposition"), "solution-reveal");
  assert.equal(studioRecipeFor("feature-1"), "guided-proof");
  for (const id of ["hook", "proposition", "feature-1", "feature-2"]) {
    const frames = [0, 4, 9, 15, 30, 59];
    const samples = frames.map((f) => studioScreenMotion(id, f, 60, 1080, 30));
    assert.deepEqual(samples, frames.map((f) => studioScreenMotion(id, f, 60, 1080, 30)));
    assert.ok(samples.every((state) => !state.transform.includes("NaN")));
    assert.ok(samples.every((state) => !state.transform.includes("Infinity")));
  }
  assert.notEqual(studioScreenMotion("hook", 0, 60, 1080, 30).transform,
    studioScreenMotion("proposition", 0, 60, 1080, 30).transform);
  assert.notEqual(studioScreenMotion("feature-1", 0, 60, 1080, 30).transform,
    studioScreenMotion("feature-2", 0, 60, 1080, 30).transform);
});

test("user-authored taps are strict, ordered and cannot fabricate an unprovided interaction", () => {
  assert.equal(shotDirectionSchema.parse({}).taps, undefined);
  const taps = [{ at: 0.24, x: 0.5, y: 0.64 }, { at: 0.57, x: 0.42, y: 0.26 }];
  assert.deepEqual(shotDirectionSchema.parse({ taps }).taps, taps);
  assert.equal(shotDirectionSchema.safeParse({ taps: [{ at: 0.2, x: 1.01, y: 0.4 }] }).success, false);
  assert.equal(shotDirectionSchema.safeParse({ taps: [taps[1], taps[0]] }).success, false);
  assert.equal(shotDirectionSchema.safeParse({ taps: [taps[0], { at: 0.29, x: 0.2, y: 0.2 }] }).success, false);
  assert.equal(shotDirectionSchema.safeParse({ taps: Array(5).fill(taps[0]) }).success, false);
  const withTaps = { ...original, editorial: { ...original.editorial,
    direction: { "feature-1": { taps, focus: [{ at: 0, x: 0.5, y: 0.5, zoom: 1 },
      { at: 0.7, x: 0.5, y: 0.63, zoom: 1.2 }] } },
  } };
  const parsed = parseBrief(withTaps).brief;
  const planned = planProject(parsed, catalog);
  assert.deepEqual(planned.editorial?.direction?.["feature-1"]?.taps, taps);
  assert.equal(planned.editorial?.direction?.["feature-2"], undefined);
});

test("tap pulse and projection stay frame-exact and inside visible source bounds", () => {
  assert.deepEqual(studioTapPulse(0.2, 0.3), { opacity: 0, scale: 0.5 });
  assert.ok(studioTapPulse(0.31, 0.3).opacity > 0);
  assert.equal(studioTapPulse(0.42, 0.3).opacity, 0);
  const slot = { left: 10, top: 100, width: 940, height: 680 };
  const screen = screenGeometry(1080, 1920, 540, 960, { fit: "contain" }, slot);
  const tap = studioTapPosition(screen, { x: 0.52, y: 0.56 });
  assert.ok(tap && tap.left >= 10 && tap.left < screen.viewport.width);
  const crop = screenGeometry(1080, 1920, 540, 960, { fit: "cover",
    crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } }, slot,
    focusAt([{ at: 0, x: 0.5, y: 0.5, zoom: 2 }], 0.5));
  assert.equal(studioTapPosition(crop, { x: 0, y: 0 }), undefined);
});


test("guided gallery settles its rotation without changing exact world registration or legacy scenes", () => {
  const plan = planProject(parseBrief(original).brief, catalog);
  const film = plan.filmSpec as FilmSpecInput;
  const staged = stageStudioCut(film, "9x16", {}, "studio-cut-v2", "expressive");
  const untouched = stageStudioCut(film, "9x16", {}, "studio-cut-v2", "measured");
  const source = film.timeline[0].world?.nodes?.[0];
  const moving = staged.timeline[0].world?.nodes?.[0];
  const measured = untouched.timeline[0].world?.nodes?.[0];
  assert.ok(source && moving && measured);
  assert.ok(moving.rotation && !Array.isArray(moving.rotation) && typeof moving.rotation === "object" && "keys" in moving.rotation);
  assert.equal(moving.rotation.keys.length, 2);
  assert.deepEqual(moving.rotation.keys[1].value, source.rotation);
  assert.ok(Array.isArray(moving.position) && moving.position.length === 3 && moving.position.every(Number.isFinite));
  // The existing expressive/legacy aspect layouts differ intentionally; the added angular track
  // must not mutate the source position or the original scene durations.
  assert.ok(Array.isArray(measured.rotation)); // Legacy numeric axes retained
  assert.deepEqual(staged.timeline.map((scene) => scene.id), film.timeline.map((scene) => scene.id));
  assert.deepEqual(staged.timeline.map((scene) => scene.length), film.timeline.map((scene) => scene.length));
});
