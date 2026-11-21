import React, { useId } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath, getLength, getPointAtLength } from "@remotion/paths";
import { applyEase } from "../../engine/time/ease";
import { lengthToSeconds } from "../../engine/time/timeRef";
import type { BeatGrid } from "../../engine/time/beatGrid";
import { appSpring } from "../../motion/springPresets";
import type { Look } from "../../looks";
import type { Palette } from "../../stage3d/schema";
import { cssColor, formatNumber, safeRect, typeStyle } from "../layout";
import type { ChartElement, CounterElement } from "../schema";

/**
 * Data-viz: rolling counters and SVG charts (line, area, bar, ring, sparkline) that draw on from
 * data. Pure functions of the local frame; no chart library, so every path is ours and deterministic.
 */

interface Ctx {
  look: Look;
  palette: Palette;
  grid: BeatGrid;
}

/** Monotone cubic (Fritsch–Carlson) path through points: smooth, never overshoots the data. */
export function monotonePath(pts: Array<[number, number]>): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0][0]} ${pts[0][1]}` : "";
  const n = pts.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    slope.push((pts[i + 1][1] - pts[i][1]) / dx[i]);
  }
  const m: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) m.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  m.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * slope[i];
      m[i + 1] = tau * b * slope[i];
    }
  }
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C ${pts[i][0] + h} ${pts[i][1] + m[i] * h} ${pts[i + 1][0] - h} ${pts[i + 1][1] - m[i + 1] * h} ${pts[i + 1][0]} ${pts[i + 1][1]}`;
  }
  return d;
}

export const CounterView: React.FC<{ el: CounterElement; ctx: Ctx; align: "start" | "center" | "end" }> = ({ el, ctx, align }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const p = applyEase(el.ease, frame / fps, lengthToSeconds(el.length, fps, ctx.grid), fps);
  const value = el.from + (el.to - el.from) * p;
  const enter = Math.min(1, appSpring({ frame, fps, preset: ctx.look.spring }));
  const ink = el.color ? cssColor(el.color, ctx.palette) : ctx.palette.ink;
  const textAlign = align === "start" ? "left" : align === "end" ? "right" : "center";
  const num = typeStyle(el.role, ctx.look, { width, height });
  return (
    <div style={{ textAlign, opacity: enter, transform: `translateY(${(1 - enter) * num.fontSize * 0.2}px)` }}>
      <div style={{ ...num, color: ink, whiteSpace: "nowrap" }}>
        {el.prefix}
        {formatNumber(value, el.decimals)}
        <span style={{ color: ctx.palette.accent }}>{el.suffix}</span>
      </div>
      {el.label ? <div style={{ ...typeStyle("label", ctx.look, { width, height }), color: ctx.palette.primary, marginTop: num.fontSize * 0.12 }}>{el.label}</div> : null}
    </div>
  );
};

