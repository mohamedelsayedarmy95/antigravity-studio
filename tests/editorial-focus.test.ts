import assert from "node:assert/strict";
import { test } from "node:test";
import { focusAt, focusTrackSchema, projectEmphasis, shotDirectionSchema } from "../src/engine/client/focus";
import { editorialLayout } from "../src/engine/client/editorial";
import { screenGeometry } from "../src/engine/client/screen";

const track = [{ at: 0, x: 0.3, y: 0.4, zoom: 1 }, { at: 0.5, x: 0.8, y: 0.6, zoom: 2 }, { at: 1, x: 0.8, y: 0.6, zoom: 2 }];

test("focus motion eases from authored positions and holds independently of seek order", () => {
  const parsed = focusTrackSchema.parse(track);
  const first = focusAt(parsed, 0.25);
  assert.deepEqual(first, { x: 0.55, y: 0.5, zoom: 1.5 });
  assert.deepEqual(focusAt(parsed, 0.82), { x: 0.8, y: 0.6, zoom: 2 });
  assert.deepEqual(focusAt(parsed, 0.25), first);
  assert.ok(focusAt(parsed, 0.05).x < 0.35);
  assert.equal(focusTrackSchema.safeParse([]).success, false);
  assert.throws(() => focusTrackSchema.parse([track[0], track[0]]));
  assert.throws(() => focusTrackSchema.parse([track[1], track[2]]));
  assert.throws(() => shotDirectionSchema.parse({ emphasis: [{ from: 0.5, until: 0.3, region: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 } }] }));
});

test("zoom preserves the crop viewport and aspect and clamps approaching the source edge", () => {
  const slot = { left: 50, top: 150, width: 950, height: 620 };
  const presentation = { fit: "contain" as const, crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 } };
  const base = screenGeometry(1080, 1920, 1600, 1000, presentation, slot);
  const focused = screenGeometry(1080, 1920, 1600, 1000, presentation, slot, { x: 1, y: 1, zoom: 2 });
  assert.equal(focused.width / focused.height, 1.6);
  assert.deepEqual(focused.viewport, base.viewport);
  assert.ok(Math.abs(focused.left + focused.width * 0.9 - focused.viewport.width) < 1e-8);
  const right = projectEmphasis(focused, { x: 0.62, y: 0.63, width: 0.12, height: 0.12 });
  assert.ok(right && right.left > 0 && right.top > 0);
  assert.equal(projectEmphasis(focused, { x: 0.03, y: 0.03, width: 0.14, height: 0.14 }), undefined);
});

test("the directed portrait reserves a larger product region and gives the closing action its own area", () => {
  const frame = { width: 1080, height: 1920 };
  const original = editorialLayout("9x16", frame, "feature-2");
  const revised = editorialLayout("9x16", frame, "feature-2", undefined, "studio-cut-v2");
  assert.ok(revised.media!.height > original.media!.height);
  assert.ok(revised.media!.top + revised.media!.height < revised.eyebrow.top);
  const closing = editorialLayout("9x16", frame, "cta", undefined, "studio-cut-v2");
  assert.ok(closing.action && closing.action.top > closing.body.top + closing.body.height);
});
