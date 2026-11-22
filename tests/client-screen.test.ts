import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBrief, starterBrief } from "../src/engine/client/brief";
import { indexForFrame, screenGeometry, sourceFrames } from "../src/engine/client/screen";

test("contain preserves proportions, while cover follows focal point inside an explicit crop", () => {
  const contain = screenGeometry(1920, 1080, 400, 600, { fit: "contain" });
  assert.equal(contain.width / contain.height, 400 / 600);
  assert.equal(contain.left + contain.width / 2, contain.viewport.width / 2);
  const cover = screenGeometry(1080, 1920, 1000, 600, {
    fit: "cover", crop: { x: 0.25, y: 0, width: 0.5, height: 1 }, focal: { x: 1, y: 0.5 },
  });
  assert.ok(Math.abs(cover.width / cover.height - 1000 / 600) < 1e-9);
  assert.ok(Math.abs(cover.left + 0.75 * cover.width - cover.viewport.width) < 1e-9);
});

test("source windows are frame-indexed, end-exclusive and hold the last decoded frame", () => {
  assert.deepEqual(sourceFrames({ startSeconds: 0.25, endSeconds: 1 }, 30, 20), { start: 8, end: 28 });
  assert.equal(indexForFrame(200, 5), 4);
  assert.equal(indexForFrame(2, 5), 2);
  assert.throws(() => sourceFrames({ startSeconds: 0.001, endSeconds: 0.002 }, 30, 60), /no frame/i);
});

test("brief rejects out-of-bounds crop rectangles and can carry explicit render clearance", () => {
  const source = starterBrief("example");
  assert.throws(() => parseBrief({
    ...source, heroPresentation: { fit: "cover", crop: { x: 0.9, y: 0, width: 0.2, height: 1 } },
  }), /heroPresentation\.crop/);
  const { brief } = parseBrief({ ...source, renderRights: {
    origin: "synthetic", approved: true, license: "Original generated fixture", privacy: "No personal information",
  } });
  assert.equal(brief.renderRights?.origin, "synthetic");
  assert.throws(() => parseBrief({ ...source, renderRights: { ...brief.renderRights, approved: false } }), /renderRights\.approved/);
});
