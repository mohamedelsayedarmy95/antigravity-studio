import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderMedia, renderStill, selectComposition, type ChromiumOptions } from "@remotion/renderer";
import type { FilmProps } from "../../src/engine/Film";
import { defaultPresentation, screenFrameName, sourceFrames, type BoundScreen } from "../../src/engine/client/screen";
import type { ClientBrief } from "../../src/engine/client/brief";
import type { planProject } from "../../src/engine/client/plan";
import { ASPECTS, type AspectId } from "../../src/stage3d/schema";
import { copyWithoutAccessUpdate, isWithin, mediaDirectory, mediaSha256, type scanProject } from "./client-media";
import { bundleProject, ROOT } from "./remotion";

type Plan = ReturnType<typeof planProject>;
type Manifest = Awaited<ReturnType<typeof scanProject>>;

function mediaCommand(executable: string, args: string[], action: string) {
  const result = spawnSync(executable, args, {
    encoding: "utf8", windowsHide: true, maxBuffer: 2 * 1024 * 1024, timeout: 600000,
  });
  if (result.error || result.status !== 0 || result.stderr.trim()) {
    throw new Error(action + ": " + (result.error?.message ?? (result.stderr.trim() || executable + " failed")));
  }
  return result.stdout;
}

const ffmpeg = (args: string[], action: string) => mediaCommand("ffmpeg", ["-nostdin", "-v", "error", "-xerror", ...args], action);

function checkSDR(asset: Manifest["assets"][number]) {
  if (asset.sampleAspectRatio || asset.rotation % 90 !== 0) {
    throw new Error(asset.path + ": render requires square pixels and right-angle orientation");
  }
  // Chromium applies the screenshot's embedded profile when it decodes the original file.
  if (asset.kind === "image") return;
  const primaries = asset.color.primaries;
  const transfer = asset.color.transfer;
  if ((primaries && !["bt709", "unknown", "unspecified"].includes(primaries)) ||
      (transfer && !["bt709", "iec61966-2-1", "unknown", "unspecified"].includes(transfer))) {
    throw new Error(asset.path + ": unsupported color profile. Supply an SDR sRGB or BT.709 derivative.");
  }
}

