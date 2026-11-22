import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { muxEditorialAudio, prepareEditorialAudio, verifyEditorialAudio } from "../scripts/lib/editorial-audio";

const toolsMissing = ["ffmpeg", "ffprobe"].some((tool) =>
  (spawnSync(tool, ["-version"], { windowsHide: true }).error as NodeJS.ErrnoException | undefined)?.code === "ENOENT");
const ffmpegTest = { skip: toolsMissing && "FFmpeg and FFprobe are required" };

async function fixtures(t: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), "factory audio "));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = path.join(root, "input");
  const audio = path.join(project, "assets", "audio");
  const scratch = path.join(root, "scratch");
  await mkdir(audio, { recursive: true });
  await mkdir(scratch);
  return { project, audio, scratch, totalFrames: 61, fps: 30 };
}

function tone(seconds: number, amplitude = 0.2, channels = 1) {
  const sampleRate = 44100;
  const samples = Math.round(sampleRate * seconds);
  const wav = Buffer.alloc(44 + samples * channels * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * channels * 2, 28);
  wav.writeUInt16LE(channels * 2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * channels * 2, 40);
  for (let i = 0; i < samples; i++) {
    const value = Math.round(amplitude * 32767 * Math.sin(2 * Math.PI * 440 * i / sampleRate));
    for (let channel = 0; channel < channels; channel++) {
      wav.writeInt16LE(value, 44 + (i * channels + channel) * 2);
    }
  }
  return wav;
}

function videoPackets(file: string) {
  return execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_packets", "-show_data_hash", "sha256",
    "-show_entries", "packet=pts,data_hash", "-of", "compact", file], { encoding: "utf8", windowsHide: true });
}

test("prepares a gain-adjusted AAC bed with sample-accurate duration and fades, then muxes the original video packets", ffmpegTest, async (t) => {
  const location = await fixtures(t);
  const file = "synthetic tone.wav";
  const source = path.join(location.audio, file);
  const wav = tone(3);
  await writeFile(source, wav);
  const old = new Date("2024-01-01T00:00:00Z");
  await utimes(source, old, old);
  const initial = await lstat(source);

  const prepared = await prepareEditorialAudio({ ...location, file, gainDb: -6 });
  assert.equal(prepared.sourceSha256, createHash("sha256").update(wav).digest("hex"));
  assert.deepEqual([prepared.sampleRate, prepared.channels, prepared.gainDb], [48000, 2, -6]);
  const unattenuated = await prepareEditorialAudio({ ...location, file, gainDb: 0 });
  const seconds = 61 / 30;
  const before = verifyEditorialAudio(unattenuated.file, seconds);
  const after = verifyEditorialAudio(prepared.file, seconds);
  assert.ok(Math.abs(before.integratedLufs - after.integratedLufs - 6) < 0.3);
  assert.ok(after.truePeakDbtp < -12);
  const sourceAfter = await lstat(source);
  assert.equal(sourceAfter.mtimeMs, initial.mtimeMs);
  if (process.platform === "win32") assert.equal(sourceAfter.atimeMs, initial.atimeMs);

  const pcm = execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-i", prepared.file, "-f", "f32le", "-"], {
    maxBuffer: 2 * 1024 * 1024, windowsHide: true,
  });
  function peak(start: number, end: number) {
    let value = 0;
    for (let i = start; i < end; i++) value = Math.max(value, Math.abs(pcm.readFloatLE(i * 8)));
    return value;
  }
  assert.ok(peak(0, 960) < peak(48000, 48960) * 0.15, "the bed fades in from the first sample");
  assert.ok(peak(96640, 97600) < peak(48000, 48960) * 0.15, "the bed fades out to the last sample");

  const video = path.join(location.scratch, "silent.mp4");
  const output = path.join(location.scratch, "combined.mp4");
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "color=c=black:s=64x64:r=30",
    "-frames:v", "61", "-c:v", "libx264", "-an", video], { windowsHide: true });
  await muxEditorialAudio({ video, audio: prepared.file, output });
  assert.deepEqual(verifyEditorialAudio(output, seconds), after);
  const audioProbe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries",
    "stream=codec_name,channels,channel_layout,sample_rate,start_pts,duration_ts", "-of", "json", output],
  { encoding: "utf8", windowsHide: true });
  assert.deepEqual(JSON.parse(audioProbe).streams, [{
    codec_name: "aac", channels: 2, channel_layout: "stereo", sample_rate: "48000", start_pts: 0, duration_ts: 97600,
  }]);
  assert.match(videoPackets(video), /SHA256:/);
  assert.equal(videoPackets(output), videoPackets(video));
});

test("rejects corrupt, non-audio, short, silent, and excessive-peak beds with actionable diagnostics", ffmpegTest, async (t) => {
  const location = await fixtures(t);
  const file = (name: string) => path.join(location.audio, name);
  await writeFile(file("corrupt.wav"), "not a WAV file");
  await writeFile(file("short.wav"), tone(0.25));
  await writeFile(file("silence.wav"), tone(3, 0));
  await writeFile(file("too-loud.wav"), tone(3, 0.99, 2));
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "color=c=black:s=64x64:r=30",
    "-frames:v", "1", "-c:v", "libx264", "-an", "-f", "mp4", file("no-audio.m4a")], { windowsHide: true });
  for (const [name, diagnostic] of [
    ["corrupt.wav", /decode|inspect/i], ["no-audio.m4a", /no audio stream/i],
    ["short.wav", /too short/i], ["silence.wav", /loudness/i], ["too-loud.wav", /true peak/i],
  ] as const) {
    await assert.rejects(prepareEditorialAudio({ ...location, file: name, gainDb: 0 }), diagnostic);
  }
});

test("rejects traversal, linked directories, and out-of-range gain", async (t) => {
  const location = await fixtures(t);
  await assert.rejects(prepareEditorialAudio({ ...location, file: "../escape.wav", gainDb: -6 }), /portable.*relative/i);
  await assert.rejects(prepareEditorialAudio({ ...location, file: "missing.wav", gainDb: 1 }), /gain.*-24.*0/i);
  await symlink(location.scratch, path.join(location.audio, "linked"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(prepareEditorialAudio({ ...location, file: "linked/outside.wav", gainDb: -6 }), /links or junctions/i);
});
