import * as THREE from "three";
import {
  BloomEffect,
  ChromaticAberrationEffect,
  CopyPass,
  DepthOfFieldEffect,
  type Effect,
  EffectComposer,
  EffectPass,
  Pass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";
import { isTransmissive } from "../materials/library";
import { PARTICLE_MATERIAL_FLAG, type ParticleUniforms } from "../nodes/ParticlesNode";

/**
 * One scene's render pipeline, in scene-referred linear HDR until tone mapping:
 *
 *   RenderPass (scene, MSAA) → [DepthOfField] → ParticlesPass (soft, self-bokeh) → [Bloom]
 *   → ChromaticAberration? + ToneMapping (ACES/AgX) + Vignette? → copy into this scene's target
 *
 * The target holds tone-mapped *linear* values in half float; the stage compositor blends scenes
 * (transitions), then encodes to sRGB and adds grain/dither once, for the whole frame.
 */

export interface PipelineStructure {
  dof: boolean;
  bloom: boolean;
  chromaticAberration: boolean;
  vignette: boolean;
  toneMapping: "aces" | "agx";
}

export interface PipelineParams {
  exposure: number;
  bloom?: { intensity: number; threshold: number; smoothing: number; radius: number };
  dof?: { focusDistance: number; focusRange: number; bokehScale: number };
  chromaticOffset?: number;
  vignette?: { darkness: number; offset: number };
}

/**
 * Draws particle systems over the image after depth of field, testing against scene depth.
 *
 * Glass: the composer's depth buffer contains transmissive surfaces, which would hide every
 * particle behind a glass object (glass would read as opaque). When the scene has transmissive
 * meshes, this pass first renders a depth-only prepass with them hidden, so particles show
 * through glass while still being occluded by opaque geometry.
 */
class ParticlesPass extends Pass {
  private depth: THREE.Texture | null = null;
  private readonly size = new THREE.Vector2();
  private readonly sourceScene: THREE.Scene;
  private readonly fxScene: THREE.Scene;
  private readonly fxCamera: THREE.PerspectiveCamera;
  private readonly glassDepth: THREE.WebGLRenderTarget;
  /**
   * Focus distance shared with the DoF effect. Pulled at render time (never pushed from React):
   * particles that mount mid-frame, e.g. after an async logo load, must still get this frame's value.
   */
  focusDistance = 5;

  constructor(mainScene: THREE.Scene, fxScene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    super("ParticlesPass");
    this.sourceScene = mainScene;
    this.fxScene = fxScene;
    this.fxCamera = camera;
    this.needsSwap = false;
    this.needsDepthTexture = true;
    this.glassDepth = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.FloatType),
    });
  }

  override setDepthTexture(depthTexture: THREE.Texture) {
    this.depth = depthTexture;
  }

  override setSize(width: number, height: number) {
    this.glassDepth.setSize(width, height);
  }

  override dispose() {
    this.glassDepth.depthTexture?.dispose();
    this.glassDepth.dispose();
    super.dispose();
  }

  /** Depth of everything except transmissive meshes, or null when there is no glass. */
  private renderGlassFreeDepth(renderer: THREE.WebGLRenderer): THREE.Texture | null {
    const hidden: THREE.Object3D[] = [];
    const muted: THREE.Material[] = [];
    this.sourceScene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (materials.some(isTransmissive)) hidden.push(mesh);
      else for (const m of materials) if (m.colorWrite) muted.push(m);
    });
    if (hidden.length === 0) return null;

    hidden.forEach((o) => (o.visible = false));
    muted.forEach((m) => (m.colorWrite = false));
    const background = this.sourceScene.background;
    this.sourceScene.background = null;
    renderer.setRenderTarget(this.glassDepth);
    renderer.clear(true, true, false);
    renderer.render(this.sourceScene, this.fxCamera);
    this.sourceScene.background = background;
    muted.forEach((m) => (m.colorWrite = true));
    hidden.forEach((o) => (o.visible = true));
    return this.glassDepth.depthTexture;
  }

  override render(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget | null) {
    if (!inputBuffer) return;
    let hasParticles = false;
    this.fxScene.traverse((o) => {
      if (((o as THREE.Points).material as THREE.Material | undefined)?.userData?.[PARTICLE_MATERIAL_FLAG] && o.visible) hasParticles = true;
    });
    if (!hasParticles) return;

    const depth = this.renderGlassFreeDepth(renderer) ?? this.depth;
    this.size.set(inputBuffer.width, inputBuffer.height);
    const viewportH = inputBuffer.height;
    this.fxScene.traverse((o) => {
      const material = (o as THREE.Points).material as THREE.ShaderMaterial | undefined;
      if (!material?.userData?.[PARTICLE_MATERIAL_FLAG]) return;
      const u = material.uniforms as unknown as ParticleUniforms;
      u.uFocus.value = this.focusDistance;
      u.uDepth.value = depth;
      u.uUseDepth.value = depth ? 1 : 0;
      u.uResolution.value.copy(this.size);
      u.uViewportH.value = viewportH;
      u.uNear.value = this.fxCamera.near;
      u.uFar.value = this.fxCamera.far;
    });
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(inputBuffer);
    renderer.render(this.fxScene, this.fxCamera);
    renderer.autoClear = autoClear;
  }
}

