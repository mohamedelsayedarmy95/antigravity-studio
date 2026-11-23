import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { copyFile, mkdtemp, realpath, rm, unlink } from "node:fs/promises";
import path from "node:path";
import { isPortablePath } from "../../src/engine/client/brief";
import { copyWithoutAccessUpdate, editorialSource, isWithin, mediaSha256 } from "./client-media";

const sampleRate = 48000;
const channels = 2;
const audioRoot = "assets/audio";
const minLoudness = -60;
const maxLoudness = -10;
const maxTruePeak = -1;
const demuxers = new Map([
  [".wav", "wav"], [".mp3", "mp3"], [".m4a", "mov"], [".aac", "aac"], [".flac", "flac"],
  [".ogg", "ogg"], [".opus", "ogg"],
]);

interface AudioStream {
  codec_name?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
  time_base?: string;
  start_pts?: number;
  duration_ts?: number;
}

function run(tool: "ffmpeg" | "ffprobe", args: string[], action: string, report = false) {
  const result = spawnSync(tool, args, {
    encoding: "utf8", windowsHide: true, maxBuffer: 2 * 1024 * 1024, timeout: 600000,
  });
  if (result.error || result.status !== 0 || (!report && result.stderr.trim())) {
    throw new Error(action + ": " + (result.error?.message ?? (result.stderr.trim() || tool + " failed")));
  }
  return report ? result.stderr : result.stdout;
}

function localInput(file: string, demuxer: string) {
  return ["-protocol_whitelist", "file", "-f", demuxer, ...(demuxer === "mov" ? ["-enable_drefs", "0"] : []), "-i", file];
}

function audioStreams(file: string, demuxer: string, action: string) {
  const data = run("ffprobe", ["-v", "error", "-select_streams", "a", "-show_streams", "-show_entries",
    "stream=codec_name,sample_rate,channels,channel_layout,time_base,start_pts,duration_ts", "-of", "json", ...localInput(file, demuxer)], action);
  return (JSON.parse(data) as { streams: AudioStream[] }).streams;
}

function targetSamples(seconds: number) {
  const samples = Math.round(seconds * sampleRate);
  if (!Number.isSafeInteger(samples) || samples < 1) throw new Error("Editorial audio duration must be finite and positive");
  return samples;
}

export function verifyEditorialAudio(file: string, seconds: number) {
  const expected = targetSamples(seconds);
  const streams = audioStreams(file, "mov", "Cannot inspect prepared editorial audio");
  const stream = streams[0];
  if (streams.length !== 1 || stream.codec_name !== "aac" || Number(stream.sample_rate) !== sampleRate ||
      stream.channels !== channels || stream.channel_layout !== "stereo" || stream.time_base !== "1/" + sampleRate || stream.start_pts !== 0) {
    throw new Error("Editorial audio must be one 48 kHz stereo AAC stream starting at sample zero");
  }
  if (stream.duration_ts !== expected) {
    const reason = (stream.duration_ts ?? 0) < expected ? "Editorial audio bed is too short" : "Editorial audio exceeds the video duration";
    throw new Error(reason + " (expected " + expected + " samples, measured " + (stream.duration_ts ?? 0) + ")");
  }

  const analysis = run("ffmpeg", ["-nostdin", "-hide_banner", "-nostats", "-v", "info", "-xerror", "-err_detect", "explode",
    ...localInput(file, "mov"), "-map", "0:a:0", "-af", "ebur128=peak=true:framelog=verbose", "-f", "null", "-"],
  "Cannot decode editorial audio for loudness and true peak measurement", true);
  const integratedLufs = Number(/Integrated loudness:\s*I:\s*(\S+) LUFS/.exec(analysis)?.[1]);
  const truePeakDbtp = Number(/True peak:\s*Peak:\s*(\S+) dBFS/.exec(analysis)?.[1]);
  if (truePeakDbtp > maxTruePeak) {
    throw new Error("Editorial audio true peak is " + truePeakDbtp + " dBTP. Lower gainDb or supply a bed with at least 1 dB of true-peak headroom");
  }
  if (!Number.isFinite(integratedLufs) || integratedLufs < minLoudness || integratedLufs > maxLoudness) {
    throw new Error("Editorial audio loudness must be between " + minLoudness + " and " + maxLoudness + " LUFS. Adjust gainDb or choose a different bed");
  }
  if (!Number.isFinite(truePeakDbtp)) throw new Error("Could not measure editorial audio true peak");
  return {
    codec: "aac" as const, sampleRate, channels, startSeconds: 0, durationSeconds: expected / sampleRate,
    integratedLufs, truePeakDbtp, decoded: true as const,
  };
}

