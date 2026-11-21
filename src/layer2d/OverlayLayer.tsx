import React, { useEffect, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { Look } from "../looks";
import { FONT_FAMILIES } from "../typography/fonts";
import { applyEase } from "../engine/time/ease";
import { EXIT_SECONDS, type CompiledFilm, type PlannedOverlay } from "../engine/compile/compile";
import { ChartView, CounterView } from "./dataviz/DataViews";
import { HudView } from "./hud/HudView";
import { elementBox, typeStyle } from "./layout";
import { TextView } from "./text/TextView";

/**
 * The 2D layer above the 3D stage. Each element lives in its own Sequence (local frame 0 = its
 * `at` time), positioned in the aspect's safe area, with a shared exit animation.
 * Nothing renders until web fonts are loaded, so text measurement is never done on a fallback font.
 */
function useFontsReady(look: Look): boolean {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Waiting for web fonts"));
  useEffect(() => {
    let alive = true;
    // document.fonts.ready can resolve before lazily-added faces start loading, so load every
    // (weight, family) the look's type roles use explicitly.
    const specs = new Set(Object.values(look.type).map((t) => `${t.weight} 32px ${FONT_FAMILIES[t.family]}`));
    Promise.all([...specs].map((s) => document.fonts.load(s)))
      .then(() => {
        const missing = [...specs].filter((s) => !document.fonts.check(s));
        if (missing.length) throw new Error(`Fonts failed to load: ${missing.join("; ")}`);
        if (alive) setReady(true);
      })
      .catch((err: Error) => cancelRender(err));
    return () => {
      alive = false;
    };
  }, [look]);
  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle]);
  return ready;
}

const ElementFrame: React.FC<{ o: PlannedOverlay; compiled: CompiledFilm }> = ({ o, compiled }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const el = o.element;
  const { style, width: boxWidth, align } = elementBox(el, { width, height });
  const exit = el.exit === "none" ? 0 : applyEase("smooth", frame / fps - (o.outSec - o.inSec), EXIT_SECONDS, fps);
  const shift = (el.exit === "rise" ? -1 : el.exit === "sink" ? 1 : 0) * exit * Math.min(width, height) * 0.03;
  const ctx = { look: compiled.look, palette: compiled.palette, grid: compiled.stage.grid };

  let content: React.ReactNode = null;
  if (el.kind === "text") content = <TextView el={el} look={compiled.look} palette={compiled.palette} boxWidth={boxWidth} align={align} seed={compiled.spec.seed} />;
  if (el.kind === "counter") content = <CounterView el={el} ctx={ctx} align={align} />;
  if (el.kind === "chart") content = <ChartView el={el} series={compiled.spec.data[el.data]} ctx={ctx} boxWidth={boxWidth} />;
  if (el.kind === "hud") content = <HudView el={el} look={compiled.look} palette={compiled.palette} boxWidth={boxWidth} />;

  const justify = align === "start" ? "flex-start" : align === "end" ? "flex-end" : "center";
  return (
    <div style={{ ...style, display: "flex", justifyContent: justify, opacity: 1 - exit }}>
      <div style={{ transform: `translateY(${shift}px)` }}>{content}</div>
    </div>
  );
};

export const OverlayLayer: React.FC<{ compiled: CompiledFilm }> = ({ compiled }) => {
  const { fps, width, height } = useVideoConfig();
  const ready = useFontsReady(compiled.look);
  if (!ready) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", ...typeStyle("body", compiled.look, { width, height }) }}>
      {compiled.overlays.map((o) => {
        const from = Math.round(o.inSec * fps);
        const end = Math.round(o.endSec * fps);
        return (
          <Sequence key={o.key} from={from} durationInFrames={Math.max(1, end - from)} layout="none" name={o.key}>
            <ElementFrame o={o} compiled={compiled} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
