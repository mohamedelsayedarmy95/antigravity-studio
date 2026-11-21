import "./index.css";
import { Composition, Folder } from "remotion";
import { GpuProbe } from "./probe/GpuProbe";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Diagnostics">
        <Composition id="GpuProbe" component={GpuProbe} durationInFrames={60} fps={60} width={1280} height={720} />
      </Folder>
    </>
  );
};
