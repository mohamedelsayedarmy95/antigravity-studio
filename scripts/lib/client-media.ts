import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdtemp, readdir, realpath, rmdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPortablePath } from "../../src/engine/client/brief";

const formats = new Map([
  [".jpg", "jpeg_pipe"], [".jpeg", "jpeg_pipe"], [".png", "png_pipe"], [".webp", "webp_pipe"],
  [".mp4", "mov"], [".mov", "mov"],
]);

interface Diagnostic {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
}

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  profile?: string;
  width?: number;
  height?: number;
  duration?: string;
  avg_frame_rate?: string;
  pix_fmt?: string;
  sample_aspect_ratio?: string;
  color_range?: string;
  color_space?: string;
  color_transfer?: string;
  color_primaries?: string;
  disposition?: { attached_pic?: number };
  side_data_list?: { rotation?: number }[];
}

function probe(file: string, format: string) {
  const videoContainer = format === "mov";
  const args = [
    "-v", "error", "-protocol_whitelist", "file", "-f", format,
    ...(videoContainer ? ["-enable_drefs", "0"] : []),
    "-show_entries",
    "format=duration,format_name:stream=codec_name,codec_type,profile,width,height,duration,avg_frame_rate,pix_fmt,sample_aspect_ratio,color_range,color_space,color_transfer,color_primaries:stream_disposition=attached_pic:stream_side_data=rotation",
    "-of", "json", "-i", file,
  ];
  const result = spawnSync("ffprobe", args, { encoding: "utf8", windowsHide: true, timeout: 30000 });
  if (result.error) throw result.error;
  if (result.status !== 0 || result.stderr.trim()) throw new Error("FFprobe reported unreadable or malformed media");
  const data = JSON.parse(result.stdout) as { streams: ProbeStream[]; format?: { duration?: string; format_name?: string } };
  const stream = data.streams.find((item) => item.codec_type === "video" && !item.disposition?.attached_pic);
  if (!stream?.width || !stream.height || !stream.codec_name) throw new Error("Missing a readable image or primary video stream");
  const [n, d] = (stream.avg_frame_rate ?? "0/1").split("/").map(Number);
  const fps = n / d;
  const duration = Number(stream.duration ?? data.format?.duration);
  if (videoContainer && (!Number.isFinite(duration) || duration <= 0)) throw new Error("Video duration is missing or invalid");
  const rotation = stream.side_data_list?.find((entry) => entry.rotation !== undefined)?.rotation ?? 0;
  const rotated = Math.abs(rotation % 180) === 90;
  return {
    kind: videoContainer ? "video" as const : "image" as const,
    codec: stream.codec_name,
    codecProfile: stream.profile ?? null,
    container: data.format?.format_name ?? null,
    width: stream.width,
    height: stream.height,
    displayWidth: rotated ? stream.height : stream.width,
    displayHeight: rotated ? stream.width : stream.height,
    rotation,
    ...(stream.sample_aspect_ratio && !["1:1", "N/A", "0:1"].includes(stream.sample_aspect_ratio)
      ? { sampleAspectRatio: stream.sample_aspect_ratio } : {}),
    durationSeconds: videoContainer ? duration : null,
    fps: videoContainer && Number.isFinite(fps) && fps > 0 ? fps : null,
    audioStreams: data.streams.filter((item) => item.codec_type === "audio").length,
    color: {
      pixelFormat: stream.pix_fmt ?? null, range: stream.color_range ?? null,
      matrix: stream.color_space ?? null, transfer: stream.color_transfer ?? null, primaries: stream.color_primaries ?? null,
    },
  };
}

export function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}

export async function mediaDirectory(project: string, directory: string): Promise<string> {
  if (!isPortablePath(directory)) throw new Error("Asset directory must be a portable project-relative path");
  let current = project;
  for (const segment of directory.split("/")) {
    current = path.join(current, segment);
    if (!(await lstat(current)).isDirectory() || !isWithin(project, await realpath(current))) {
      throw new Error("Asset directory must stay inside the project and may not use links or junctions: " + directory);
    }
  }
  return current;
}

