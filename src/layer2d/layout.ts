import type React from "react";
import { FONT_FAMILIES } from "../typography/localFonts";
import type { Look } from "../looks";
import { ASPECTS, type AspectId, type ColorRef, type Palette } from "../stage3d/schema";
import type { Anchor, OverlayElement, TypeRole } from "./schema";

/**
 * Safe areas per aspect (fractions of the frame). Vertical formats reserve more top/bottom room
 * for platform UI (captions, buttons, handles).
 */
export const SAFE_ZONES: Record<AspectId, { top: number; right: number; bottom: number; left: number }> = {
  "16x9": { top: 0.08, right: 0.06, bottom: 0.08, left: 0.06 },
  "9x16": { top: 0.12, right: 0.07, bottom: 0.17, left: 0.07 },
  "1x1": { top: 0.08, right: 0.07, bottom: 0.08, left: 0.07 },
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Closest registered aspect for a frame size. */
export function aspectOf(width: number, height: number): AspectId {
  const r = width / height;
  return (Object.keys(ASPECTS) as AspectId[]).reduce((best, id) =>
    Math.abs(ASPECTS[id].width / ASPECTS[id].height - r) < Math.abs(ASPECTS[best].width / ASPECTS[best].height - r) ? id : best,
  );
}

export function safeRect(width: number, height: number): Rect {
  const z = SAFE_ZONES[aspectOf(width, height)];
  return { x: width * z.left, y: height * z.top, w: width * (1 - z.left - z.right), h: height * (1 - z.top - z.bottom) };
}

const H_ANCHOR: Record<Anchor, "start" | "center" | "end"> = {
  center: "center", top: "center", bottom: "center", left: "start", right: "end",
  topLeft: "start", topRight: "end", bottomLeft: "start", bottomRight: "end",
};
const V_ANCHOR: Record<Anchor, "start" | "center" | "end"> = {
  center: "center", top: "start", bottom: "end", left: "center", right: "center",
  topLeft: "start", topRight: "start", bottomLeft: "end", bottomRight: "end",
};

/** Absolute CSS box for an element: anchored in the safe area, offset in safe-area fractions. */
export function elementBox(el: OverlayElement, frame: { width: number; height: number }): { style: React.CSSProperties; width: number; align: "start" | "center" | "end" } {
  const safe = safeRect(frame.width, frame.height);
  const width = el.width * safe.w;
  const [ox, oy] = el.offset;
  const h = H_ANCHOR[el.anchor];
  const v = V_ANCHOR[el.anchor];
  const left = h === "start" ? safe.x : h === "center" ? safe.x + (safe.w - width) / 2 : safe.x + safe.w - width;
  const style: React.CSSProperties = { position: "absolute", left: left + ox * safe.w, width };
  if (v === "start") style.top = safe.y + oy * safe.h;
  if (v === "center") {
    style.top = safe.y + safe.h / 2 + oy * safe.h;
    style.transform = "translateY(-50%)";
  }
  if (v === "end") style.bottom = frame.height - (safe.y + safe.h) - oy * safe.h;
  return { style, width, align: el.align ?? h };
}

/** Type style for a role, scaled to the frame's short side. */
export function typeStyle(role: TypeRole, look: Look, frame: { width: number; height: number }, scale = 1): React.CSSProperties & { fontSize: number } {
  const t = look.type[role];
  return {
    fontFamily: FONT_FAMILIES[t.family],
    fontWeight: t.weight,
    fontSize: t.size * Math.min(frame.width, frame.height) * scale,
    letterSpacing: `${t.tracking}em`,
    lineHeight: t.lineHeight,
    textTransform: t.uppercase ? "uppercase" : undefined,
    fontVariantNumeric: role === "numeric" || role === "label" ? "tabular-nums" : undefined,
  };
}

/** "#rrggbb" or "palette.role" → CSS color (sRGB hex). */
export const cssColor = (ref: ColorRef, palette: Palette) =>
  ref.startsWith("palette.") ? palette[ref.slice(8) as keyof Palette] : ref;

/** Fixed-format number (no locale dependence): thousands separators, fixed decimals. */
export function formatNumber(value: number, decimals: number): string {
  const sign = value < 0 ? "-" : "";
  const [int, frac] = Math.abs(value).toFixed(decimals).split(".");
  return sign + int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac ? `.${frac}` : "");
}
