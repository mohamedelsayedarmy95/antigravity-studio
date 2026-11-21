import path from "node:path";
import { bundle } from "@remotion/bundler";
import { selectComposition, type ChromiumOptions } from "@remotion/renderer";
import { createBundleOverride } from "./bundler";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");

export type GlBackend = NonNullable<ChromiumOptions["gl"]>;

/** Bundles src/index.ts the same way the CLI does (Rspack + Tailwind), returning a serve URL. */
export async function bundleProject(): Promise<string> {
  const started = Date.now();
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    bundlerOverride: createBundleOverride(ROOT),
    rspack: true,
    enableCaching: true,
  });
  console.log(`bundled in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return serveUrl;
}

export async function loadComposition(serveUrl: string, id: string, gl: GlBackend, inputProps: Record<string, unknown> = {}) {
  return selectComposition({ serveUrl, id, inputProps, chromiumOptions: { gl } });
}

/** Summary statistics for per-frame timings. */
export function summarize(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b);
  const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  const mean = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
  return { n: times.length, mean, p50: pick(0.5), p95: pick(0.95), max: sorted[sorted.length - 1] ?? 0 };
}
