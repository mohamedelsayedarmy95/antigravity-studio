# Universal Capability Engine — Architecture v0.1

Status (2026-11-21): **M0 and M1 built** on branch `engine/v1`. See §10 for what exists and the rules M1 added.
Scope: a general-purpose cinematic motion-graphics engine on Remotion + React Three Fiber. SaveFix and the iPhone are out of scope; a device is just one more 3D asset type.

---

## 1. Where the current codebase stands

**Verdict: about 10% of the engine exists.** What's there is a capable *2D motion kit*: springs, DOM kinetic type and a few 2D primitives. Everything the universal engine depends on is missing: real 3D, shaders, post-processing, a config schema, a timeline/beat system, audio analysis, data-viz and a look system. Three.js / R3F is not installed at all.

| File | Lines | Verdict | Why |
| :--- | ---: | :--- | :--- |
| `src/motion/springPresets.ts` | 178 | **Keep** | Pure, frame-deterministic spring vocabulary. The engine's easing layer builds on it. |
| `scripts/validateSprings.ts` | 128 | **Keep** | Useful tooling for the spring vocabulary. |
| `src/typography/KineticText.tsx` | 204 | **Keep, fix** | Solid masked word/char reveal. Bugs: highlight matching uses `rule.text.includes(raw)`, so any token that's a substring of a highlight phrase gets highlighted; the settle check is hard-coded to 22 frames; it's coupled to Tailwind classes. |
| `src/typography/fonts.ts` | 94 | **Keep, rework** | The families are OFL (license-clean), but they're fetched from Google at render time (not hermetic) and limited to the Latin subset. Fonts should be vendored locally. |
| `src/motion/ChromaticAberration.tsx` | 112 | **Keep (2D only)** | A real SVG channel split, but it can only touch DOM layers. The 3D engine needs chromatic aberration as a GPU post pass. |
| `src/audio/useAudioReactive.ts` | 139 | **Rework** | `useAudioReactive()` is **synthetic** (sin/cos plus a BPM pulse, no audio at all). `useRealAudioReactive()` is real per-frame FFT, but its "beat" is just `bass^1.8`: there's no onset, beat or downbeat detection. It also imports `@remotion/media-utils`, which isn't declared in `package.json` (a phantom dependency). |
| `src/motion/MotionPrimitives.tsx` | 624 | **Split** | Keep the 2D primitives (SpringPop, CardSlideBlur, MaskedPillReveal, LevitationHarmonic). **Delete** PerspectiveTilt and SpatialFlip3D, which are CSS 3D fakes. Hard-coded filter IDs (`"flip3d-chromatic"`, `"swipe-chromatic"`) collide when two instances are on screen. |
| `src/devices/*` (3 files) | 927 | **Delete** | A CSS/DOM fake phone (`preserve-3d`, gradient "titanium") plus a SaveFix-specific screen. |
| `src/compositions/*` (4 files) | 1,142 | **Delete** | Hand-built test compositions with hard-coded copy. In `seq-scene2-flip.png` the flip card renders **mirrored** and clipped at the left edge. |
| `src/HelloWorld*` (5 files) | 320 | **Delete** | Remotion template. |
| `scripts/analyzeDeviceRender.ts` | 83 | **Replace** | It measures the *seek* handle time ("Setting the current frame"), not the frame render cost, and scene frame ranges are hard-coded. The ">90% ≤ 16.67 ms" numbers built on it aren't valid evidence. |
| `PERFORMANCE_BUDGET.md` | — | **Replace** | It recommends `preserve-3d` (contradicting "no CSS fakes"), and its render targets (30 s 1080p60 in < 60 s; 4K in < 5 min) aren't attainable for real 3D on this machine. |
| `remotion.config.ts` | — | **Fix** | It doesn't set `gl: "angle"` (Remotion's documented requirement for Three.js), and it uses JPEG intermediate frames. |

**Repo hygiene issues:**
- `build/` is committed (240 bundle files) and so are 8 render logs (~3 MB) at the root.
- Two lockfiles (`package-lock.json` + `pnpm-lock.yaml`) can drift apart.

**Existing renders** (all probed with ffprobe):
- Every file is `yuvj420p` (full-range) with **no color tags**. Delivery needs `yuv420p` and BT.709.
- The only audio is a 10 s mono 44.1 kHz test loop at -10.8 LUFS.

**Toolchain:**
- Versions: Node 24.15.0, pnpm 12.21.0, Remotion 4.0.545, React 19.3.1, TypeScript 5.9.3.
- The store is `D:\.pnpm-store`, which is pnpm's default for this drive.
- ffmpeg/ffprobe 9.1 (gyan.dev essentials build) is on PATH and includes `ebur128`, `loudnorm`, `blackdetect`, `freezedetect` and `ssim`.
- `tsc --noEmit` passes.

