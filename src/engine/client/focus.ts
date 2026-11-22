import { z } from "zod";

const unit = z.number().min(0).max(1);
const regionSchema = z.strictObject({ x: unit, y: unit, width: unit.positive(), height: unit.positive() })
  .refine(({ x, y, width, height }) => x + width <= 1 && y + height <= 1, "Region must remain inside the source");
const focusKey = z.strictObject({ at: unit, x: unit, y: unit, zoom: z.number().min(1).max(3) });

export const focusTrackSchema = z.array(focusKey).min(1).max(16)
  .refine((track) => track[0]?.at === 0 && track.every((key, i) => i === 0 || key.at > track[i - 1].at),
    "Focus must begin at zero and increase in shot order");

const emphasisSchema = z.strictObject({ from: unit, until: unit, region: regionSchema })
  .refine(({ from, until }) => until > from, "Emphasis must end after it starts");

export const shotDirectionSchema = z.strictObject({
  focus: focusTrackSchema.optional(),
  byRatio: z.strictObject({ "16:9": focusTrackSchema.optional(), "9:16": focusTrackSchema.optional(), "1:1": focusTrackSchema.optional() }).optional(),
  emphasis: z.array(emphasisSchema).max(6).optional(),
});

type Track = z.output<typeof focusTrackSchema>;
export type Focus = Pick<Track[number], "x" | "y" | "zoom">;
type Region = z.output<typeof regionSchema>;
export type ShotDirection = z.output<typeof shotDirectionSchema>;

export function focusAt(track: Track, phase: number): Focus {
  const next = track.findIndex((key) => key.at > phase);
  const a = track[next === -1 ? track.length - 1 : Math.max(0, next - 1)];
  if (next <= 0) return { x: a.x, y: a.y, zoom: a.zoom };
  const b = track[next];
  const t = (phase - a.at) / (b.at - a.at);
  const eased = t * t * (3 - 2 * t);
  const interpolate = (start: number, end: number) => start + (end - start) * eased;
  return { x: interpolate(a.x, b.x), y: interpolate(a.y, b.y), zoom: interpolate(a.zoom, b.zoom) };
}

export function projectEmphasis(geometry: { left: number; top: number; width: number; height: number;
  viewport: { width: number; height: number }; }, region: Region) {
  const { left, top, width, height } = {
    left: geometry.left + region.x * geometry.width,
    top: geometry.top + region.y * geometry.height,
    width: region.width * geometry.width,
    height: region.height * geometry.height,
  };
  const margin = 5;
  if (left < margin || top < margin || left + width > geometry.viewport.width - margin ||
      top + height > geometry.viewport.height - margin) return undefined;
  return { left, top, width, height };
}