export interface EditorialSoundEffect {
  file: string;
  gainDb: number;
  /** Absolute start frame in the final picture; sample offset is derived from fps. */
  startFrame: number;
}

export async function prepareEditorialAudio(input: { project: string; scratch: string; file: string; gainDb: number;
  totalFrames: number; fps: number; effects?: readonly EditorialSoundEffect[] }) {
  const { file, gainDb, totalFrames, fps } = input;
  if (!isPortablePath(file)) throw new Error("Editorial audio must use a portable path relative to " + audioRoot);
  if (!Number.isFinite(gainDb) || gainDb < -24 || gainDb > 0) throw new Error("Editorial audio gainDb must be between -24 and 0");
  if (!Number.isSafeInteger(totalFrames) || !Number.isSafeInteger(fps) || totalFrames < 1 || fps < 1) {
    throw new Error("Editorial audio requires a positive frame count and frame rate");
  }
  const seconds = totalFrames / fps;
  const samples = targetSamples(seconds);
  const effects = input.effects ?? [];
  if (effects.length > 8) throw new Error("Editorial sound design supports up to eight cues");
  for (const effect of effects) {
    if (!isPortablePath(effect.file) || !demuxers.has(path.extname(effect.file).toLowerCase())) {
      throw new Error("Sound cue must use a portable local audio file in " + audioRoot);
    }
    if (!Number.isFinite(effect.gainDb) || effect.gainDb < -36 || effect.gainDb > 0) {
      throw new Error("Sound cue gainDb must be between -36 and 0");
    }
    if (!Number.isSafeInteger(effect.startFrame) || effect.startFrame < 0 || effect.startFrame >= totalFrames) {
      throw new Error("Sound cue startFrame must be within the final video");
    }
  }
  const demuxer = demuxers.get(path.extname(file).toLowerCase());
  if (!demuxer) throw new Error(file + ": use a local WAV, MP3, M4A, AAC, FLAC, Ogg or Opus audio file");
  const project = await realpath(input.project);
  const source = await editorialSource(project, "audio", file);
  const scratch = await realpath(input.scratch);
  if (isWithin(project, scratch)) throw new Error("Editorial audio scratch files must stay outside the input project");
  const work = await mkdtemp(path.join(scratch, "editorial-audio-"));
  const snapshot = path.join(work, "source");
  const output = path.join(work, "bed.m4a");
  try {
    if (process.platform === "win32") {
      const [failure] = copyWithoutAccessUpdate([{ source, target: snapshot }]);
      if (failure) throw new Error(file + ": " + failure.message);
    } else {
      await copyFile(source, snapshot, constants.COPYFILE_EXCL);
    }
    const sourceSha256 = await mediaSha256(snapshot);
    const streams = audioStreams(snapshot, demuxer, "Cannot inspect editorial audio " + file);
    if (!streams.length) throw new Error(file + ": no audio stream was found");
    const sourceArgs = ["-nostdin", "-v", "error", "-xerror", "-err_detect", "explode", ...localInput(snapshot, demuxer), "-map", "0:a:0"];
    run("ffmpeg", [...sourceArgs, "-f", "null", "-"], "Cannot fully decode editorial audio " + file);
    const effectSources: Array<{ file: string; sourceSha256: string; startFrame: number }> = [];
    const effectInputs: Array<{ snapshot: string; demuxer: string; samplesOffset: number; gainDb: number }> = [];
    for (const [index, effect] of effects.entries()) {
      const original = await editorialSource(project, "audio", effect.file);
      const effectSnapshot = path.join(work, `effect-${index}`);
      if (process.platform === "win32") {
        const [failure] = copyWithoutAccessUpdate([{ source: original, target: effectSnapshot }]);
        if (failure) throw new Error(effect.file + ": " + failure.message);
      } else {
        await copyFile(original, effectSnapshot, constants.COPYFILE_EXCL);
      }
      const format = demuxers.get(path.extname(effect.file).toLowerCase())!;
      if (!audioStreams(effectSnapshot, format, "Cannot inspect sound cue " + effect.file).length) {
        throw new Error(effect.file + ": no audio stream was found");
      }
      run("ffmpeg", ["-nostdin", "-v", "error", "-xerror", "-err_detect", "explode",
        ...localInput(effectSnapshot, format), "-map", "0:a:0", "-f", "null", "-"],
      "Cannot fully decode sound cue " + effect.file);
      effectInputs.push({ snapshot: effectSnapshot, demuxer: format,
        samplesOffset: Math.round(effect.startFrame * sampleRate / fps), gainDb: effect.gainDb });
      effectSources.push({ file: effect.file, sourceSha256: await mediaSha256(effectSnapshot), startFrame: effect.startFrame });
    }
    const fadeIn = Math.min(12000, Math.floor(samples / 4));
    const fadeOut = Math.min(24000, Math.floor(samples / 4));
    const fade = (type: "in" | "out", start: number, length: number) => `afade=t=${type}:ss=${start}:ns=${length}:curve=qsin`;
    const filters = [
      `aformat=sample_rates=${sampleRate}:channel_layouts=stereo`, `atrim=end_sample=${samples}`, "asetpts=N/SR/TB", `volume=${gainDb}dB`,
      ...(fadeIn ? [fade("in", 0, fadeIn), fade("out", samples - fadeOut, fadeOut)] : []),
    ];
    if (effectInputs.length === 0) {
      // Keep the historical bed-only FFmpeg path byte-for-byte compatible.
      run("ffmpeg", [...sourceArgs, "-n", "-af", filters.join(","), "-c:a", "aac", "-b:a", "192k", "-map_metadata", "-1",
        "-map_chapters", "-1", "-movie_timescale", String(sampleRate), "-use_editlist", "1", output], "Cannot prepare editorial audio " + file);
    } else {
      // Fully local, licensed clips are independently decoded then placed at sample-accurate shot offsets.
      // Bed and effects are mixed before the final fades; a restrained limiter guards summed transients.
      // End with the bed so the duration check can reject a short input instead of accepting a padded tail.
      const inputs = ["-nostdin", "-v", "error", "-xerror", "-err_detect", "explode",
        ...localInput(snapshot, demuxer),
        ...effectInputs.flatMap(({ snapshot: cueFile, demuxer: format }) => localInput(cueFile, format))];
      const graph = [
        `[0:a:0]aformat=sample_rates=${sampleRate}:channel_layouts=stereo,atrim=end_sample=${samples},asetpts=N/SR/TB,volume=${gainDb}dB[bed]`,
        ...effectInputs.map(({ gainDb: cueGain, samplesOffset }, index) =>
          `[${index + 1}:a:0]aformat=sample_rates=${sampleRate}:channel_layouts=stereo,asetpts=N/SR/TB,` +
          `volume=${cueGain}dB,adelay=delays=${samplesOffset}S:all=1[cue${index}]`),
        `[bed]${effectInputs.map((_, index) => `[cue${index}]`).join("")}amix=inputs=${effectInputs.length + 1}:duration=first:` +
          `dropout_transition=0:normalize=0,alimiter=limit=0.80:attack=5:release=50:level=0:latency=1,` +
          `atrim=end_sample=${samples},asetpts=N/SR/TB,` +
          [fade("in", 0, fadeIn), fade("out", samples - fadeOut, fadeOut)].join(",") + `[final]`,
      ].join(";");
      run("ffmpeg", [...inputs, "-n", "-filter_complex", graph, "-map", "[final]", "-c:a", "aac", "-b:a", "192k",
        "-map_metadata", "-1", "-map_chapters", "-1", "-movie_timescale", String(sampleRate), "-use_editlist", "1", output],
      "Cannot prepare editorial audio with sound cues " + file);
    }
    verifyEditorialAudio(output, seconds);
    await unlink(snapshot);
    return { file: output, sourceSha256, gainDb, sampleRate, channels, effects: effectSources };
  } catch (error) {
    await rm(work, { recursive: true, force: true });
    throw error;
  }
}

export async function muxEditorialAudio(input: { video: string; audio: string; output: string }): Promise<void> {
  run("ffmpeg", ["-nostdin", "-v", "error", "-xerror", "-n", ...localInput(input.video, "mov"), ...localInput(input.audio, "mov"),
    "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "copy", "-map_metadata", "-1", "-map_chapters", "-1",
    "-movflags", "+faststart", "-movie_timescale", String(sampleRate), "-use_editlist", "1", input.output], "Cannot mux editorial audio");
}
