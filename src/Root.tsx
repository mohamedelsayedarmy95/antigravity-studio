import "./index.css";
import { Composition, Folder } from "remotion";
import { compileFilm } from "./engine/compile/compile";
import { Film, type FilmProps } from "./engine/Film";
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
      <Composition
        id="FactoryFilm"
        component={Film}
        durationInFrames={1}
        fps={60}
        width={1920}
        height={1080}
        defaultProps={{ spec: FILMS[0] } satisfies FilmProps}
        calculateMetadata={({ props }: { props: FilmProps }) => {
          const compiled = compileFilm(props.spec);
          const aspect = props.aspect ?? compiled.spec.output.aspects[0];
          if (!compiled.spec.output.aspects.includes(aspect)) throw new Error("Aspect is outside the validated factory plan");
          return { ...ASPECTS[aspect], durationInFrames: compiled.durationInFrames, fps: compiled.fps };
        }}
      />
      <Folder name="Diagnostics">
        <Composition id="GpuProbe" component={GpuProbe} durationInFrames={60} fps={60} width={1280} height={720} />
      </Folder>
    </>
  );
};
