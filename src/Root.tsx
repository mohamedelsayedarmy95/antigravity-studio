import "./index.css";
import { Composition, Folder } from "remotion";
import { FILMS } from "./films";
import { GpuProbe } from "./probe/GpuProbe";
import { Film3D } from "./stage3d/Film3D";
import { planFilm } from "./stage3d/plan";
import { ASPECTS, type AspectId } from "./stage3d/schema";

/** Films × aspects are registered from data; adding a film never touches this file. */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {FILMS.map((film) => {
        const plan = planFilm(film);
        return (
          <Folder key={film.id} name={film.id}>
            {(Object.keys(ASPECTS) as AspectId[]).map((aspect) => (
              <Composition
                key={aspect}
                id={`${film.id}-${aspect}`}
                component={Film3D}
                durationInFrames={plan.durationInFrames}
                fps={plan.fps}
                width={ASPECTS[aspect].width}
                height={ASPECTS[aspect].height}
                defaultProps={{ film }}
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
