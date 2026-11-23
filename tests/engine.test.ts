import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evalNumber, evalVec3, type EvalContext } from "../src/engine/time/animatable";
import { beatImpulse } from "../src/engine/time/beatGrid";
import { lengthToSeconds, resolveTimeRef, type TimeContext } from "../src/engine/time/timeRef";
import { compileFilm, FilmSpecError } from "../src/engine/compile/compile";
import type { FilmSpecInput } from "../src/engine/schema/film";
import { m1CoreTest } from "../src/films/m1-core-test";
import { m2TypeData } from "../src/films/m2-type-data";
import { elementBox, formatNumber, safeRect } from "../src/layer2d/layout";
import { OverlayElementSchema } from "../src/layer2d/schema";
import { compositeAt } from "../src/stage3d/plan";

const grid = { bpm: 120, offset: 0, beatsPerBar: 4 }; // 1 beat = 0.5 s, 1 bar = 2 s
const ctx: TimeContext = { fps: 60, grid, sceneStart: 10, sceneLength: 4, markers: { drop: 12, "scene:a": 10 } };
const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

describe("time grammar", () => {
  it("resolves every TimeRef form, scene-relative", () => {
    close(resolveTimeRef(1.5, ctx), 1.5);
    close(resolveTimeRef("1.5s", ctx), 1.5);
    close(resolveTimeRef("90f", ctx), 1.5);
    close(resolveTimeRef("3b", ctx), 1.5);
    close(resolveTimeRef("25%", ctx), 1);
    close(resolveTimeRef("bar 7", ctx), 2); // bar 7 starts at 12 s absolute
    close(resolveTimeRef("@drop", ctx), 2);
    close(resolveTimeRef("@drop+2b", ctx), 3);
    close(resolveTimeRef("@drop-0.5s", ctx), 1.5);
    close(resolveTimeRef("@scene:a+30f", ctx), 0.5);
  });
  it("names known markers when a marker is unknown", () => {
    assert.throws(() => resolveTimeRef("@dorp", ctx), /Unknown marker "@dorp".*drop/);
  });
  it("converts lengths", () => {
    close(lengthToSeconds("2 bars", 60, grid), 4);
    close(lengthToSeconds("1 bar", 60, grid), 2);
    close(lengthToSeconds("4b", 60, grid), 2);
  });
});

describe("animatables", () => {
  const e: EvalContext = { ...ctx, t: 0 };
  it("treats plain Vec3 arrays as constants (arrays have a built-in .keys)", () => {
    assert.deepEqual(evalVec3([1, 2, 3], e), [1, 2, 3]);
  });
  it("evaluates additive keyframes", () => {
    const track = { keys: [{ at: 0, value: 0 }, { at: 1, value: 10, ease: "linear" as const }] };
    close(evalNumber(track, { ...e, t: 0.5 }), 5);
    close(evalNumber(track, { ...e, t: 2 }), 10);
  });
  it("adds beat impulses on top of a base", () => {
    const pulsed = evalNumber({ base: 1, mod: { source: "beat", amount: 1 } }, { ...e, t: 0.05 });
    assert.ok(pulsed > 1.5 && pulsed < 2, `${pulsed}`);
    assert.equal(beatImpulse(grid, -1), 0);
  });
});

describe("compiler", () => {
  it("snaps cuts to the bar grid and reports the snap", () => {
    const c = compileFilm(m2TypeData);
    assert.deepEqual(c.stage.scenes.map((s) => s.start), [0, 4, 8, 12]);
    assert.equal(c.snaps.length, 1);
    assert.equal(c.snaps[0].sceneId, "data");
    close(c.snaps[0].requestedEnd, 7.8);
    close(c.snaps[0].snappedEnd, 8);
    assert.equal(c.durationInFrames, 960);
  });
  it("publishes automatic, film and scene markers", () => {
    const c = compileFilm(m2TypeData);
    close(c.markers["scene:data"], 4);
    close(c.markers["scene:data:end"], 8);
    close(c.markers.drop, 4);
    close(c.markers["type.hit"], 8.5);
  });
  it("times overlays: marker-relative in, default exit before the next transition", () => {
    const c = compileFilm(m2TypeData);
    const ring = c.overlays.find((o) => o.sceneId === "data" && o.element.kind === "chart" && o.element.chart === "ring")!;
    close(ring.inSec, 4.5); // @drop + 1 beat
    close(ring.endSec, 8 - 0.25); // the lightSweep into "type" starts half a beat before the cut
    const headline = c.overlays.find((o) => o.sceneId === "type" && o.element.kind === "text" && o.element.role === "headline")!;
    close(headline.inSec, 8.5);
  });
  it("fills look defaults (lighting, transitions)", () => {
    const spec: FilmSpecInput = {
      schemaVersion: "1",
      id: "defaults",
      seed: 1,
      look: "keynote",
      audio: { grid },
      timeline: [{ id: "a", length: "1 bar" }, { id: "b", length: "1 bar" }],
    };
    const c = compileFilm(spec);
    assert.equal(c.stage.scenes[1].spec.world.lighting.rig, "studioSoftbox");
    assert.equal(c.stage.scenes[1].transitionIn?.type, "dissolve");
    assert.equal(c.stage.scenes[0].transitionIn, null);
  });
  it("reports every problem with its field path and a suggestion", () => {
    const bad: FilmSpecInput = {
      ...m2TypeData,
      timeline: m2TypeData.timeline.map((s, i) =>
        i === 1 ? { ...s, overlay: [{ kind: "chart", chart: "line", data: "thruput", at: "@dorp" }] } : s,
      ),
    };
    try {
      compileFilm(bad);
      assert.fail("expected FilmSpecError");
    } catch (e) {
      assert.ok(e instanceof FilmSpecError);
      const text = e.issues.join("\n");
      assert.match(text, /timeline\.1\.overlay\.0\.at: unknown marker "@dorp"\. Did you mean "drop"\?/);
      assert.match(text, /timeline\.1\.overlay\.0\.data: unknown data series "thruput"\. Did you mean "throughput"\?/);
    }
  });
  it("rejects schema violations with paths", () => {
    assert.throws(() => compileFilm({ ...m2TypeData, id: "Bad Id" }), /id: film ids are lowercase-kebab/);
  });
  it("keeps the M1 film's structure (lengths, transitions) after migration", () => {
    const c = compileFilm(m1CoreTest);
    assert.deepEqual(c.stage.scenes.map((s) => s.length), [6, 4, 4, 6]);
    assert.deepEqual(c.stage.scenes.map((s) => s.transitionIn?.type), ["dissolve", "lightSweep", "glitchSlice", "noiseDissolve"]);
    assert.equal(compositeAt(c.stage, 6).mode, "transition");
  });
});

describe("2D layout", () => {
  it("anchors boxes inside each aspect's safe area", () => {
    const el = OverlayElementSchema.parse({ kind: "text", content: "x", anchor: "bottomRight", width: 0.5 });
    for (const [w, h] of [[1920, 1080], [1080, 1920], [1080, 1080]]) {
      const safe = safeRect(w, h);
      const box = elementBox(el, { width: w, height: h });
      close(Number(box.style.left) + box.width, safe.x + safe.w, 1e-6);
      close(Number(box.style.bottom), h - (safe.y + safe.h), 1e-6);
    }
  });
  it("formats numbers without locale dependence", () => {
    assert.equal(formatNumber(1234567.891, 2), "1,234,567.89");
    assert.equal(formatNumber(-0.5, 0), "-1");
  });
});
