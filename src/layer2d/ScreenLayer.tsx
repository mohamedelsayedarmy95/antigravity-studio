import React from "react";
import { cancelRender, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CompiledFilm } from "../engine/compile/compile";
import { indexForFrame, screenFrameName, screenGeometry, type BoundScreen } from "../engine/client/screen";
import { editorialLayout, type EditorialBinding } from "../engine/client/editorial";
import { applyEase } from "../engine/time/ease";
import { aspectOf } from "./layout";

export const ScreenLayer: React.FC<{ compiled: CompiledFilm; screens: Record<string, BoundScreen>; editorial?: EditorialBinding }> = ({ compiled, screens, editorial }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const scene = compiled.stage.scenes.find((item) =>
    frame >= Math.round(item.start * fps) && frame < Math.round((item.start + item.length) * fps));
  if (!scene) return null;
  const aspect = aspectOf(width, height);
  const layout = editorial && editorialLayout(aspect, { width, height }, scene.id, editorial.safeAreas);
  const time = (frame - Math.round(scene.start * fps)) / fps;
  if (layout?.logo && editorial) {
    const { left, top, width: w, height: h } = layout.logo;
    const plate = Math.min(w, h, Math.min(width, height) * 0.192);
    const arrive = applyEase("expoOut", time, 0.46, fps);
    return <div style={{ position: "absolute", left: left + (w - plate) / 2, top: top + (h - plate) / 2,
      width: plate, height: plate, display: "grid", placeItems: "center", background: "#faf9f6", borderRadius: "24%",
      border: "1px solid white", boxShadow: "0 17px 60px #07122a7a", transform: `scale(${0.9 + arrive * 0.1})` }}>
      <Img src={staticFile(editorial.logoFile)} style={{ width: "66%", height: "66%", objectFit: "contain" }}
        onError={() => cancelRender(new Error("Cannot load the prepared editorial brand mark"))} />
    </div>;
  }
  const screen = screens[scene.id];
  if (!screen) return null;

  const index = indexForFrame(frame - Math.round(scene.start * fps), screen.frameCount);
  const src = staticFile(screen.directory + "/" + (screen.stillFile ?? screenFrameName(index)));
  const geometry = screenGeometry(width, height, screen.width, screen.height,
    screen.aspectPresentations?.[aspect] ?? screen.presentation, layout?.media);
  const motion = !editorial || screen.frameCount > 1 ? 0 :
    (1 - applyEase("expoOut", time, 0.56, fps)) * (editorial.motion === "expressive" ? 12 : 7);
  const chrome: React.CSSProperties = editorial ? {
    background: "#fcfcfb", borderRadius: Math.min(width, height) * 0.024, transform: `translateY(${motion}px)`,
    boxShadow: `0 0 0 1.5px color-mix(in srgb, ${compiled.palette.primary} 23%, #f7f7fd), 0 20px 48px #18264c41`,
  } : {};
  return (
    <div data-factory-screen={scene.id} style={{ position: "absolute", ...geometry.viewport, overflow: "hidden", ...chrome }}>
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
    </div>
  );
};