**Host:**
- CPU: Ryzen 5 PRO 5650U (6 cores / 12 threads).
- GPU: integrated Radeon (driver 31.0.21925).
- RAM: 15.3 GB, shared with the GPU.
- Disk: 92 GB free on D:.

This is a laptop iGPU. Real-time preview of bloom + depth of field + glass will not hold 55 FPS at 1080p, so master renders are offline and slow. Quality is unaffected; only time is.

---

## 2. Design principles

1. **Config → Plan → Pixels.** Configs are declarative and mood-driven. A pure compiler turns them into a fully resolved, serializable **RenderPlan** (absolute frames, beat-snapped times, resolved styles, hashed assets). Renderers only read the plan.
2. **Every animated value is a pure function of continuous time `t`** (seconds, fractional allowed). That gives scrub-safety, determinism, and true motion blur by sampling sub-frame times.
3. **Real 3D only.** Anything with depth, perspective, light or material lives in WebGL. The DOM layer is strictly 2D: translate, scale, Z-rotation, opacity, masks and SVG filters. `perspective`, `preserve-3d`, `rotateX/Y`, `rotate3d` and `translateZ` are lint-banned in `src/layer2d`.
4. **Taste lives in Looks.** A Look (keynote, cyber, futurist…) is one data object holding defaults for palette, type, motion, camera, lighting, materials, post, transitions, pacing and SFX. A config names a look and overrides only what it must. This is what lets the same engine execute any concept.
5. **Registries, not forks.** Node types, materials, reveals, transitions, camera rigs and looks are registry entries. New capability means a new entry; films never fork engine code.
6. **Each module owns its schema slice.** The 3D engine defines the zod schema for its nodes, the type engine for its elements, and so on. The planner composes those slices, so building modules first never forces a schema rewrite.

---

## 3. System overview

```
 Brief (concept + assets + mood)        ← human, or an optional LLM "director" (later phase)
        │  produces
        ▼
 FilmSpec  (TS/JSON, zod-validated)     ← the engine's input contract (§4)
        │  plan/compile.ts  (pure, no React, < 1 s)
        │    resolve look → resolve assets (hash, dims) → load beatmap → resolve time
        │    expressions → beat-snap scenes → aspect-aware layout → SFX auto-cues
        ▼
 RenderPlan (JSON, cacheable, diffable)
        │  runtime/<Film plan aspect>   (Remotion composition, one per film × aspect)
        ▼
 ┌──────────────── layer stack, per frame ─────────────────┐
 │ layer2d  "behind"   DOM/SVG (backgrounds, big type)      │
 │ stage3d             ONE persistent <ThreeCanvas>:         │
 │                     scenes → render targets → GPU         │
 │                     transition → post stack → screen      │
 │ layer2d  "front"    DOM/SVG (kinetic type, HUD, charts)   │
 │ audio               music + SFX + VO, ducking by frame    │
 └──────────────────────────────────────────────────────────┘
        │  scripts/render.ts (profile: draft | preview | master)
        ▼
 MP4 per aspect (yuv420p, BT.709, AAC 48 kHz) → loudness pass (-14 LUFS) → QA report
```

**Why one persistent `<ThreeCanvas>` per film (not one per scene):**
- One WebGL context, and shaders compile once.
- No remount hitches at cuts.
- It makes **GPU shader transitions between scenes** possible: the outgoing and incoming scenes render to separate targets and a transition shader blends them.
- Scenes mount only inside their time window (plus premount), so memory stays bounded.

**Typography split:**
- Default text is DOM/SVG. It gives the best typographic quality: real shaping, kerning, variable fonts, `text-wrap: balance`, and RTL.
- Text that must live in 3D space or be hit by the 3D post stack (bloom, glitch, chromatic aberration) uses `text3d`: SDF text via troika, or extruded geometry.
- Consequence: GPU transitions affect the 3D world. DOM text animates its own enter and exit, timed to the same transition, which is also how motion designers work.

---

## 4. Config schema (FilmSpec)

### 4.1 Time grammar (used everywhere)

```ts
type TimeRef =                 // a point in time; scene-relative unless absolute
  | number                     // seconds
  | `${number}s` | `${number}f`
  | `${number}b`               // beats from scene start: "2b", "3.5b"
  | `bar ${number}`            // absolute bar (1-based), snaps to its downbeat
  | `${number}%`               // fraction of the scene's length
  | `@${string}`;              // marker or event: "@drop", "@scene:hud+2b"

type Length = number | `${number}s` | `${number}f` | `${number}b` | `${number} bars`;

type Ease = SpringPresetName | "linear" | "hold"
  | [number, number, number, number]            // cubic-bezier
  | { spring: Partial<SpringConfig> };

// Any animatable parameter accepts: a constant, a keyframe track, or a modulated base.
type Animatable<T> = T | Track<T> | Modulated<T>;
interface Track<T> { keys: Array<{ at: TimeRef; value: T; ease?: Ease }> }
interface Modulated<T> { base: T | Track<T>; mod: Mod | Mod[] }
interface Mod {                                  // audio/beat reactivity, declarative
  source: "beat" | "downbeat" | "onset" | "bass" | "mid" | "treble" | "energy";
  amount: number;                                // added on top of base, in T's units
  decay?: Length;                                // impulse sources only
}
```

