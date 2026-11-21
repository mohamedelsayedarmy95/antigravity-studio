import React, { useEffect, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { loadLocalFonts } from "../typography/localFonts";
import { applyEase } from "../engine/time/ease";
import { EXIT_SECONDS, type CompiledFilm, type PlannedOverlay } from "../engine/compile/compile";
import { ChartView, CounterView } from "./dataviz/DataViews";
import { HudView } from "./hud/HudView";
import { elementBox, typeStyle } from "./layout";
import { TextView } from "./text/TextView";

/**
 * The 2D layer above the 3D stage. Each element lives in its own Sequence (local frame 0 = its
 * `at` time), positioned in the aspect's safe area, with a shared exit animation.
 * Text waits for the bundled fonts before it is measured.
 */
function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Waiting for bundled typography fonts"));
  useEffect(() => {
    let alive = true;
    loadLocalFonts(document)
      .then(() => {
        if (alive) setReady(true);
      })
      .catch((err: Error) => {
        if (alive) cancelRender(err);
      });
    return () => {
      alive = false;
    };
  }, []);
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

const LoadedOverlay: React.FC<{ compiled: CompiledFilm }> = ({ compiled }) => {
  const { fps, width, height } = useVideoConfig();
  const ready = useFontsReady();
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

export const OverlayLayer: React.FC<{ compiled: CompiledFilm }> = ({ compiled }) =>
  compiled.overlays.length > 0 ? <LoadedOverlay compiled={compiled} /> : null;