export const ChartView: React.FC<{ el: ChartElement; series: number[]; ctx: Ctx; boxWidth: number }> = ({ el, series, ctx, boxWidth }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const gradientId = `chart-${useId().replace(/:/g, "_")}`;
  const unit = Math.min(width, height);
  const color = el.color ? cssColor(el.color, ctx.palette) : ctx.palette.primary;
  const ink = ctx.palette.ink;
  const p = applyEase("expoOut", frame / fps, lengthToSeconds(el.length, fps, ctx.grid), fps);
  const label = el.label ? (
    <div style={{ ...typeStyle("label", ctx.look, { width, height }), color: ctx.palette.primary, marginBottom: unit * 0.012 }}>{el.label}</div>
  ) : null;
  const valueStyle = { ...typeStyle("title", ctx.look, { width, height }), color: ink, fontVariantNumeric: "tabular-nums" as const };

  if (el.chart === "ring") {
    const size = boxWidth;
    const stroke = size * 0.075;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const value = series[series.length - 1];
    const frac = Math.max(0, Math.min(1, value / el.max)) * p;
    return (
      <div style={{ width: size, position: "relative" }}>
        {label}
        <svg width={size} height={size} style={{ overflow: "visible" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ink} strokeOpacity={0.12} strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circ * frac} ${circ}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ filter: `drop-shadow(0 0 ${stroke * 0.6}px ${color})` }}
          />
        </svg>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: size / 2 - valueStyle.fontSize * 0.6, textAlign: "center", ...valueStyle }}>
          {formatNumber(value * p, 0)}
          <span style={{ color: ctx.palette.accent }}>{el.suffix}</span>
        </div>
      </div>
    );
  }

  const w = boxWidth;
  const h = el.height * safeRect(width, height).h;
  const pad = unit * 0.01;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const x = (i: number) => (series.length === 1 ? w / 2 : (i / (series.length - 1)) * w);
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - 2 * pad);

  if (el.chart === "bar") {
    const slot = w / series.length;
    const barW = slot * 0.62;
    const floor = Math.min(0, min);
    const top = Math.max(...series, 0);
    const yb = (v: number) => (1 - (v - floor) / (top - floor || 1)) * h;
    return (
      <div style={{ width: w }}>
        {label}
        <svg width={w} height={h} style={{ overflow: "visible" }}>
          <line x1={0} x2={w * p} y1={h} y2={h} stroke={ink} strokeOpacity={0.25} strokeWidth={1.5} />
          {series.map((v, i) => {
            const grow = Math.max(0, Math.min(1.08, appSpring({ frame, fps, preset: ctx.look.spring, delay: i * 3 })));
            const barTop = h - (h - yb(v)) * grow;
            return <rect key={i} x={i * slot + (slot - barW) / 2} y={barTop} width={barW} height={h - barTop} rx={barW * 0.12} fill={color} fillOpacity={0.35 + 0.65 * (i / Math.max(1, series.length - 1))} />;
          })}
        </svg>
      </div>
    );
  }

  // line / area / sparkline
  const pts = series.map((v, i) => [x(i), y(v)] as [number, number]);
  const d = monotonePath(pts);
  const total = getLength(d);
  const evolved = evolvePath(p, d);
  const head = getPointAtLength(d, Math.max(0.001, total * p)) ?? { x: pts[0][0], y: pts[0][1] };
  const spark = el.chart === "sparkline";
  const strokeW = unit * (spark ? 0.0028 : 0.0042);
  const valueAtP = series.length === 1 ? series[0] : (() => {
    const f = p * (series.length - 1);
    const i = Math.min(series.length - 2, Math.floor(f));
    return series[i] + (series[i + 1] - series[i]) * (f - i);
  })();
  // Live value sits at the right of the label row: never collides with the curve or the label.
  const header =
    el.label || (el.showValue && !spark) ? (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: unit * 0.012 }}>
        <div style={{ ...typeStyle("label", ctx.look, { width, height }), color: ctx.palette.primary }}>{el.label ?? ""}</div>
        {el.showValue && !spark ? (
          <div style={{ ...valueStyle, whiteSpace: "nowrap" }}>
            {formatNumber(valueAtP, 0)}
            <span style={{ color: ctx.palette.accent }}>{el.suffix}</span>
          </div>
        ) : null}
      </div>
    ) : null;
  return (
    <div style={{ width: w }}>
      {header}
      <div style={{ position: "relative" }}>
        <svg width={w} height={h} style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <clipPath id={`${gradientId}-clip`}>
              <rect x={0} y={-h} width={head.x} height={h * 3} />
            </clipPath>
          </defs>
          {!spark &&
            [0, 0.5, 1].map((g) => (
              <line key={g} x1={0} x2={w * Math.min(1, p * 1.4)} y1={pad + g * (h - 2 * pad)} y2={pad + g * (h - 2 * pad)} stroke={ink} strokeOpacity={0.08} strokeWidth={1} />
            ))}
          {el.chart === "area" && <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${gradientId})`} clipPath={`url(#${gradientId}-clip)`} />}
          <path
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={evolved.strokeDasharray}
            strokeDashoffset={evolved.strokeDashoffset}
            style={{ filter: `drop-shadow(0 0 ${strokeW * 2.5}px ${color})` }}
          />
          <circle cx={head.x} cy={head.y} r={strokeW * 1.9} fill={ink} opacity={p > 0.01 ? 1 : 0} style={{ filter: `drop-shadow(0 0 ${strokeW * 3}px ${color})` }} />
        </svg>
      </div>
    </div>
  );
};
