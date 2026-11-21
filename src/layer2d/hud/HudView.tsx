import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { applyEase } from "../../engine/time/ease";
import { appSpring } from "../../motion/springPresets";
import type { Look } from "../../looks";
import type { Palette } from "../../stage3d/schema";
import { cssColor, formatNumber, safeRect, typeStyle } from "../layout";
import type { HudElement } from "../schema";

/** HUD kit: corner brackets with a scan line, a rotating reticle, and a telemetry readout. */
export const HudView: React.FC<{ el: HudElement; look: Look; palette: Palette; boxWidth: number }> = ({ el, look, palette, boxWidth }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const unit = Math.min(width, height);
  const color = el.color ? cssColor(el.color, palette) : palette.primary;
  const label = typeStyle("label", look, { width, height });
  const t = frame / fps;

  if (el.preset === "brackets") {
    const w = boxWidth;
    const h = el.height * safeRect(width, height).h;
    const arm = Math.min(w, h) * 0.12;
    const draw = applyEase("expoOut", t, 0.6, fps);
    const sw = unit * 0.0022;
    const scanY = ((t * 0.45) % 1) * h;
    const corners: Array<[number, number, number, number]> = [
      [0, 0, 1, 1],
      [w, 0, -1, 1],
      [0, h, 1, -1],
      [w, h, -1, -1],
    ];
    return (
      <div style={{ position: "relative", width: w, height: h }}>
        <svg width={w} height={h} style={{ overflow: "visible", position: "absolute", inset: 0 }}>
          {corners.map(([cx, cy, sx, sy], i) => (
            <path
              key={i}
              d={`M ${cx} ${cy + sy * arm} L ${cx} ${cy} L ${cx + sx * arm} ${cy}`}
              fill="none"
              stroke={color}
              strokeWidth={sw}
              strokeDasharray={`${arm * 2 * draw} ${arm * 2}`}
              style={{ filter: `drop-shadow(0 0 ${sw * 2}px ${color})` }}
            />
          ))}
          <line x1={arm * 0.5} x2={w - arm * 0.5} y1={scanY} y2={scanY} stroke={color} strokeOpacity={0.18 * draw} strokeWidth={sw * 0.6} />
        </svg>
        {el.label ? <div style={{ ...label, color, position: "absolute", left: arm * 0.4, top: -label.fontSize * 1.8, opacity: draw }}>{el.label}</div> : null}
      </div>
    );
  }

  if (el.preset === "reticle") {
    const size = boxWidth;
    const c = size / 2;
    const s = Math.min(1.05, appSpring({ frame, fps, preset: look.spring }));
    const rot = t * 14;
    const sw = unit * 0.002;
    const ticks = Array.from({ length: 48 }, (_, i) => i);
    return (
      <svg width={size} height={size} style={{ overflow: "visible", transform: `scale(${s})`, opacity: Math.min(1, s) }}>
        <g transform={`rotate(${rot} ${c} ${c})`}>
          <circle cx={c} cy={c} r={c * 0.92} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={`${c * 0.5} ${c * 0.18}`} />
        </g>
        <g transform={`rotate(${-rot * 1.6} ${c} ${c})`}>
          {ticks.map((i) => {
            const a = (i / ticks.length) * Math.PI * 2;
            const r1 = c * 0.74;
            const r2 = c * (i % 4 === 0 ? 0.66 : 0.7);
            return <line key={i} x1={c + Math.cos(a) * r1} y1={c + Math.sin(a) * r1} x2={c + Math.cos(a) * r2} y2={c + Math.sin(a) * r2} stroke={color} strokeOpacity={0.6} strokeWidth={sw} />;
          })}
        </g>
        <circle cx={c} cy={c} r={c * 0.36} fill="none" stroke={palette.accent} strokeOpacity={0.8} strokeWidth={sw * 1.4} strokeDasharray={`${c * 0.15} ${c * 0.08}`} />
        <line x1={c - c * 0.2} x2={c + c * 0.2} y1={c} y2={c} stroke={palette.ink} strokeWidth={sw} />
        <line x1={c} x2={c} y1={c - c * 0.2} y2={c + c * 0.2} stroke={palette.ink} strokeWidth={sw} />
        <circle cx={c} cy={c} r={sw * 2.2} fill={palette.accent} />
      </svg>
    );
  }

  // telemetry
  const value = typeStyle("title", look, { width, height });
  return (
    <div style={{ width: boxWidth, borderLeft: `${unit * 0.003}px solid ${color}`, paddingLeft: unit * 0.018 }}>
      {el.label ? <div style={{ ...label, color, marginBottom: unit * 0.012 }}>{el.label}</div> : null}
      {el.rows.map((row, i) => {
        const delay = i * 4;
        const enter = Math.max(0, Math.min(1, appSpring({ frame, fps, preset: look.spring, delay })));
        const p = applyEase("expoOut", t - delay / fps, 1.1, fps);
        const shown = typeof row.value === "number" ? formatNumber(row.value * p, Number.isInteger(row.value) ? 0 : 1) : row.value;
        return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", opacity: enter, transform: `translateX(${(1 - enter) * -unit * 0.02}px)`, marginBottom: unit * 0.006 }}>
            <span style={{ ...label, color: palette.ink, opacity: 0.6 }}>{row.label}</span>
            <span style={{ ...value, fontFamily: label.fontFamily, color: palette.ink, fontVariantNumeric: "tabular-nums" }}>
              {shown}
              <span style={{ color: palette.accent }}>{row.suffix}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};
