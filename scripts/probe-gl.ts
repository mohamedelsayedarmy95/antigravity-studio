/**
 * GPU backend probe.
 * For each Chromium GL backend: render the GpuProbe composition, read the real WebGL renderer
 * string from the browser log, and time a short frame range. Writes a machine-readable profile
 * to .cache/gl-profile.json and prints a table.
 *
 * Usage: pnpm probe [--backends angle,vulkan] [--frames 30]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderFrames } from "@remotion/renderer";
import { bundleProject, loadComposition, ROOT, summarize, type GlBackend } from "./lib/remotion";

const args = process.argv.slice(2);
const argValue = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const backends = (argValue("--backends") ?? "angle,angle-egl,vulkan,swangle").split(",") as GlBackend[];
const frameCount = Number(argValue("--frames") ?? 30);

interface ProbeResult {
  backend: GlBackend;
  ok: boolean;
  renderer?: string;
  version?: string;
  msaa?: number;
  frameMs?: ReturnType<typeof summarize>;
  error?: string;
}

async function probe(serveUrl: string, backend: GlBackend): Promise<ProbeResult> {
  let gpu: { renderer: string; version: string; maxSamples: number } | null = null;
  const times: number[] = [];
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `probe-${backend}-`));
  try {
    const composition = await loadComposition(serveUrl, "GpuProbe", backend);
    await renderFrames({
      composition,
      serveUrl,
      inputProps: {},
      outputDir: outDir,
      imageFormat: "png",
      concurrency: 1,
      frameRange: [0, frameCount - 1],
      chromiumOptions: { gl: backend },
      onStart: () => undefined,
      onFrameUpdate: (_rendered, _index, ms) => times.push(ms),
      onBrowserLog: (log) => {
        const m = /GPU_PROBE (\{.*\})/.exec(log.text);
        if (m) gpu = JSON.parse(m[1]);
      },
    });
    const info = gpu as { renderer: string; version: string; maxSamples: number } | null;
    return {
      backend,
      ok: info !== null,
      renderer: info?.renderer,
      version: info?.version,
      msaa: info?.maxSamples,
      frameMs: summarize(times.slice(1)), // frame 0 includes shader compilation
    };
  } catch (e) {
    return { backend, ok: false, error: (e as Error).message.split("\n")[0] };
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

async function main() {
  const serveUrl = await bundleProject();
  const results: ProbeResult[] = [];
  for (const backend of backends) {
    process.stdout.write(`probing ${backend}… `);
    const r = await probe(serveUrl, backend);
    console.log(r.ok ? `ok (${r.frameMs?.mean.toFixed(1)} ms/frame)` : `FAILED ${r.error ?? "no renderer info"}`);
    results.push(r);
  }

  console.log("\n| backend | renderer | WebGL | MSAA | mean ms | p95 ms |");
  console.log("| :-- | :-- | :-- | --: | --: | --: |");
  for (const r of results) {
    console.log(
      `| ${r.backend} | ${r.renderer ?? r.error ?? "-"} | ${r.version ?? "-"} | ${r.msaa ?? "-"} | ${r.frameMs?.mean.toFixed(1) ?? "-"} | ${r.frameMs?.p95.toFixed(1) ?? "-"} |`,
    );
  }

  const profile = {
    probedAt: new Date().toISOString(),
    host: { cpu: os.cpus()[0]?.model, threads: os.cpus().length, ramGb: +(os.totalmem() / 2 ** 30).toFixed(1) },
    results,
  };
  const cacheDir = path.join(ROOT, ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, "gl-profile.json"), JSON.stringify(profile, null, 2));
  console.log(`\nwrote .cache/gl-profile.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
