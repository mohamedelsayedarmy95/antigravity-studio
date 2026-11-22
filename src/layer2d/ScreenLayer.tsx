import React from "react";
import { cancelRender, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CompiledFilm } from "../engine/compile/compile";
import { indexForFrame, screenFrameName, screenGeometry, type BoundScreen } from "../engine/client/screen";
import { editorialLayout, type EditorialBinding } from "../engine/client/editorial";
import { applyEase } from "../engine/time/ease";
import { aspectOf } from "./layout";
import { focusAt, projectEmphasis } from "../engine/client/focus";
import { editorialContinuityOpacity } from "../engine/client/shot-continuity";
import { studioScreenMotion, studioTapPosition, studioTapPulse } from "../engine/client/shot-recipes";

const ratio = { "16x9": "16:9", "9x16": "9:16", "1x1": "1:1" } as const;

export const ScreenLayer: React.FC<{ compiled: CompiledFilm; screens: Record<string, BoundScreen>; editorial?: EditorialBinding }> = ({ compiled, screens, editorial }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const sceneIndex = compiled.stage.scenes.findIndex((item) =>
    frame >= Math.round(item.start * fps) && frame < Math.round((item.start + item.length) * fps));
  if (sceneIndex < 0) return null;
  const scene = compiled.stage.scenes[sceneIndex];
  const continuity = editorial?.template === "studio-cut-v2" && editorial.motion === "expressive"
    ? editorialContinuityOpacity(compiled.stage.scenes, sceneIndex, frame / fps) : 1;
  const aspect = aspectOf(width, height);
  const layout = editorial && editorialLayout(aspect, { width, height }, scene.id, editorial.safeAreas, editorial.template, editorial.motion);
  const localFrame = frame - Math.round(scene.start * fps);
  const time = localFrame / fps;
  const directed = editorial?.template === "studio-cut-v2";
  if (layout?.logo && editorial) {
    const { left, top, width: w, height: h } = layout.logo;
    const plate = Math.min(w, h, Math.min(width, height) * 0.192);
    const arrive = applyEase(directed ? "smooth" : "expoOut", time, 0.46, fps);
    const expressiveLogo = directed && editorial.motion === "expressive";
    return <div style={{ position: "absolute", left: left + (w - plate) / 2, top: top + (h - plate) / 2,
      width: plate, height: plate, display: "grid", placeItems: "center", background: "#faf9f6", borderRadius: "24%",
      border: "1px solid white", boxShadow: "0 17px 60px #07122a7a",
      opacity: continuity,
      transform: `scale(${(expressiveLogo ? 0.86 : 0.9) + arrive * (expressiveLogo ? 0.14 : 0.1)})` }}>
      <Img src={staticFile(editorial.logoFile)} style={{ width: "66%", height: "66%", objectFit: "contain" }}
        onError={() => cancelRender(new Error("Cannot load the prepared editorial brand mark"))} />
    </div>;
  }
  const screen = screens[scene.id];
  if (!screen) return null;

  const index = indexForFrame(localFrame, screen.frameCount);
  const src = staticFile(screen.directory + "/" + (screen.stillFile ?? screenFrameName(index)));
  const phase = localFrame / Math.max(1, Math.round(scene.length * fps) - 1);
  const direction = editorial?.direction?.[scene.id];
  const track = direction?.byRatio?.[ratio[aspect]] ?? direction?.focus;
  const geometry = screenGeometry(width, height, screen.width, screen.height,
    screen.aspectPresentations?.[aspect] ?? screen.presentation, layout?.media, track && focusAt(track, phase));
  const motion = !editorial || directed || screen.frameCount > 1 ? 0 :
    (1 - applyEase("expoOut", time, 0.56, fps)) * (editorial.motion === "expressive" ? 12 : 7);
  const expressive = editorial?.template === "studio-cut-v2" && editorial.motion === "expressive";
  const recipe = expressive ? studioScreenMotion(scene.id, localFrame, Math.round(scene.length * fps),
    Math.min(width, height), fps) : undefined;
  const chrome: React.CSSProperties = editorial ? {
    background: "#fcfcfb", borderRadius: Math.min(width, height) * 0.024, transform: `translateY(${motion}px)`,
    boxShadow: `0 0 0 1.5px color-mix(in srgb, ${compiled.palette.primary} 23%, #f7f7fd), 0 20px 48px #18264c41`,
  } : {};
  return (
    <div data-factory-screen={scene.id} data-studio-recipe={recipe?.recipe}
      style={{ position: "absolute", ...geometry.viewport, overflow: "hidden", ...chrome,
        ...(recipe ? { transform: recipe.transform, willChange: "transform" } : {}) }}>
      <Img
        key={src}
        src={src}
        onError={() => cancelRender(new Error("Cannot load prepared screen image " + src))}
        onLoad={({ currentTarget }) => {
          if (currentTarget.naturalWidth !== screen.width || currentTarget.naturalHeight !== screen.height) {
            cancelRender(new Error("Prepared screen dimensions differ from its decoded image: " + src));
          }
        }}
        style={{
          position: "absolute", left: geometry.left, top: geometry.top,
          width: geometry.width, height: geometry.height, maxWidth: "none", clipPath: "inset(" + geometry.clip + ")",
        }}
      />
      {expressive && direction?.taps?.map((tap) => {
        // Explicit coordinates only; focus/crop transforms are evaluated for the same frame.
        const point = studioTapPosition(geometry, tap);
        if (!point) return null;
        const pulse = studioTapPulse(phase, tap.at);
        if (pulse.opacity <= 0) return null;
        const diameter = Math.max(24, Math.min(width, height) * 0.042);
        return <div key={`${tap.at}/${tap.x}/${tap.y}`} aria-hidden style={{
          position: "absolute", left: point.left - diameter / 2, top: point.top - diameter / 2,
          width: diameter, height: diameter, borderRadius: "50%", boxSizing: "border-box",
          border: `3px solid ${compiled.palette.primary}`, background: "#ffffff30",
          boxShadow: `0 0 0 2px #ffffffb5, 0 0 28px ${compiled.palette.primary}66`,
          opacity: pulse.opacity, transform: `scale(${pulse.scale})`, pointerEvents: "none",
        }} />;
      })}
      {direction?.emphasis?.map(({ from, until, region }) => {
        if (phase < from || phase >= until) return null;
        const projected = projectEmphasis(geometry, region);
        if (!projected) return null;
        const fade = Math.min(1, (phase - from) / 0.035, (until - phase) / 0.06);
        return <div key={`${from}/${region.x}/${region.y}`} aria-hidden style={{ position: "absolute", ...projected,
          borderRadius: 10, outline: `3px solid ${compiled.palette.primary}`, boxShadow: "0 0 0 3px #ffffffa0",
          opacity: fade * 0.87, pointerEvents: "none" }} />;
      })}
    </div>
  );
};
