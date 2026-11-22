import assert from "node:assert/strict";
import { test } from "node:test";
import { factoryEncoding } from "../scripts/lib/client-render";

test("the master profile improves encoding while preserving exact 30 fps cadence and SDR format", () => {
  assert.deepEqual(factoryEncoding("master", 30), {
    codec: "h264", colorSpace: "bt709", pixelFormat: "yuv420p", fps: 30, crf: 10,
    x264Preset: "slow", h264Profile: "high",
  });
  assert.throws(() => factoryEncoding("master", 60), /30 fps/);
  assert.deepEqual(factoryEncoding("preview", 60), {
    codec: "h264", colorSpace: "bt709", pixelFormat: "yuv420p", fps: 60, crf: 18,
    x264Preset: "fast", h264Profile: null,
  });
});
