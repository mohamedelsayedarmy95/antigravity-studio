import { spawnSync } from "node:child_process";
import type { AspectId } from "../../src/stage3d/schema";

type Shot = { id: string; startFrame: number; durationFrames: number };

/** Three distinct moments for the owner's fast visual review of an encoded master. */
export function masterReviewFrames(shots: readonly Shot[]): [number, number, number] {
  const choose = (id: string) => {
    const shot = shots.find((entry) => entry.id === id);
    if (!shot || !Number.isSafeInteger(shot.startFrame) || !Number.isSafeInteger(shot.durationFrames) ||
        shot.startFrame < 0 || shot.durationFrames < 1) {
      throw new Error("Cannot prepare master contact sheet: missing or invalid " + id + " shot");
    }
    return shot.startFrame + Math.floor((shot.durationFrames - 1) / 2);
  };
  const frames: [number, number, number] = [choose("hook"), choose("feature-1"), choose("cta")];
  if (!(frames[0] < frames[1] && frames[1] < frames[2])) {
    throw new Error("Master review frames must be strictly increasing");
  }
  return frames;
}

const REVIEW_SIZE: Record<AspectId, readonly [number, number]> = {
  "16x9": [480, 270], "9x16": [270, 480], "1x1": [360, 360],
};

/**
 * Decode the delivered H.264 rather than pre-encode source frames. These are
 * post-encode, mobile-size inspection images, NOT a simulated social re-encode.
 * Runs once per aspect for a full master, not during previews/stills.
 */
export function makeMasterReviewSheet(video: string, destination: string, aspect: AspectId, frames: readonly number[]) {
  if (frames.length !== 3 || frames.some((f) => !Number.isSafeInteger(f) || f < 0) ||
      !(frames[0] < frames[1] && frames[1] < frames[2])) {
    throw new Error("Master review needs three increasing nonnegative frame indices");
  }
  const [w, h] = REVIEW_SIZE[aspect];
  if (!w || !h) throw new Error("Unsupported review aspect: " + aspect);
  const select = frames.map((f) => `eq(n\\,${f})`).join("+");
  const filter = `select=${select},scale=${w}:${h}:flags=lanczos,setsar=1,tile=3x1:nb_frames=3:margin=10:padding=10:color=0x151821`;
  const result = spawnSync("ffmpeg", ["-nostdin", "-v", "error", "-xerror", "-threads", "1", "-i", video,
    "-map", "0:v:0", "-an", "-sn", "-dn", "-vf", filter, "-frames:v", "1", "-y", destination],
    { encoding: "utf8", windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error("Master review contact sheet failed: " + (result.error?.message ?? (result.stderr.trim() || "ffmpeg failed")));
  }
}
