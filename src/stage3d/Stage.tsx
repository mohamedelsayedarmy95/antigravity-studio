import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { evalNumber, type EvalContext } from "../engine/time/animatable";
import { FilmTimeProvider, useFilmTime, type FilmTime } from "../engine/time/FilmTime";
import { applyCamera, cameraSpeed, solveCamera } from "./camera/rig";
import { Backdrop, backdropBaseColor } from "./environment/Backdrop";
import { buildEnvironment } from "./lighting/rigs";
import { LogoNode } from "./nodes/LogoNode";
import { MorphNode } from "./nodes/MorphNode";
import { ParticlesNode } from "./nodes/ParticlesNode";
import { PrimitiveNode } from "./nodes/PrimitiveNode";
import { compositeAt, resolveColor, type FilmPlan, type PlannedScene } from "./plan";
import { ScenePipeline, type PipelineStructure } from "./post/ScenePipeline";
import type { NodeSpec, Palette } from "./schema";
import { Compositor } from "./transitions/Compositor";

/**
 * The Stage: ONE persistent WebGL context for the whole film.
 *  - Each mounted scene owns a THREE.Scene (+ an fx scene for particles), a camera and a post
 *    pipeline, and renders into its own half-float target.
 *  - The compositor blends one or two scene targets through the active GPU transition and
 *    writes the final, encoded frame.
 * Scenes mount only inside their time window (plus premount), keeping GPU memory bounded.
 */

interface SceneHandle {
  render: () => void;
  texture: THREE.Texture;
  grain: number;
}

type Registry = Map<string, SceneHandle>;
const DEG = Math.PI / 180;

export const Stage: React.FC<{ plan: FilmPlan; aspect: number }> = ({ plan, aspect }) => {
  const frame = useCurrentFrame();
  const registry = useMemo<Registry>(() => new Map(), []);
  const time = useMemo<FilmTime>(
    () => ({ t: frame / plan.fps, frame, fps: plan.fps, grid: plan.grid, seed: plan.seed }),
    [frame, plan],
  );
  const mounted = plan.scenes.filter((s) => frame >= s.mountStart && frame < s.mountEnd);

  return (
    <FilmTimeProvider value={time}>
      {mounted.map((s) => (
        <SceneHost key={s.id} planned={s} plan={plan} aspect={aspect} registry={registry} />
      ))}
      <StageCompositor plan={plan} registry={registry} />
    </FilmTimeProvider>
  );
};

/**
 * The single render orchestrator. R3F calls it on each advance() (Remotion advances once per
 * frame); priority 1 tells R3F not to auto-render. It reads film time from a ref updated during
 * React render — never R3F's clock or delta — so output depends only on the frame number.
 */
const StageCompositor: React.FC<{ plan: FilmPlan; registry: Registry }> = ({ plan, registry }) => {
  const gl = useThree((s) => s.gl);
  const time = useFilmTime();
  const latest = useRef(time);
  latest.current = time;
  const compositor = useMemo(() => new Compositor(plan.seed), [plan.seed]);
  useEffect(() => () => compositor.dispose(), [compositor]);

  useFrame(() => {
    const { t, frame } = latest.current;
    const c = compositeAt(plan, t);
    const need = (id: string) => {
      const h = registry.get(id);
      if (!h) throw new Error(`Stage: scene "${id}" is not mounted at frame ${frame}. Check its mount window.`);
      return h;
    };
    if (c.mode === "single") {
      const h = need(c.scene.id);
      h.render();
      compositor.render(gl, { a: h.texture, b: null, mode: "single", progress: 0, color: new THREE.Color(), frame, grain: h.grain });
      return;
    }
    const to = need(c.to.id);
    const from = c.from ? need(c.from.id) : null;
    from?.render();
    to.render();
    compositor.render(gl, {
      a: from ? from.texture : compositor.black,
      b: to.texture,
      mode: c.transition.type,
      progress: c.progress,
      color: resolveColor(c.transition.color, plan.palette),
      frame,
      grain: from ? from.grain + (to.grain - from.grain) * c.progress : to.grain,
    });
  }, 1);

  return null;
};