### 4.2 Top level

```ts
interface FilmSpec {
  schemaVersion: "1";
  id: string;
  seed: number;                       // every random stream derives from (seed, element id)
  look: LookId | LookOverride;        // "keynote" | "cyber" | "futurist" | custom
  output: {
    fps: 30 | 60;
    duration: Length | "music";       // "music" = fit to the track's bar grid
    aspects: Aspect[];                // "16:9" | "9:16" | "1:1" | "4:5" | "21:9"
  };
  brand?: { palette?: Partial<Palette>; fonts?: Partial<FontRoles>; logo?: AssetId };
  assets: Record<AssetId, Asset>;     // { src, kind, license } (kinds: image | video | vector | model | audio | font | hdri | lut)
  data?: Record<string, DataSeries>;  // feeds charts, counters, HUD readouts
  audio: AudioSpec;
  timeline: SceneSpec[];
  post?: PostSpec;                    // film-wide; scenes override, blended across transitions
}

interface SceneSpec {
  id: string;
  role: "hook" | "reveal" | "statement" | "feature" | "data" | "montage" | "peak" | "outro";
  length: Length;                     // the planner snaps boundaries to the beat grid
  transitionIn?: TransitionSpec;      // default comes from look × role × beat strength
  world?: WorldSpec;                  // 3D layer
  camera?: CameraSpec;
  overlay?: OverlayElement[];         // 2D layer (type, charts, HUD, UI)
  post?: Partial<PostSpec>;
  sfx?: SfxCue[];                     // on top of the look's automatic cues
  markers?: Record<string, TimeRef>;
}
```

### 4.3 `visuals`: world, nodes, materials, camera, post

```ts
interface WorldSpec {
  environment?: "void" | "gradientSweep" | "cyclorama" | "gridFloor" | "starfield"
              | { hdri: AssetId; intensity?: number; rotation?: Animatable<number> };
  lighting?: LightingRigId | LightingRigOverride;   // "threePoint" | "stripRim" | "topSoftbox" | "gelAccent" | …
  floor?: "none" | "contactShadow" | "reflective" | "grid";
  fog?: { color: ColorRef; near: number; far: number };
  nodes: Node3D[];
}

type Node3D = NodeCommon & (
  | { type: "primitive"; shape: PrimitiveShape; params?: Record<string, number> }
  | { type: "morph"; shapes: PrimitiveShape[]; keys: TimeRef[]; ease?: Ease;
      surfaceNoise?: Animatable<number> }                       // abstract geometry morphing
  | { type: "particles"; count: number; emitter: EmitterSpec; behavior: ParticleBehavior[];
      sprite?: "dot" | "streak" | "spark"; formTo?: NodeRef | AssetId }  // e.g. swarm into the logo
  | { type: "card"; media?: AssetId; size: [number, number]; radius?: number;
      surface?: "glass" | "solid" | "emissive" }               // UI cards / screenshots in 3D
  | { type: "model"; asset: AssetId; materials?: Record<string, MaterialRef> }  // any GLB: devices, products
  | { type: "logo"; asset: AssetId; depth: number; bevel?: number }  // SVG → extruded mesh
  | { type: "text3d"; content: string; font?: FontRole; size: number; mode?: "sdf" | "extruded" }
  | { type: "hud3d"; preset: "gridFloor" | "scanRing" | "radar" | "orbitRings" | "dataPillars" }
  | { type: "shaderPlane"; shader: ShaderId; uniforms?: Record<string, Animatable<number | Vec3>> }
  | { type: "group"; children: Node3D[] }
);

interface NodeCommon {
  id: string;
  position?: Animatable<Vec3>; rotation?: Animatable<Vec3>; scale?: Animatable<Vec3 | number>;
  material?: MaterialRef;
  enter?: EnterSpec; exit?: ExitSpec;    // named entrances: "assemble", "rise", "scaleSpring", "dissolve" …
  at?: TimeRef; out?: TimeRef;           // visibility window inside the scene
}

type PrimitiveShape = "sphere" | "roundedBox" | "torus" | "torusKnot" | "icosahedron"
                    | "capsule" | "cylinder" | "ring" | "plane";

type MaterialRef = MaterialId | { preset: MaterialId; color?: ColorRef;
  roughness?: Animatable<number>; metalness?: Animatable<number>; emissive?: Animatable<number> };
type MaterialId = "chrome" | "liquidChrome" | "brushedMetal" | "glass" | "frostedGlass"
  | "iridescentGlass" | "ceramic" | "clay" | "obsidian" | "neonEmissive" | "holographic" | "wireGlow";
type ColorRef = `#${string}` | `palette.${keyof Palette}`;     // palette roles keep looks swappable

