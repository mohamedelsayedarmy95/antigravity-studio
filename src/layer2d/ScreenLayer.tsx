import React from "react";
import { cancelRender, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CompiledFilm } from "../engine/compile/compile";
import { indexForFrame, screenFrameName, screenGeometry, type BoundScreen } from "../engine/client/screen";

export const ScreenLayer: React.FC<{ compiled: CompiledFilm; screens: Record<string, BoundScreen> }> = ({ compiled, screens }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const scene = compiled.stage.scenes.find((item) =>
    frame >= Math.round(item.start * fps) && frame < Math.round((item.start + item.length) * fps));
  const screen = scene && screens[scene.id];
  if (!scene || !screen) return null;

  const index = indexForFrame(frame - Math.round(scene.start * fps), screen.frameCount);
  const src = staticFile(screen.directory + "/" + (screen.stillFile ?? screenFrameName(index)));
  const geometry = screenGeometry(width, height, screen.width, screen.height, screen.presentation);
  return (
    <div data-factory-screen={scene.id} style={{ position: "absolute", ...geometry.viewport, overflow: "hidden" }}>
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
