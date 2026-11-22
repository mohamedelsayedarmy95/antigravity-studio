import { z } from "zod";
import type { AspectId } from "../../stage3d/schema";
import type { Focus } from "./focus";

const coordinate = z.number().min(0).max(1);
export const presentationSchema = z.strictObject({
  fit: z.enum(["contain", "cover"]).default("contain"),
  crop: z.strictObject({ x: coordinate, y: coordinate, width: coordinate.positive(), height: coordinate.positive() })
    .refine((rect) => rect.x + rect.width <= 1 && rect.y + rect.height <= 1, "Crop must stay inside the source").optional(),
  focal: z.strictObject({ x: coordinate, y: coordinate }).optional(),
});
export type ScreenPresentation = z.output<typeof presentationSchema>;
export const defaultPresentation: ScreenPresentation = { fit: "contain" };

export interface BoundScreen {
  directory: string;
  frameCount: number;
  stillFile?: string;
  width: number;
  height: number;
  presentation: ScreenPresentation;
  aspectPresentations?: Partial<Record<AspectId, ScreenPresentation>>;
}

export function screenViewport(frameWidth: number, frameHeight: number) {
  const tall = frameHeight > frameWidth;
  return {
    left: frameWidth * 0.085, top: frameHeight * (tall ? 0.26 : 0.235),
    width: frameWidth * 0.83, height: frameHeight * (tall ? 0.49 : 0.53),
  };
}

export function screenGeometry(frameWidth: number, frameHeight: number, sourceWidth: number, sourceHeight: number, presentation: ScreenPresentation,
  editorialSlot?: ReturnType<typeof screenViewport>, focus?: Focus) {
  const slot = editorialSlot ?? screenViewport(frameWidth, frameHeight);
  const crop = presentation.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const focal = focus ? { x: (focus.x - crop.x) / crop.width, y: (focus.y - crop.y) / crop.height } :
    presentation.focal ?? { x: 0.5, y: 0.5 };
  const sw = sourceWidth * crop.width;
  const sh = sourceHeight * crop.height;
  const choose = presentation.fit === "cover" ? Math.max : Math.min;
  const baseScale = choose(slot.width / sw, slot.height / sh);
  const scale = baseScale * (focus?.zoom ?? 1);
  const viewport = editorialSlot && presentation.fit === "contain" ? {
    left: slot.left + (slot.width - sw * baseScale) / 2, top: slot.top + (slot.height - sh * baseScale) / 2,
    width: sw * baseScale, height: sh * baseScale,
  } : slot;
  const offset = (slot: number, fitted: number, point: number) =>
    fitted <= slot ? (slot - fitted) / 2 : Math.max(slot - fitted, Math.min(0, slot / 2 - point * fitted));
  return {
    viewport,
    left: offset(viewport.width, sw * scale, focal.x) - crop.x * sourceWidth * scale,
    top: offset(viewport.height, sh * scale, focal.y) - crop.y * sourceHeight * scale,
    width: sourceWidth * scale,
    height: sourceHeight * scale,
    clip: [crop.y, 1 - crop.x - crop.width, 1 - crop.y - crop.height, crop.x].map((part) => Math.max(0, part) * 100 + "%").join(" "),
  };
}

/** A frame is in a trim when its composition-rate source timestamp is in [start, end). */
export function sourceFrames(range: { startSeconds: number; endSeconds: number }, fps: number, shotLength: number) {
  const toFrame = (seconds: number) => Math.ceil(seconds * fps - 1e-9);
  const start = toFrame(range.startSeconds);
  const end = Math.min(toFrame(range.endSeconds), start + shotLength);
  if (start >= end) throw new Error("The trim contains no frame at the composition frame rate");
  return { start, end };
}

export const indexForFrame = (frame: number, count: number) => Math.max(0, Math.min(frame, count - 1));
export const screenFrameName = (index: number) => String(index).padStart(6, "0") + ".png";
