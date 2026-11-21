import "./index.css";
import { Composition, Folder } from "remotion";
import { compileFilm } from "./engine/compile/compile";
import { Film } from "./engine/Film";
import { FILMS } from "./films";
import { GpuProbe } from "./probe/GpuProbe";
import { ASPECTS } from "./stage3d/schema";

/** Films × aspects are registered from data; adding a film never touches this file. */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {FILMS.map((spec) => {
        const compiled = compileFilm(spec);
        return (
          <Folder key={compiled.spec.id} name={compiled.spec.id}>
            {compiled.spec.output.aspects.map((aspect) => (
              <Composition
                key={aspect}
                id={`${compiled.spec.id}-${aspect}`}
                component={Film}
                durationInFrames={compiled.durationInFrames}
                fps={compiled.fps}
                width={ASPECTS[aspect].width}
                height={ASPECTS[aspect].height}
                defaultProps={{ spec }}
              />
            ))}
          </Folder>
        );
      })}
      <Folder name="Diagnostics">
        <Composition id="GpuProbe" component={GpuProbe} durationInFrames={60} fps={60} width={1280} height={720} />
      </Folder>
    </>
  );
};