interface CameraSpec {
  lens?: Animatable<number>;                       // mm, full-frame equivalent
  frame?: { subject: NodeRef | "world"; fill: number };   // aspect-aware auto distance
  moves?: CameraMove[];                            // composed additively, all frame-pure
  focus?: { subject: NodeRef; fStop: Animatable<number>;
            rack?: { to: NodeRef; at: TimeRef; length: Length } };
}
type CameraMove =
  | { rig: "orbit"; degrees: number; axis?: "y" | "x"; from?: TimeRef; to?: TimeRef; ease?: Ease }
  | { rig: "pushIn" | "pullBack" | "dolly" | "truck" | "crane"; amount: number;
      from?: TimeRef; to?: TimeRef; ease?: Ease }
  | { rig: "whip"; direction: "left" | "right" | "up" | "down"; at: TimeRef }
  | { rig: "handheld"; amount: number }                          // seeded closed-form noise
  | { rig: "impulse"; on: BeatSelector; scale?: number; rotationDeg?: number };

interface PostSpec {
  toneMapping?: "aces" | "agx" | "neutral";
  exposure?: Animatable<number>;
  bloom?: { strength: Animatable<number>; threshold?: number; radius?: number };
  dof?: "auto" | "off";                            // "auto" = driven by camera.focus
  chromaticAberration?: "off" | "onMotion" | { amount: Animatable<number> };
  grain?: number; vignette?: number;
  grade?: GradeId | { lut: AssetId; mix?: number };
  motionBlur?: { shutterDeg: number };             // sample count comes from the render profile
}

type TransitionSpec = { type: TransitionType; length?: Length; on?: "downbeat" | "beat" | TimeRef };
type TransitionType = "cut" | "dissolve" | "noiseDissolve" | "lightSweep" | "glitchSlice"
                    | "depthPush" | "zoomThrough" | "maskWipe" | "chromaticSmear";
```

### 4.4 `typography` / data (2D layer)

```ts
type OverlayElement = Placement & Timing & (
  | { kind: "text"; role: TypeRole; content: string; reveal?: Reveal; emphasis?: string[] }
  | { kind: "counter"; from: number; to: number; format?: NumberFormat; role?: TypeRole }
  | { kind: "chart"; chart: "line" | "area" | "bar" | "ring" | "sparkline" | "radar";
      data: DataRef; reveal?: "drawOn" | "grow" | "stagger" }
  | { kind: "hud"; preset: "brackets" | "crosshair" | "telemetry" | "ticker" | "radar"
      | "scanlines" | "coordinates"; data?: DataRef }
  | { kind: "ui"; component: UiComponent }          // card, statTile, chat, notification, codeBlock, terminal (typed per component)
  | { kind: "image"; asset: AssetId; fit?: "contain" | "cover" }
);
interface Placement {                                // normalized units, never pixels
  anchor: "center" | "top" | "bottom" | "left" | "right" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
  offset?: [number, number];                         // fraction of the safe area
  width?: number;                                    // fraction of the safe area
  align?: "start" | "center" | "end";
  layer?: "front" | "behind3d";
}
interface Timing { at?: TimeRef; out?: TimeRef; exit?: ExitStyle; react?: Mod[] }  // react = beat/audio pulses on the element
type TypeRole = "display" | "headline" | "title" | "body" | "label" | "numeric";
type Reveal = "maskedRise" | "perGlyphSpring" | "scramble" | "decode" | "typewriter"
            | "blurIn" | "outlineFill" | "splitFlap" | "numberRoll";
