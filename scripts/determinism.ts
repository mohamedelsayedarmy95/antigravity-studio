/**
 * Determinism harness.
 *  1. Repeatability: each probe frame rendered twice as an isolated still → byte-identical PNGs.
 *  2. Scrub-safety:  the same frames rendered inside a sequential range (renderFrames) must match
 *     the isolated stills, proving no state leaks from previous frames.
 *
 * Usage: pnpm determinism <compositionId> [--frames 0,90,250] [--gl angle] [--props '{"aspect":"16:9"}']
 * Exits 1 on any mismatch.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderFrames, renderStill } from "@remotion/renderer";
import { bundleProject, loadComposition, type GlBackend } from "./lib/remotion";

const args = process.argv.slice(2);
const argValue = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const compositionId = args[0];
if (!compositionId || compositionId.startsWith("--")) {
  console.error("usage: pnpm determinism <compositionId> [--frames 0,90,250] [--gl angle] [--props json]");
  process.exit(2);
}
const gl = (argValue("--gl") ?? "angle") as GlBackend;
const inputProps = JSON.parse(argValue("--props") ?? "{}") as Record<string, unknown>;

const sha = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);

async function main() {
  const serveUrl = await bundleProject();
  const composition = await loadComposition(serveUrl, compositionId, gl, inputProps);
  const last = composition.durationInFrames - 1;
  const frames = (argValue("--frames") ?? `0,${Math.floor(last / 3)},${Math.floor((2 * last) / 3)},${last}`)
    .split(",")
    .map(Number);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "determinism-"));
  let failures = 0;
  try {
    // 1. Repeatability
    const stillHash = new Map<number, string>();
    for (const frame of frames) {
      const hashes: string[] = [];
      for (const run of [1, 2]) {
        const output = path.join(tmp, `still-${frame}-${run}.png`);
        await renderStill({ composition, serveUrl, inputProps, frame, output, imageFormat: "png", chromiumOptions: { gl } });
        hashes.push(sha(output));
      }
      const same = hashes[0] === hashes[1];
      if (!same) failures++;
      stillHash.set(frame, hashes[0]);
      console.log(`repeat  frame ${String(frame).padStart(5)}: ${hashes.join(" vs ")} ${same ? "IDENTICAL" : "MISMATCH"}`);
    }

    // 2. Scrub-safety: render a sequential range ending at each probe frame.
    for (const frame of frames) {
      const start = Math.max(0, frame - 4);
      const outDir = path.join(tmp, `seq-${frame}`);
      await renderFrames({
        composition,
        serveUrl,
        inputProps,
        outputDir: outDir,
        imageFormat: "png",
        concurrency: 1,
        frameRange: [start, frame],
        chromiumOptions: { gl },
        onStart: () => undefined,
        onFrameUpdate: () => undefined,
      });
      const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".png")).sort();
      const seqHash = sha(path.join(outDir, files[files.length - 1]));
      const same = seqHash === stillHash.get(frame);
      if (!same) failures++;
      console.log(`scrub   frame ${String(frame).padStart(5)}: in-sequence ${seqHash} vs isolated ${stillHash.get(frame)} ${same ? "IDENTICAL" : "MISMATCH"}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(failures === 0 ? "\nDETERMINISM: PASS" : `\nDETERMINISM: FAIL (${failures} mismatches)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