async function prepareScreens(project: string, plan: Plan, manifest: Manifest, scratch: string, publicRoot: string) {
  const assetRoot = await mediaDirectory(project, plan.assetDirectory);
  const catalog = new Map(manifest.assets.map((record) => [record.path, record]));
  const unique = [...new Set(plan.shots.flatMap((shot) => shot.asset ? [shot.asset.path] : []))];
  const files = await Promise.all(unique.map(async (selected, index) => {
    const record = catalog.get(selected);
    if (!record) throw new Error("Selected file is absent from manifest: " + selected);
    checkSDR(record);
    const source = path.join(assetRoot, ...selected.split("/"));
    if (!(await lstat(source)).isFile() || !isWithin(assetRoot, await realpath(source))) {
      throw new Error("Selected asset is no longer a regular local file: " + selected);
    }
    return { record, source, target: path.join(scratch, "input-" + index + path.extname(selected).toLowerCase()) };
  }));
  if (process.platform === "win32") {
    const failure = copyWithoutAccessUpdate(files)[0];
    if (failure) throw new Error(files[failure.index].record.path + ": " + failure.message);
  } else {
    for (const file of files) await copyFile(file.source, file.target, constants.COPYFILE_EXCL);
  }
  const decodeArgs = (file: typeof files[number]) => [
    "-filter_threads", "1", "-threads", "1", "-err_detect", "explode", "-protocol_whitelist", "file",
    ...(file.record.kind === "video" ? ["-enable_drefs", "0"] : []),
    "-i", file.target, "-map", file.record.kind === "video" ? "0:V:0" : "0:v:0", "-an", "-sn", "-dn",
  ];
  for (const file of files) {
    if (await mediaSha256(file.target) !== file.record.sha256) throw new Error("Selected asset changed after scan: " + file.record.path);
    // Verify the complete selected source before spending time rendering the composition.
    ffmpeg([...decodeArgs(file), "-f", "null", "-"], "Cannot fully decode " + file.record.path);
  }

  const byPath = new Map(files.map((file) => [file.record.path, file]));
  const screens: Record<string, BoundScreen> = {};
  for (const shot of plan.shots) {
    if (!shot.asset) continue;
    const file = byPath.get(shot.asset.path);
    if (!file) throw new Error("Missing selected source: " + shot.asset.path);
    const directory = "factory-screens/" + shot.id;
    const absolute = path.join(publicRoot, directory);
    await mkdir(absolute, { recursive: true });
    const fps = plan.filmSpec.output.fps;
    let expectedFrames = 1;
    if (shot.asset.sourceRange) {
      const frames = sourceFrames(shot.asset.sourceRange, fps, shot.durationFrames);
      expectedFrames = frames.end - frames.start;
      const filter = "setpts=PTS-STARTPTS,fps=" + fps + ":round=up,trim=start_frame=" + frames.start +
        ":end_frame=" + frames.end + ",setpts=PTS-STARTPTS,format=rgb24";
      ffmpeg([...decodeArgs(file), "-vf", filter, "-c:v", "png", "-threads", "1", "-fps_mode", "passthrough",
        "-start_number", "0", path.join(absolute, "%06d.png")], "Cannot prepare recording " + shot.asset.path);
    } else {
      ffmpeg([...decodeArgs(file), "-vf", "format=rgb24", "-frames:v", "1", "-c:v", "png", "-threads", "1",
        "-update", "1", path.join(absolute, screenFrameName(0))], "Cannot prepare screenshot " + shot.asset.path);
    }
    const frames = (await readdir(absolute)).sort();
    if (frames.length !== expectedFrames || frames.some((name, index) => name !== screenFrameName(index))) {
      throw new Error("Prepared screen frame sequence is incomplete. Check the source duration or choose an earlier trim end: " + shot.asset.path);
    }
    const png = await readFile(path.join(absolute, frames[0]));
    const stillFile = file.record.kind === "image" ? "source" + path.extname(file.record.path).toLowerCase() : undefined;
    if (stillFile) await copyFile(file.target, path.join(absolute, stillFile), constants.COPYFILE_EXCL);
    screens[shot.id] = {
      directory, frameCount: frames.length, stillFile, width: png.readUInt32BE(16), height: png.readUInt32BE(20),
      presentation: shot.asset.presentation ?? defaultPresentation,
    };
  }
  return screens;
}

export function verifyFactoryMp4(file: string, aspect: AspectId, fps: number, expectedFrames: number) {
  const probe = mediaCommand("ffprobe", [
    "-v", "error", "-show_streams", "-show_packets", "-show_entries",
    "packet=pts:stream=codec_type,codec_name,width,height,pix_fmt,color_space,color_range,color_primaries,color_transfer,time_base,avg_frame_rate,nb_frames",
    "-of", "json", file,
  ], "Cannot inspect generated MP4");
  const { streams, packets } = JSON.parse(probe) as {
    streams: Record<string, string | number>[]; packets: { pts: number }[];
  };
  const stream = streams[0];
  const expected = ASPECTS[aspect];
  if (streams.length !== 1 || stream.codec_type !== "video" || stream.codec_name !== "h264" ||
      stream.width !== expected.width || stream.height !== expected.height || stream.pix_fmt !== "yuv420p" ||
      stream.color_space !== "bt709" || stream.color_primaries !== "bt709" || stream.color_transfer !== "bt709" ||
      stream.color_range !== "tv" || stream.avg_frame_rate !== fps + "/1" || Number(stream.nb_frames) !== expectedFrames) {
    throw new Error("Generated MP4 failed stream conformance for " + aspect);
  }
  const [n, d] = String(stream.time_base).split("/").map(Number);
  const pts = packets.map((packet) => packet.pts).sort((a, b) => a - b);
  if (pts.length !== expectedFrames || pts.some((value, i) => value * n * fps !== i * d)) {
    throw new Error("Generated MP4 is not constant frame rate from frame zero: " + aspect);
  }
  ffmpeg(["-threads", "1", "-err_detect", "explode", "-i", file, "-map", "0:v:0", "-f", "null", "-"], "Generated MP4 failed full decode");
  return { ...stream, decoded: true, constantFrameRate: true };
}