export class ScenePipeline {
  readonly target: THREE.WebGLRenderTarget;
  private readonly composer: EffectComposer;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly dof: DepthOfFieldEffect | null = null;
  private readonly bloom: BloomEffect | null = null;
  private readonly chromatic: ChromaticAberrationEffect | null = null;
  private readonly vignette: VignetteEffect | null = null;
  private readonly particles: ParticlesPass;
  private exposure = 1;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    fxScene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    structure: PipelineStructure,
    cssSize: { width: number; height: number },
  ) {
    this.renderer = renderer;
    const maxSamples = renderer.capabilities.maxSamples;
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: Math.min(4, maxSamples) });
    this.composer.autoRenderToScreen = false;
    this.composer.addPass(new RenderPass(scene, camera));

    if (structure.dof) {
      this.dof = new DepthOfFieldEffect(camera, { focusDistance: 5, focusRange: 1.2, bokehScale: 2, resolutionScale: 0.5 });
      this.composer.addPass(new EffectPass(camera, this.dof));
    }

    this.particles = new ParticlesPass(scene, fxScene, camera);
    this.composer.addPass(this.particles);

    if (structure.bloom) {
      this.bloom = new BloomEffect({ mipmapBlur: true, intensity: 1, luminanceThreshold: 0.85, luminanceSmoothing: 0.2, radius: 0.75 });
      this.composer.addPass(new EffectPass(camera, this.bloom));
    }

    const finish: Effect[] = [];
    if (structure.chromaticAberration) {
      this.chromatic = new ChromaticAberrationEffect({ offset: new THREE.Vector2(), radialModulation: true, modulationOffset: 0.2 });
      finish.push(this.chromatic);
    }
    finish.push(new ToneMappingEffect({ mode: structure.toneMapping === "agx" ? ToneMappingMode.AGX : ToneMappingMode.ACES_FILMIC }));
    if (structure.vignette) {
      this.vignette = new VignetteEffect({ darkness: 0.55, offset: 0.3 });
      finish.push(this.vignette);
    }
    this.composer.addPass(new EffectPass(camera, ...finish));

    const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.target = new THREE.WebGLRenderTarget(buffer.x, buffer.y, { type: THREE.HalfFloatType, depthBuffer: false });
    this.composer.addPass(new CopyPass(this.target, false));
    this.composer.setSize(cssSize.width, cssSize.height);
  }

  update(p: PipelineParams) {
    this.exposure = p.exposure;
    if (this.bloom && p.bloom) {
      this.bloom.intensity = p.bloom.intensity;
      this.bloom.luminanceMaterial.threshold = p.bloom.threshold;
      this.bloom.luminanceMaterial.smoothing = p.bloom.smoothing;
      this.bloom.mipmapBlurPass.radius = p.bloom.radius;
    }
    if (this.dof && p.dof) {
      this.dof.cocMaterial.focusDistance = p.dof.focusDistance;
      this.dof.cocMaterial.focusRange = p.dof.focusRange;
      this.dof.bokehScale = p.dof.bokehScale;
    }
    // Particle bokeh uses the same focus distance as the DoF effect.
    if (p.dof) this.particles.focusDistance = p.dof.focusDistance;
    if (this.chromatic) {
      const o = p.chromaticOffset ?? 0;
      this.chromatic.offset.set(o, o * 0.6);
    }
    if (this.vignette && p.vignette) {
      this.vignette.darkness = p.vignette.darkness;
      this.vignette.offset = p.vignette.offset;
    }
  }

  render() {
    const exposure = this.renderer.toneMappingExposure;
    this.renderer.toneMappingExposure = this.exposure; // read by the ToneMappingEffect shader
    this.composer.render(0); // explicit delta: no internal clock reads
    this.renderer.toneMappingExposure = exposure;
  }

  dispose() {
    this.composer.dispose();
    this.target.dispose();
  }
}