const SceneHost: React.FC<{ planned: PlannedScene; plan: FilmPlan; aspect: number; registry: Registry }> = ({
  planned,
  plan,
  aspect,
  registry,
}) => {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const time = useFilmTime();
  const { spec, post } = planned;
  const palette = plan.palette;

  const scene = useMemo(() => new THREE.Scene(), []);
  const fxScene = useMemo(() => new THREE.Scene(), []);
  const camera = useMemo(() => new THREE.PerspectiveCamera(35, aspect, 0.05, 200), [aspect]);

  const envTarget = useMemo(() => buildEnvironment(gl, spec.world.lighting.rig, palette), [gl, spec.world.lighting.rig, palette]);
  useEffect(() => () => envTarget.dispose(), [envTarget]);

  const structure: PipelineStructure = {
    dof: post.dof !== false,
    bloom: post.bloom !== false,
    chromaticAberration: post.chromaticAberration !== false,
    vignette: post.vignette !== false,
    toneMapping: post.toneMapping,
  };
  const structureKey = JSON.stringify(structure);
  const pipeline = useMemo(
    () => new ScenePipeline(gl, scene, fxScene, camera, structure, { width: size.width, height: size.height }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- structureKey captures `structure`
    [gl, scene, fxScene, camera, structureKey, size.width, size.height],
  );
  useEffect(() => () => pipeline.dispose(), [pipeline]);

  const ctx: EvalContext = { fps: plan.fps, grid: plan.grid, sceneStart: planned.start, sceneLength: planned.length, t: time.t - planned.start };
  const cam = solveCamera(spec.camera, ctx, aspect, plan.seed, planned.id);
  const camPrev = solveCamera(spec.camera, { ...ctx, t: ctx.t - 1 / plan.fps }, aspect, plan.seed, planned.id);
  const speed = cameraSpeed(cam, camPrev, 1 / plan.fps);
  const resolution = useMemo(() => gl.getDrawingBufferSize(new THREE.Vector2()), [gl, size.width, size.height]);

  useLayoutEffect(() => {
    applyCamera(camera, cam, aspect);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = evalNumber(spec.world.lighting.intensity, ctx);
    scene.environmentRotation.set(0, evalNumber(spec.world.lighting.rotation, ctx) * DEG, 0);
    scene.background = backdropBaseColor(spec.world.backdrop, palette);

    const focusDistance =
      post.dof && post.dof.focus !== "target" ? post.dof.focus : cam.position.distanceTo(cam.target);
    const ca = post.chromaticAberration;
    const chromaticOffset = !ca
      ? 0
      : ca.mode === "constant"
        ? 0.0015 * ca.amount
        : ca.amount * (0.0004 + Math.min(0.006, speed * 0.0035));

    pipeline.update({
      exposure: evalNumber(post.exposure, ctx),
      bloom: post.bloom
        ? { intensity: evalNumber(post.bloom.intensity, ctx), threshold: post.bloom.threshold, smoothing: post.bloom.smoothing, radius: post.bloom.radius }
        : undefined,
      dof: post.dof ? { focusDistance, focusRange: post.dof.range, bokehScale: evalNumber(post.dof.bokeh, ctx) } : { focusDistance, focusRange: 1, bokehScale: 0 },
      chromaticOffset,
      vignette: post.vignette || undefined,
    });

    registry.set(planned.id, { render: () => pipeline.render(), texture: pipeline.target.texture, grain: post.grain });
  });
  useLayoutEffect(() => () => void registry.delete(planned.id), [registry, planned.id]);

  const content = { nodes: spec.world.nodes, ctx, palette, seed: plan.seed, sceneId: planned.id };
  return (
    <>
      {createPortal(
        <>
          <Backdrop spec={spec.world.backdrop} ctx={ctx} palette={palette} resolution={resolution} />
          <SceneNodes {...content} layer="main" />
        </>,
        scene,
        { camera },
      )}
      {createPortal(<SceneNodes {...content} layer="fx" />, fxScene, { camera })}
    </>
  );
};

/** Node registry: maps each node type to its component. Particles live in the fx scene. */
const SceneNodes: React.FC<{
  nodes: NodeSpec[];
  ctx: EvalContext;
  palette: Palette;
  seed: number;
  sceneId: string;
  layer: "main" | "fx";
}> = ({ nodes, ctx, palette, seed, sceneId, layer }) => (
  <>
    {nodes.map((node) => {
      if (layer === "fx") {
        return node.type === "particles" ? (
          <ParticlesNode key={node.id} spec={node} ctx={ctx} palette={palette} seed={seed} sceneId={sceneId} sceneNodes={nodes} />
        ) : null;
      }
      switch (node.type) {
        case "primitive":
          return <PrimitiveNode key={node.id} spec={node} ctx={ctx} palette={palette} />;
        case "morph":
          return <MorphNode key={node.id} spec={node} ctx={ctx} palette={palette} />;
        case "logo":
          return <LogoNode key={node.id} spec={node} ctx={ctx} palette={palette} />;
        default:
          return null;
      }
    })}
  </>
);