```

The type scale is solved per aspect from the Look's modular scale and the safe area, and lines are balanced. Anything that would overflow is a **validation error at plan time**, not a clipped frame.

### 4.5 `audio`

```ts
interface AudioSpec {
  music?: { asset: AssetId; start?: TimeRef; gainDb?: number; fadeOut?: Length };
  beatmap: "auto"                                   // offline analysis, cached by audio hash
         | { bpm: number; offset: number; meter?: [number, number] }  // manual grid
         | { file: string };                        // hand-authored beat/marker JSON
  sfx: "auto" | "off";                              // auto = look's SFX pack on transitions, reveals, impulses
  voiceover?: { asset: AssetId; captions?: boolean };
  duck?: { underSfxDb: number; underVoDb: number };
  master: { lufs: number; truePeakDb: number };     // default -14 / -1
}
type BeatSelector = "beats" | "downbeats" | "bars" | "onsets" | `every ${number}b` | TimeRef[];
```

### 4.6 Looks (the "mood" input)

```ts
interface Look {
  id: LookId;
  palette: Palette;                                 // roles: base, surface, ink, primary, accent, glow
  type: { fonts: FontRoles; scale: ModularScale; tracking: Record<TypeRole, number>; reveal: Reveal };
  motion: { springs: Record<SceneRole | "element", SpringPresetName>; stagger: Length;
            impulse: { scale: number; rotationDeg: number } };
  camera: { lens: number; preferredMoves: CameraMove["rig"][]; handheld: number };
  world: { environment: WorldSpec["environment"]; lighting: LightingRigId;
           materials: Record<"hero" | "secondary" | "accent", MaterialId>; floor: WorldSpec["floor"] };
  post: PostSpec;
  transitions: { soft: TransitionType; hard: TransitionType; peak: TransitionType };
  pacing: { quantize: "beat" | "bar"; holdOutro: Length };
  sfxPack: string;
}
```

The first three looks:

| Look | Palette | Type | Light | Materials | Motion | Post |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **keynote** (Apple-style) | near-black or white, one accent | large, tight-tracked, sparse | top softbox + strip rims | brushed metal, glass, ceramic | weighty springs, long holds | restrained bloom, no CA, fine grain |
| **cyber** (NVIDIA-style) | black + acid green/cyan | mono labels + heavy display | gel accents, emissive | wireGlow, holographic, obsidian | snappy telemetry springs, beat impulses | strong bloom, CA on motion, scanlines |
| **futurist** (Tesla-style) | graphite + white + red accent | wide-tracked geometric | low key, long reflections | liquid chrome, matte clay | smooth dolly/crane, minimal bounce | AgX, deep vignette, anamorphic flare |

### 4.7 A real FilmSpec (Phase C showcase: the cold open and the telemetry scene from §7)

```ts
export default defineFilm({
  schemaVersion: "1", id: "capability-showcase", seed: 7,
  look: "cyber",
  output: { fps: 60, duration: "music", aspects: ["16:9", "9:16", "1:1"] },
  assets: {
    track: { src: "audio/showcase.wav", kind: "audio", license: "TBD" },
    mark:  { src: "brand/engine-mark.svg", kind: "vector", license: "own" },
  },
  data: { throughput: [/* series */], fps: [/* series */] },
  audio: { music: { asset: "track" }, beatmap: "auto", sfx: "auto", master: { lufs: -14, truePeakDb: -1 } },
  timeline: [
    {
      id: "cold-open", role: "hook", length: "2 bars",
      world: {
        environment: "void", lighting: "stripRim", floor: "none",
        nodes: [
          { id: "core", type: "morph", shapes: ["icosahedron", "torusKnot"], keys: ["0b", "4b"],
            material: "liquidChrome", enter: "assemble",
            scale: { base: 1, mod: { source: "bass", amount: 0.04 } } },
          { id: "dust", type: "particles", count: 6000, emitter: { volume: "sphere", radius: 6 },
            behavior: [{ drift: 0.2 }, { attract: "core", from: "0b", to: "3b" }] },
        ],
      },
      camera: { lens: 85, frame: { subject: "core", fill: 0.45 },
                moves: [{ rig: "pushIn", amount: 0.25, ease: "appleHero" },
                        { rig: "impulse", on: "downbeats", scale: 0.012 }] },
      overlay: [{ kind: "text", role: "display", content: "One config.", reveal: "maskedRise",
                  anchor: "bottom", at: "2b", out: "7b" }],
    },
    {
      id: "telemetry", role: "data", length: "3 bars",
      transitionIn: { type: "lightSweep", on: "downbeat" },
      world: { environment: "gridFloor", nodes: [
        { id: "cards", type: "group", children: [ /* 3 glass cards orbiting, each with a screenshot */ ] },
        { id: "rings", type: "hud3d", preset: "orbitRings" } ] },
      camera: { lens: 50, moves: [{ rig: "orbit", degrees: 35, ease: "inertiaDecay" }] },
      overlay: [
        { kind: "hud", preset: "telemetry", anchor: "topRight", data: "fps" },
        { kind: "chart", chart: "line", data: "throughput", reveal: "drawOn", anchor: "bottomLeft", width: 0.4, at: "1b" },
        { kind: "counter", from: 0, to: 60, format: { suffix: " FPS" }, role: "numeric", anchor: "left", at: "4b" },
      ],
      post: { chromaticAberration: "onMotion", bloom: { strength: 1.1 } },
    },
    // … statement / typography wall / particle storm / resolve (see §7)
  ],
});
```

---

## 5. Modules

### 5.1 Time & Motion core (`src/engine/time`, `src/motion`)
- `useFilmTime()` returns `{ t, frame, sceneT, sceneProgress, beat, bar, beatPhase }`. `t` may be fractional for motion-blur sub-samples.
- `evaluate(animatable, t, ctx)` handles constants, tracks (spring, bezier and hold eases) and modulators. Springs are computed with the existing `springPresets.ts` via Remotion's `spring()` on fractional frames.
- `rng(seed, ...path)`: a seeded splitmix/mulberry stream per element. **`Math.random` is lint-banned.**
- Camera rigs are pure functions `t → (position, target, roll, fov)`, composed additively. Handheld is closed-form seeded noise, never a simulation.

### 5.2 Cinematic 3D engine (`src/stage3d`)
- **Stack** (all compatible today):
  - `three@0.187.0`
  - `@react-three/fiber@9.8.2` (peer: React ≥19 <19.4, satisfied by 19.3.1)
  - `@react-three/drei@10.7.9`
  - `@react-three/postprocessing@3.2.2` + `postprocessing@6.39.6` (peer: three < 0.188, satisfied)
  - `@remotion/three@4.0.545`
- **Stage:** one `<ThreeCanvas>` per film.
  - Scenes mount within their time windows using `<Sequence layout="none">`.
  - During a transition, outgoing and incoming scenes render to separate render targets, a full-screen transition shader blends them with `progress = f(t)`, then the post stack runs.
- **Nodes:** a registry keyed by `type`.
  - Morphing uses one high-resolution icosphere topology. Each target shape is a per-vertex attribute (radial projection or SDF projection), blended in the vertex shader via `three-custom-shader-material`, so morphs keep full PBR shading, transmission and shadows.
  - An SDF raymarch backend for liquid/metaball morphs comes later.
- **Particles:** instanced, with positions computed **in closed form in the vertex shader** from `(seed, t)`: drift, orbit, curl-like flow, attract-to-shape (targets sampled from a node's surface or an SVG). No per-frame simulation state, so scrubbing and parallel rendering stay exact.
- **Materials:** a preset library on `MeshPhysicalMaterial`: clearcoat, transmission, iridescence, anisotropy, plus procedural normal/roughness maps baked once per seed and cached. There are custom shaders for holographic, wireGlow and neon.
- **Lighting:** Lightformer studio rigs rendered once into a PMREM environment (`<Environment frames={1}>`), re-rendered only if the rig animates. HDRIs are optional assets. Contact shadows or a reflector floor are chosen by the look.
- **Camera:** a focal length → FOV lens model. Aspect-aware `frame.fill` solves the camera distance from the subject's bounding sphere per aspect, which is how one config frames correctly at 16:9, 9:16 and 1:1. Depth of field is driven by `focus`.
- **Post:**
  - The core passes come from `postprocessing`: tone mapping (ACES/AgX, non-adaptive), bloom (mipmap), depth of field, chromatic aberration (velocity-driven, mirroring the 2D concept), vignette, SMAA and LUT.
  - **Grain is our own seeded effect**, because library noise/glitch effects read the composer clock (non-deterministic, see §6).
  - **Motion blur for 3D is our own accumulation pass:** render N sub-frame `t` samples inside the one GL context and average them. Remotion's `<CameraMotionBlur>` is used only on DOM layers, since on a canvas it would create N WebGL contexts.

### 5.3 Typography & Data engine (`src/layer2d`)
- **Text:** the existing `KineticText` (bugs fixed) plus a reveal registry (maskedRise, perGlyphSpring, scramble, decode, typewriter, blurIn, outlineFill, splitFlap, numberRoll).
- **Text fit:** `@remotion/layout-utils` `fitText`/`measureText` and `text-wrap: balance`.
- **Fonts:** vendored locally (OFL), with a font registry that adds scripts beyond Latin.
- **Data-viz:** d3-scale and d3-shape (pure functions) render to SVG. Draw-on uses `@remotion/paths` (already a dependency). Counters roll with tabular numerals.
- **HUD kit and UI kit:** SVG/DOM components themed by the look.
- **Layout:** anchors in normalized safe-area units per aspect and platform safe zone.

### 5.4 Audio & beat engine (`src/audio`, `scripts/analyze-audio.ts`)
- **Offline analyzer** (Node, deterministic, cached by audio hash):
  1. ffmpeg decodes to PCM.
  2. Spectral-flux onsets.
  3. Tempo by autocorrelation.
  4. Dynamic-programming beat tracking.
  5. Downbeats by accent energy.
  6. A section-novelty curve.
  7. Per-frame band envelopes.

  The output is `beatmap.json`, and manual overrides always win. AGPL libraries such as essentia.js are deliberately avoided so commercial use stays clean.
- **Runtime:** `useBeat()` and `useSpectrum()` read the beatmap, and per-frame FFT is kept for fine reactivity.
- **SFX:** cues are placed on transitions, reveals and impulses from the look's pack. Volume curves are pure functions of frame (ducking).
- **Mastering:** the post-render ffmpeg `loudnorm` two-pass targets -14 LUFS / -1 dBTP, then the result is re-measured.

### 5.5 Planner (`src/engine/plan`)
- **Pure TypeScript, no React, unit-tested.** It runs these steps in order:
  1. zod-validate the FilmSpec, with field-path diagnostics.
  2. Resolve the look and merge overrides.
  3. Resolve assets (exists, hash, dimensions).
  4. Load or create the beatmap.
  5. Resolve every `TimeRef` to absolute frames.
  6. Snap scene boundaries to the grid and fit the total duration.
  7. Lay out the overlay per aspect and fail on overflow.
  8. Auto-place SFX cues.
  9. Emit the RenderPlan.
- `Root.tsx` registers `film × aspect` compositions automatically. `calculateMetadata` derives duration from the plan, so a duration of `"music"` works.
- **The zod schemas are the single source of truth:** TS types are inferred from them, and a JSON Schema is exported for editors and for the future LLM director.

### 5.6 Render profiles (`scripts/render.ts`)
Profiles change only resolution, sampling and encode settings, never content.

| Profile | Scale | 3D motion blur | Frames | Encode |
| :--- | :--- | :--- | :--- | :--- |
| draft | 0.5× | off | JPEG | CRF 23, fast |
| preview | 1× | off | JPEG q90 | CRF 18 |
| master | 2× supersample → lanczos | 8–16 samples, 180° shutter | PNG | x264 CRF 14 slow, `yuv420p`, BT.709 tags, AAC 48 kHz, loudnorm |

Settings for every profile:
- `gl: "angle"` (to be verified in M0 as hardware WebGL2 on the Radeon iGPU via D3D11)
- concurrency 1–2 for 3D
- chunked frame ranges, so renders can resume

---

## 6. Determinism contract
1. Every visual value is `f(t)`. Remotion forces `frameloop="never"` while rendering and calls `advance(performance.now())`, so **anything reading R3F's clock, delta or `useFrame` state is non-deterministic.** This rules out drei `<Float>`, time-driven drei materials and postprocessing noise/glitch. Those get replaced with frame-pure equivalents.
2. All randomness is `rng(seed, elementId, …)`.
3. Every async resource sits behind `delayRender()`: textures, GLB, fonts, troika SDF glyphs, PMREM environment, beatmap. Failure calls `cancelRender()` with a clear message. **No placeholders, ever.**
4. Particles and camera noise are closed-form, never simulated.
5. Tests:
   - The same frame rendered twice gives byte-identical PNGs (same machine).
   - Frame N rendered alone matches frame N rendered in sequence (scrub-safety).
   - Golden frames are checked with SSIM.

---

## 7. Phase C: "Engine Capability Showcase" (30 s, cyber look, 120 BPM ⇒ 15 bars)

| Bars | Time | Scene | What it proves |
| :--- | :--- | :--- | :--- |
| 1–2 | 0–4 s | **Cold open:** darkness; dust particles converge into a liquid-chrome icosahedron that melts into a torus knot by bar 2; 85 mm push-in; "One config." masked rise on beat 3 | particles-to-form, PBR chrome, Lightformer reflections, DoF, kinetic type |
| 3–4 | 4–8 s | **Morph:** torus knot → sphere → rounded box, one shape per downbeat; material shifts from chrome to iridescent glass; orbit | geometry morphing, transmission/iridescence, beat-locked keys |
| 5–7 | 8–14 s | **Telemetry** (light-sweep in): grid floor, orbiting glass UI cards, HUD overlay, line chart drawing on, FPS counter rolling; CA on impulses | shader transition, cards, HUD kit, data-viz, audio mods |
| 8–10 | 14–20 s | **Type wall:** per-glyph springs, decode/scramble, outline-fill; SDF text in 3D with a rack focus between words | typography engine, text3d, focus pulls |
| 11–12 | 20–24 s | **Peak** (glitch-slice in): 60k-particle flow storm, whip pan, strongest impulses | particle scale, glitch transition, camera rigs |
| 13–15 | 24–30 s | **Resolve:** particles assemble the extruded logo in brushed metal on a reflective floor; strip-light sweep; "Built from config." on the musical tail | logo extrusion, reflector floor, light sweep, calm resolve |

Delivered in 16:9, 9:16 and 1:1 from the **same file**, with ffprobe, loudness and contact-sheet evidence.

---

## 8. Build order (Phase B)

| # | Milestone | Days | Done when |
| :--- | :--- | :---: | :--- |
| M0 | **Foundation**: repo hygiene, pinned 3D stack, `gl: angle`, BT.709/`yuv420p`, a GL probe composition, determinism harness | 0.5–1 | Probe shows a hardware WebGL2 renderer string in a headless render; the same frame twice gives identical bytes |
| M1 | **3D/Shader core vertical slice**: time core, Stage, nodes (primitive, morph, particles, logo), 6 materials, 2 light rigs + environments, camera rigs (orbit, pushIn, dolly, impulse) with aspect framing, post stack (ACES, bloom, DoF, CA, grain, vignette, SMAA), 2 GPU transitions; each with its schema slice | 5–8 | A small config renders a 1080p clip in all 3 aspects; stills reviewed; determinism and scrub tests pass; per-frame cost logged |
| M2 | **Schema + planner**: zod slices composed, time grammar, beat snapping, look resolution, RenderPlan, auto-registration | 2–3 | Unit tests green; invalid configs fail with field-path diagnostics |
| M3 | **Typography & Data engine** | 4–6 | Reveal registry, charts, HUD/UI kits, aspect-solved layout with zero overflow |
| M4 | **Audio & beat engine** | 3–5 | Beatmap within ±1 frame of hand-marked beats on test tracks; SFX auto-cues; -14 LUFS measured |
| M5 | **Motion library completion**: remaining transitions and rigs, enter/exit vocabulary, 3D motion blur | 3–4 | Every registry entry has a test clip |
| M6 | **Looks**: keynote, cyber, futurist | 2–3 | The same FilmSpec renders convincingly in all three looks |
| C | **Showcase + critique loop** | 3–5 | 3 aspect masters + evidence package |

**Total: about 23–35 working days (5–7 weeks).** The dominant cost is look-dev iterations, not code volume.

A later **Phase D** adds the LLM director: Brief → FilmSpec, schema-constrained, output validated by the same zod schemas. Because the engine never calls an AI service at render time, it stays deterministic.

---

## 9. Risks

| Risk | Mitigation |
| :--- | :--- |
| Headless Chrome on this iGPU falls back to software GL or loses contexts | M0 probe across `angle`/`angle-egl`/`vulkan`/`swangle`; concurrency 1–2; `swangle` as a slow but deterministic fallback |
| Master render time on a laptop iGPU (estimate: 0.2–1 s per frame before motion blur; ×8–16 with it) | Draft/preview profiles for iteration; chunked, resumable masters; heavy masters can run overnight or offload to a GPU box later |
| Library helpers silently breaking determinism | §6 contract plus automated byte-identity and scrub tests from M0 |
| DOM text doesn't receive 3D post effects | Documented split (§3); `text3d` for text that needs it |
| Music licensing for the showcase | Needs a decision (below) |
| Remotion license | Free for individuals and small companies; check whether a company license applies before paid client work |

---

## 10. Build log

### M0: Foundation (done)
- Fakes removed: the CSS phone, SaveFix code, CSS-3D primitives, legacy compositions, committed build output and logs. The stack is pinned (three 0.187, R3F 9.8.2, drei 10.7.9, postprocessing 6.39.6, @remotion/three 4.0.545).
- `pnpm probe` checks each GL backend on this machine:
  - `angle` and `vulkan`: hardware Radeon.
  - `angle-egl`: software (Microsoft Basic Render).
  - `swangle`: software (SwiftShader).
  - Default: `angle`.
- `pnpm determinism <id>` checks that repeat renders and in-sequence renders are byte-identical.

### M1: 3D/shader core (done)
| Area | What exists |
| :--- | :--- |
| Time | `src/engine/time`: seeded rng, beat grid and impulses, the time grammar (`"2b"`, `"bar 5"`, `"40%"`, `"2 bars"`), eases (springs fitted to durations), and animatable values with additive keyframes and beat modulators. |
| Stage | `src/stage3d/Stage.tsx`: one WebGL context per film; scenes mount inside their windows; each scene owns a scene, an fx scene, a camera and a post pipeline. One `useFrame(…, 1)` orchestrator renders, and it reads only film time. |
| Nodes | `morph` (parametric shapes with a shared (u,v) domain, normals from finite differences, any shape → any shape, full PBR via CSM), `primitive`, `logo` (SVG → bevelled extrusion), `particles` (GPU, closed form, form-to-morph/logo, soft depth, in-shader bokeh). |
| Look | 9 PBR material presets; 3 lightformer rigs baked into PMREM; void, gradient and grid backdrops. |
| Camera | Lens in mm applied to the frame's short side; framing by bounding-radius fill; orbit, pushIn, pullBack, crane, truck, seeded handheld, and beat impulse. |
| Post | MSAA HDR → DoF → particles → bloom → chromatic aberration (motion-driven) + ACES/AgX + vignette. |
| Transitions | Compositor: dissolve, noiseDissolve, lightSweep, glitchSlice, zoomThrough; plus sRGB encode, seeded grain and dither. |
| Films | `src/films/*` are registered automatically × 16:9 / 9:16 / 1:1 in `Root.tsx`. |

### Rules M1 added to the determinism contract (§6)
7. **Pull, don't push, per-frame values into GPU state.** Values that a pass needs every frame (focus distance, depth texture, resolution) are read by the pass at render time. Pushing them from a parent's React effect broke determinism when a child mounted asynchronously: an SVG load re-rendered the particle node but not its host, so the first frame of a page used the default focus. `pnpm determinism` caught it on the scrub check.
8. **Glass is not a depth occluder for particles.** When a scene has transmissive meshes, the particle pass renders its own depth prepass without them. Otherwise glass reads as opaque.
9. **No `instanceof` on materials.** three-custom-shader-material copies properties onto a plain `Material`; use `asPhysical()`.
