/**
 * Renders selected frames of a composition as PNGs (one bundle, many stills) and, with ffmpeg on
 * PATH, a labelled contact sheet.
 *
 * Usage: pnpm stills <compositionId> --frames 30,300,540 [--out out/stills] [--gl angle] [--sheet]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { renderStill } from "@remotion/renderer";
import { bundleProject, loadComposition, ROOT, type GlBackend } from "./lib/remotion";

const args = process.argv.slice(2);
const argValue = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const id = args[0];
if (!id || id.startsWith("--")) {
  console.error("usage: pnpm stills <compositionId> --frames 30,300 [--out dir] [--gl angle] [--sheet]");
  process.exit(2);
}
const gl = (argValue("--gl") ?? "angle") as GlBackend;
const outDir = path.resolve(ROOT, argValue("--out") ?? path.join("out", "stills", id));

async function main() {
  const serveUrl = await bundleProject();
  const composition = await loadComposition(serveUrl, id, gl);
  const frames = (argValue("--frames") ?? "0").split(",").map(Number);
  fs.mkdirSync(outDir, { recursive: true });
  const files: string[] = [];
  for (const frame of frames) {
    if (frame < 0 || frame >= composition.durationInFrames) throw new Error(`Frame ${frame} outside 0..${composition.durationInFrames - 1}`);
    const output = path.join(outDir, `frame-${String(frame).padStart(5, "0")}.png`);
    const started = Date.now();
    await renderStill({ composition, serveUrl, frame, output, imageFormat: "png", chromiumOptions: { gl } });
    console.log(`frame ${frame} → ${path.relative(ROOT, output)} (${Date.now() - started} ms)`);
    files.push(output);
  }

  if (args.includes("--sheet") && files.length > 1) {
    const cols = Math.min(3, files.length);
    const rows = Math.ceil(files.length / cols);
    const sheet = path.join(outDir, "contact-sheet.png");
    const inputs = files.flatMap((f) => ["-i", f]);
    // ffmpeg's drawtext needs an explicit font file on Windows (no fontconfig).
    const winFont = "C:/Windows/Fonts/consola.ttf";
    const font = process.platform === "win32" && fs.existsSync(winFont) ? `fontfile='C\\:/Windows/Fonts/consola.ttf':` : "";
    const labelled = files
      .map((_, i) => `[${i}:v]scale=640:-2,drawtext=${font}text='f ${frames[i]}':x=12:y=12:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.5[v${i}]`)
      .join(";");
    const layout = files.map((_, i) => `${(i % cols) === 0 ? "0" : Array.from({ length: i % cols }, () => "w0").join("+")}_${Math.floor(i / cols) === 0 ? "0" : Array.from({ length: Math.floor(i / cols) }, () => "h0").join("+")}`).join("|");
    const filter = `${labelled};${files.map((_, i) => `[v${i}]`).join("")}xstack=inputs=${files.length}:layout=${layout}:fill=black`;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", filter, "-frames:v", "1", sheet]);
    console.log(`contact sheet → ${path.relative(ROOT, sheet)} (${cols}×${rows})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
