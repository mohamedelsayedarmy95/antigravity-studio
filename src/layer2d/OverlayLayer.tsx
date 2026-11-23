import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { loadLocalFonts } from "../typography/localFonts";
import { applyEase } from "../engine/time/ease";
import { EXIT_SECONDS, type CompiledFilm, type PlannedOverlay } from "../engine/compile/compile";
import { ChartView, CounterView } from "./dataviz/DataViews";
import { HudView } from "./hud/HudView";
import { aspectOf, elementBox, safeRect, typeStyle } from "./layout";
import { screenViewport } from "../engine/client/screen";
import { editorialLayout, type EditorialBinding } from "../engine/client/editorial";
import { TextView } from "./text/TextView";
import { editorialContinuityOpacity } from "../engine/client/shot-continuity";

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

const ElementFrame: React.FC<{ o: PlannedOverlay; compiled: CompiledFilm; checkScreenClearance?: boolean; editorial?: EditorialBinding; flow?: boolean }> = ({
  o, compiled, checkScreenClearance, editorial, flow,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const el = o.element;
  const box = useRef<HTMLDivElement>(null);
  const layout = editorial && editorialLayout(aspectOf(width, height), { width, height }, o.sceneId, editorial.safeAreas, editorial.template, editorial.motion);
  const regionId = el.id === "result-headline" ? "headline" : el.id === "result-body" ? "body" : el.id;
  const region = layout && (regionId === "eyebrow" || regionId === "headline" || regionId === "body" || regionId === "action") ? layout[regionId] : undefined;
  useLayoutEffect(() => {
    if (!checkScreenClearance || !box.current) return;
    const film = box.current.closest("[data-factory-film]")?.getBoundingClientRect();
    if (!film) return;
    const scale = film.width / width;
    const content = box.current.getBoundingClientRect();
    if (region) {
      const groupHeight = flow ? (box.current.closest("[data-editorial-copy]")?.getBoundingClientRect().height ?? 0) / scale : 0;
      const available = layout ? layout.body.top + layout.body.height - layout.eyebrow.top : 0;
      if (content.height / scale > region.height + 1 || box.current.scrollWidth > region.width + 1 || groupHeight > available + 1) {
        cancelRender(new Error(`Copy exceeds the ${el.id} editorial region in ${o.sceneId} (${width}x${height}). Shorten the brief text.`));
      }
      return;
    }
    const safe = safeRect(width, height);
    const slot = screenViewport(width, height);
    const top = (content.top - film.top) / scale;
    const bottom = (content.bottom - film.top) / scale;
    const left = (content.left - film.left) / scale;
    const right = (content.right - film.left) / scale;
    const tolerance = 1;
    if (top < safe.y - tolerance || bottom > safe.y + safe.h + tolerance ||
        left < safe.x - tolerance || right > safe.x + safe.w + tolerance ||
        (el.anchor === "top" && bottom > slot.top - 10) ||
        (el.anchor === "bottom" && top < slot.top + slot.height + 10)) {
      cancelRender(new Error("Copy exceeds the factory safe area for " + o.sceneId + " (" + width + "x" + height + "). Shorten the brief text."));
    }
  });
  const { style, width: boxWidth, align } = region && layout ? {
    style: flow ? { width: region.width } : { position: "absolute" as const, top: region.top, left: region.left, width: region.width },
    width: region.width, align: layout.align,
  } : elementBox(el, { width, height });
  const exit = el.exit === "none" ? 0 : applyEase("smooth", frame / fps - (o.outSec - o.inSec), EXIT_SECONDS, fps);
  const directed = editorial?.template === "studio-cut-v2" && editorial.motion === "expressive";
  const sceneIndex = directed ? compiled.stage.scenes.findIndex((s) => s.id === o.sceneId) : -1;
  const continuity = directed
    ? editorialContinuityOpacity(compiled.stage.scenes, sceneIndex, (Math.round(o.inSec * fps) + frame) / fps) : 1;
  const shift = (el.exit === "rise" ? -1 : el.exit === "sink" ? 1 : 0) * exit * Math.min(width, height) * 0.03;
  const ctx = { look: compiled.look, palette: compiled.palette, grid: compiled.stage.grid };

  let content: React.ReactNode = null;
  if (el.kind === "text") content = <TextView el={el} look={compiled.look} palette={compiled.palette} boxWidth={boxWidth} align={align} seed={compiled.spec.seed} />;
  if (el.kind === "counter") content = <CounterView el={el} ctx={ctx} align={align} />;
  if (el.kind === "chart") content = <ChartView el={el} series={compiled.spec.data[el.data]} ctx={ctx} boxWidth={boxWidth} />;
  if (el.kind === "hud") content = <HudView el={el} look={compiled.look} palette={compiled.palette} boxWidth={boxWidth} />;

  const justify = align === "start" ? "flex-start" : align === "end" ? "flex-end" : "center";
  const action = el.id === "action" && editorial?.template === "studio-cut-v2";
  const pill = action ? { padding: "11px 29px", border: "1.5px solid #eef3fa", borderRadius: 100,
    backgroundColor: "#deebfa",
    ...(editorial?.motion === "expressive" ? { boxShadow: "0 12px 34px #050e2640" } : {}) } : undefined;
  return (
    <div style={{ ...style, display: "flex", justifyContent: justify, opacity: (1 - exit) * continuity }}>
      <div ref={box} style={{ transform: `translateY(${shift}px)`, ...pill }}>{content}</div>
    </div>
  );
};

type OverlayProps = { compiled: CompiledFilm; checkScreenClearance?: boolean; editorial?: EditorialBinding };

const LoadedOverlay: React.FC<OverlayProps> = ({ compiled, checkScreenClearance, editorial }) => {
  const { fps, width, height } = useVideoConfig();
  const ready = useFontsReady();
  if (!ready) return null;
  const show = (o: PlannedOverlay, flow = false) => {
    const from = Math.round(o.inSec * fps);
    let end = Math.round(o.endSec * fps);
    // Compiler closes exit:none copy when the 3D transition starts. Keep it until the
    // nominal cut, fading on the same window as the product screen, not vanishing abruptly.
    if (editorial?.template === "studio-cut-v2" && editorial.motion === "expressive" && o.element.exit === "none" && o.element.out === undefined) {
      const index = compiled.stage.scenes.findIndex((s) => s.id === o.sceneId);
      const next = compiled.stage.scenes[index + 1];
      if (next?.transitionIn && Math.abs(o.endSec - next.transitionIn.start) < 1 / fps) {
        end = Math.round(next.start * fps);
      }
    }
    return (
      <Sequence key={o.key} from={from} durationInFrames={Math.max(1, end - from)} layout="none" name={o.key}>
        <ElementFrame o={o} compiled={compiled} checkScreenClearance={checkScreenClearance} editorial={editorial} flow={flow} />
      </Sequence>
    );
  };
  return (
    <AbsoluteFill style={{ pointerEvents: "none", ...typeStyle("body", compiled.look, { width, height }) }}>
      {editorial ? compiled.stage.scenes.map((scene) => {
        const overlays = compiled.overlays.filter((o) => o.sceneId === scene.id);
        if (scene.id === "cta") return overlays.map((overlay) => show(overlay));
        const { eyebrow } = editorialLayout(aspectOf(width, height), { width, height }, scene.id, editorial.safeAreas, editorial.template, editorial.motion);
        return (
          <div key={scene.id} data-editorial-copy="" style={{ position: "absolute", left: eyebrow.left, top: eyebrow.top, width: eyebrow.width,
            display: "flex", flexDirection: "column", gap: Math.min(width, height) * 0.021 }}>
            {overlays.map((overlay) => show(overlay, true))}
          </div>
        );
      }) : compiled.overlays.map((overlay) => show(overlay))}
    </AbsoluteFill>
  );
};

export const OverlayLayer: React.FC<OverlayProps> = (props) =>
  props.compiled.overlays.length > 0 ? <LoadedOverlay {...props} /> : null;