export async function renderClient(input: {
  project: string; output: string; brief: ClientBrief; plan: Plan; manifest: Manifest; aspects: AspectId[]; frame?: number;
}) {
  const { project, output, brief, plan, manifest, aspects, frame } = input;
  const browser = process.env.UVF_CHROMIUM_EXECUTABLE ??
    path.join(ROOT, "node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe");
  await access(browser).catch(() => { throw new Error("A local Chromium executable is required. Set UVF_CHROMIUM_EXECUTABLE or install the pinned Remotion browser before rendering."); });
  const scratch = await mkdtemp(path.join(output, ".render-work-"));
  const tempVariables = ["TEMP", "TMP", "TMPDIR"] as const;
  const previousTemp = tempVariables.map((key) => process.env[key]);
  const chromiumOptions: ChromiumOptions = {
    gl: "angle", flags: { "host-resolver-rules": "MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1" },
  };
  try {
    const localTemp = path.join(scratch, "temp");
    await mkdir(localTemp);
    for (const key of tempVariables) process.env[key] = localTemp;
    const bundleDir = await bundleProject(path.join(scratch, "bundle"));
    const index = path.join(bundleDir, "index.html");
    const html = await readFile(index, "utf8");
    const policy = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; object-src 'none';\">";
    if (!html.includes("<head>")) throw new Error("Cannot apply local-only browser policy to the render bundle");
    await writeFile(index, html.replace("<head>", "<head>" + policy));
    const screens = await prepareScreens(project, plan, manifest, scratch, path.join(bundleDir, "public"));
    const files = [];
    const fps = plan.filmSpec.output.fps;
    for (const aspect of aspects) {
      const inputProps: FilmProps = { spec: plan.filmSpec, aspect, screens };
      const browserOptions = { serveUrl: bundleDir, inputProps, chromiumOptions, browserExecutable: browser };
      const composition = await selectComposition({ id: "FactoryFilm", ...browserOptions });
      const filename = plan.filmSpec.id + "-" + aspect + (frame === undefined ? ".mp4" : "-f" + frame + ".png");
      const file = path.join(scratch, filename);
      const start = Date.now();
      if (frame === undefined) {
        await renderMedia({
          ...browserOptions, composition, outputLocation: file, codec: "h264", colorSpace: "bt709",
          pixelFormat: "yuv420p", imageFormat: "png", crf: 18, x264Preset: "fast", concurrency: 1, muted: true,
        });
      } else {
        await renderStill({ ...browserOptions, composition, output: file, frame, imageFormat: "png" });
      }
      const elapsedSeconds = (Date.now() - start) / 1000;
      const qa = frame === undefined ? verifyFactoryMp4(file, aspect, fps, plan.totalFrames) : null;
      files.push({ aspect, filename, sha256: await mediaSha256(file), elapsedSeconds, qa });
      console.log("Rendered " + aspect + " in " + elapsedSeconds.toFixed(2) + "s");
    }
    const delivery = path.join(scratch, "delivery");
    await mkdir(delivery);
    for (const file of files) await rename(path.join(scratch, file.filename), path.join(delivery, file.filename));
    const receipt = {
      schemaVersion: "1", profile: "preview", frame: frame ?? null, rightsDeclaration: brief.renderRights,
      files, shots: plan.shots, screens: Object.fromEntries(Object.entries(screens).map(([id, screen]) => {
        const { width, height, frameCount } = screen;
        return [id, { width, height, frameCount }];
      })),
    };
    await writeFile(path.join(delivery, "render-report.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
    const destination = path.join(output, (frame === undefined ? "preview-" : "still-") + randomUUID());
    await rename(delivery, destination);
    for (const file of files) console.log("Output: " + path.join(destination, file.filename));
    console.log("Render report: " + path.join(destination, "render-report.json"));
  } finally {
    for (const [index, key] of tempVariables.entries()) {
      const value = previousTemp[index];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    try {
      await rm(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
    } catch (error) {
      console.error("Render scratch cleanup failed at " + scratch + ". " + (error as Error).message);
    }
  }
}