export async function mediaSha256(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export function copyWithoutAccessUpdate(files: { source: string; target: string }[]) {
  const helper = fileURLToPath(new URL("./snapshot-media.ps1", import.meta.url));
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", helper], {
    input: JSON.stringify(files), encoding: "utf8", windowsHide: true, timeout: 600000,
  });
  if (result.status !== 0) throw new Error("Access-preserving Windows scan failed: " + (result.error?.message ?? result.stderr.trim()));
  return JSON.parse(result.stdout) as { index: number; message: string }[];
}

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export async function scanProject(project: string, directory: string, scratchRoot: string) {
  const root = await mediaDirectory(project, directory);
  const diagnostics: Diagnostic[] = [];
  const candidates: { path: string; source: string; format: string }[] = [];

  async function list(folder: string, prefix: string) {
    const entries = await readdir(folder, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => compare(a.name, b.name))) {
      const relative = prefix + entry.name;
      const absolute = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) {
        diagnostics.push({ severity: "error", code: "linked-input", path: relative, message: "Linked inputs are skipped" });
      } else if (!isPortablePath(relative)) {
        diagnostics.push({ severity: "error", code: "nonportable-path", path: relative, message: "Use a Windows-compatible input name" });
      } else if (entry.isDirectory()) {
        await list(absolute, relative + "/");
      } else if (entry.isFile()) {
        const format = formats.get(path.extname(entry.name).toLowerCase());
        if (format) candidates.push({ path: relative, source: absolute, format });
        else diagnostics.push({ severity: "warning", code: "unsupported-extension", path: relative, message: "Ignored. Supported inputs are JPEG, PNG, WebP, MP4 and MOV" });
      }
    }
  }
  await list(root, "");
  candidates.sort((a, b) => compare(a.path, b.path));
  const paths = new Set<string>();
  for (const item of candidates) {
    const key = item.path.toLowerCase();
    if (paths.has(key)) diagnostics.push({ severity: "error", code: "case-collision", path: item.path, message: "Another input has this path with different casing" });
    paths.add(key);
  }
  const availability = spawnSync("ffprobe", ["-version"], { encoding: "utf8", windowsHide: true, timeout: 5000 });
  if (availability.status !== 0) throw new Error("FFprobe is required on PATH. Run ffprobe -version before scanning.");
  const tool = availability.stdout.split(/\r?\n/)[0].split(" Copyright")[0];

  const assets: ({ path: string; bytes: number; sha256: string; duplicateOf: string | null } & ReturnType<typeof probe>)[] = [];
  const hashes = new Map<string, string>();
  const windows = process.platform === "win32";
  const scratch = windows && candidates.length ? await mkdtemp(path.join(scratchRoot, ".probe-")) : null;
  const jobs = candidates.map((item, index) => ({ ...item, index, target: scratch ? path.join(scratch, String(index)) : item.source }));
  const snapshotFailures = new Map<number, string>();
  try {
    const originals = await Promise.all(jobs.map(async (item) => {
      try {
        const info = await lstat(item.source);
        if (info.isFile() && isWithin(root, await realpath(item.source))) return info;
      } catch {
        // Treat an input changed since enumeration as a failed candidate.
      }
      snapshotFailures.set(item.index, "Input is no longer a readable regular file inside the asset folder");
      return null;
    }));
    const eligible = jobs.filter((item) => !snapshotFailures.has(item.index));
    if (scratch && eligible.length) {
      const failures = copyWithoutAccessUpdate(eligible);
      for (const failure of failures) snapshotFailures.set(eligible[failure.index].index, failure.message);
    }
    for (const [i, item] of jobs.entries()) {
      const before = originals[i];
      const reason = snapshotFailures.get(i);
      if (!before || reason !== undefined) {
        diagnostics.push({ severity: "error", code: "unreadable-input", path: item.path, message: reason ?? "Input metadata was unavailable" });
        continue;
      }
      try {
        const media = probe(item.target, item.format);
        const hash = await mediaSha256(item.target);
        const { size } = await lstat(item.target);
        const after = await lstat(item.source);
        if (!after.isFile() || after.size !== before.size || after.mtimeMs !== before.mtimeMs || size !== before.size) {
          throw new Error("Input changed during the scan. Wait until the file has finished copying and retry");
        }
        const duplicateOf = hashes.get(hash) ?? null;
        if (duplicateOf) diagnostics.push({ severity: "warning", code: "exact-duplicate", path: item.path, message: "Same bytes as " + duplicateOf });
        else hashes.set(hash, item.path);
        if (Math.min(media.displayWidth, media.displayHeight) < 720) diagnostics.push({ severity: "warning", code: "low-resolution", path: item.path, message: "Short edge is below 720 pixels" });
        if (media.displayWidth / media.displayHeight < 0.4 || media.displayWidth / media.displayHeight > 2.5) {
          diagnostics.push({ severity: "warning", code: "extreme-aspect", path: item.path, message: "May need deliberate crop, padding or scrolling" });
        }
        if (!media.color.primaries || !media.color.transfer) diagnostics.push({ severity: "warning", code: "color-unverified", path: item.path, message: "Color primaries or transfer are absent from FFprobe metadata" });
        assets.push({ path: item.path, bytes: size, sha256: hash, duplicateOf, ...media });
      } catch (error) {
        const filesystemCode = (error as NodeJS.ErrnoException).code;
        const message = filesystemCode ? "Input or probe became unavailable (" + filesystemCode + "). Retry once the input is ready."
          : (error as Error).message;
        diagnostics.push({ severity: "error", code: "invalid-media", path: item.path, message });
      }
    }
  } finally {
    if (scratch) {
      for (const entry of await readdir(scratch)) await unlink(path.join(scratch, entry));
      await rmdir(scratch);
    }
  }
  if (!assets.length) diagnostics.push({ severity: "error", code: "no-assets", path: "", message: "No supported, readable screenshot or screen recording was found" });
  return {
    schemaVersion: "1" as const,
    assetDirectory: directory,
    analysis: { tool, mode: "metadata" as const, licensing: "unverified" as const, privacy: "unverified" as const },
    assets,
    diagnostics,
  };
}
