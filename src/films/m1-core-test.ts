import type { FilmSpecInput } from "../engine/schema/film";

/**
 * M1 vertical-slice film: exercises every 3D-core capability from config alone.
 * 120 BPM grid (1 bar = 2 s). 10 bars = 20 s.
 *
 *  genesis  (3 bars)  particles converge into liquid chrome; icosahedron → torus knot → sphere
 *  prism    (2 bars)  light-sweep in; iridescent glass morph, neon gel lighting, particle ring
 *  grid     (2 bars)  glitch-slice in; chrome knot over a beat-pulsing cyber grid, data dust
 *  mark     (3 bars)  noise-dissolve in; particles assemble the extruded brushed-metal mark
 */
export const m1CoreTest: FilmSpecInput = {
  schemaVersion: "1",
  id: "m1-core-test",
  seed: 7,
  look: "cyber",
  output: { fps: 60, aspects: ["16x9", "9x16", "1x1"] },
  audio: { grid: { bpm: 120, offset: 0, beatsPerBar: 4 }, quantize: "bar" },
  palette: {
    base: "#04060a",
    surface: "#0c1624",
    ink: "#e8edf2",
    primary: "#22d3ee",
    accent: "#a3ff12",
    glow: "#eaf4ff",
  },
  post: {
    toneMapping: "aces",
    bloom: { intensity: 1.1, threshold: 0.9, smoothing: 0.25, radius: 0.8 },
    vignette: { darkness: 0.6, offset: 0.28 },
    grain: 0.035,
  },
  timeline: [
    {
      id: "genesis",
      length: "3 bars",
      transitionIn: { type: "dissolve", length: "2b" },
      world: {
        backdrop: { type: "void", color: "palette.base" },
        lighting: { rig: "stripRim", rotation: { keys: [{ at: 0, value: -45 }, { at: "100%", value: 35, ease: "smooth" }] } },
        nodes: [
          {
            id: "dust",
            type: "particles",
            count: 60000,
            emitter: { shape: "sphere", radius: 7 },
            size: 0.012,
            color: "palette.glow",
            colorB: "palette.primary",
            intensity: 2.6,
            drift: { amount: 0.22, frequency: 0.55, speed: 0.22 },
            swirl: 0.22,
            form: {
              target: { node: "core" },
              progress: { keys: [{ at: 0, value: 0 }, { at: "6b", value: 1, ease: "smooth" }] },
              stagger: 0.55,
              jitter: 0.015,
            },
            opacity: { keys: [{ at: "5b", value: 1 }, { at: "8b", value: 0.18, ease: "smooth" }] },
            bokeh: 0.35,
          },
          {
            id: "core",
            type: "morph",
            shapes: ["icosahedron", "torusKnot", "sphere"],
            keys: [0, "8b", "10.5b"],
            morphLength: "1.5b",
            ease: "appleHero",
            material: "liquidChrome",
            enter: { style: "scale", at: "4b", length: "2.5b", ease: "appleHero" },
            rotation: { keys: [{ at: 0, value: [10, -30, 0] }, { at: "100%", value: [25, 150, 8], ease: "smooth" }] },
            surfaceNoise: { amount: { keys: [{ at: "7b", value: 0 }, { at: "9b", value: 0.07 }, { at: "11b", value: 0.015 }] }, frequency: 1.8, speed: 0.6 },
          },
        ],
      },
      camera: {
        lens: 85,
        distance: { radius: 1.15, fill: 0.62 },
        elevation: 6,
        moves: [
          { rig: "pushIn", amount: 0.16, ease: "smooth" },
          { rig: "orbit", degrees: 24, ease: "smooth" },
          { rig: "impulse", on: "downbeat", scale: 0.012, roll: 0.35 },
        ],
      },
      post: {
        dof: { focus: "target", range: 1.4, bokeh: 2.5 },
        chromaticAberration: { mode: "motion", amount: 1 },
      },
    },
    {
      id: "prism",
      length: "2 bars",
      transitionIn: { type: "lightSweep", length: "1b", color: "palette.glow" },
      world: {
        backdrop: { type: "gradient", inner: "palette.surface", outer: "palette.base" },
        lighting: { rig: "neonGels", intensity: 2, rotation: { keys: [{ at: 0, value: 20 }, { at: "100%", value: -30 }] } },
        nodes: [
          {
            id: "glass",
            type: "morph",
            shapes: ["roundedBox", "torus", "sphere"],
            keys: [0, "2b", "5b"],
            morphLength: "1.5b",
            ease: "spatialElastic",
            material: "iridescentGlass",
            rotation: { keys: [{ at: 0, value: [20, 0, 0] }, { at: "100%", value: [35, 200, 10], ease: "linear" }] },
            scale: { base: 1, mod: { source: "beat", amount: 0.025 } },
          },
          {
            id: "ring",
            type: "particles",
            count: 26000,
            emitter: { shape: "disc", radius: 3.2 },
            rotation: [12, 0, -8],
            size: 0.008,
            color: "palette.accent",
            colorB: "palette.primary",
            intensity: { base: 2.2, mod: { source: "beat", amount: 1.6 } },
            swirl: 0.55,
            drift: { amount: 0.08, frequency: 0.8, speed: 0.3 },
            bokeh: 0.25,
          },
        ],
      },
      camera: {
        lens: 50,
        distance: { radius: 1.2, fill: 0.48 },
        elevation: 14,
        moves: [
          { rig: "orbit", degrees: 55, ease: "smooth" },
          { rig: "crane", amount: -0.5, ease: "smooth" },
          { rig: "impulse", on: "beat", scale: 0.01, roll: 0.25 },
        ],
      },
      post: { dof: { focus: "target", range: 2.2, bokeh: 1.5 }, bloom: { intensity: 1.3 } },
    },
    {
      id: "grid",
      length: "2 bars",
      transitionIn: { type: "glitchSlice", length: "1b", color: "palette.primary" },
      world: {
        backdrop: { type: "grid", line: "palette.primary", base: "palette.base", cell: 0.4, height: -1.25, glow: { base: 1.3, mod: { source: "beat", amount: 1.2 } }, scroll: 1.2 },
        lighting: { rig: "neonGels", intensity: 1.4 },
        nodes: [
          {
            id: "knot",
            type: "morph",
            shapes: ["torusKnot", "icosahedron"],
            keys: [0, "4b"],
            morphLength: "1b",
            ease: "teslaTelemetry",
            material: "chrome",
            position: [0, 0.15, 0],
            rotation: { keys: [{ at: 0, value: [0, 0, 0] }, { at: "100%", value: [60, 240, 0], ease: "linear" }] },
          },
          {
            id: "data",
            type: "particles",
            count: 40000,
            emitter: { shape: "box", radius: 5, extent: [6, 1.6, 6] },
            size: 0.008,
            color: "palette.primary",
            colorB: "palette.accent",
            intensity: { base: 1.8, mod: { source: "beat", amount: 2.5, decay: 0.12 } },
            drift: { amount: 0.35, frequency: 0.35, speed: 0.4 },
            bokeh: 0.08,
          },
        ],
      },
      camera: {
        lens: 35,
        distance: 4.2,
        elevation: 9,
        moves: [
          { rig: "truck", amount: 0.8, ease: "smooth" },
          { rig: "orbit", degrees: -20, ease: "smooth" },
          { rig: "handheld", amount: 0.35 },
          { rig: "impulse", on: "downbeat", scale: 0.02, roll: 0.8 },
        ],
      },
      post: { dof: false, chromaticAberration: { mode: "motion", amount: 1.6 }, bloom: { intensity: 1.4, threshold: 0.8 } },
    },
    {
      id: "mark",
      length: "3 bars",
      transitionIn: { type: "noiseDissolve", length: "1.5b", color: "palette.accent" },
      world: {
        backdrop: { type: "gradient", inner: "#101722", outer: "palette.base" },
        lighting: { rig: "studioSoftbox", rotation: { keys: [{ at: 0, value: -60 }, { at: "100%", value: 50, ease: "smooth" }] } },
        nodes: [
          {
            id: "swarm",
            type: "particles",
            count: 60000,
            emitter: { shape: "shell", radius: 7 },
            size: 0.01,
            color: "palette.glow",
            colorB: "palette.accent",
            intensity: 2.2,
            swirl: 0.35,
            drift: { amount: 0.15, frequency: 0.7, speed: 0.3 },
            form: {
              target: { node: "logo" },
              progress: { keys: [{ at: 0, value: 0 }, { at: "5b", value: 1, ease: "smooth" }] },
              stagger: 0.5,
              jitter: 0.006,
            },
            opacity: { keys: [{ at: "4.5b", value: 1 }, { at: "7b", value: 0.08, ease: "smooth" }] },
            bokeh: 0.3,
          },
          {
            id: "logo",
            type: "logo",
            src: "brand/engine-mark.svg",
            depth: 0.14,
            bevel: 0.014,
            scale: 1.6,
            material: "brushedMetal",
            enter: { style: "scale", at: "4b", length: "2b", ease: "appleHero" },
            rotation: { keys: [{ at: 0, value: [0, -25, 0] }, { at: "100%", value: [0, 18, 0], ease: "smooth" }] },
          },
        ],
      },
      camera: {
        lens: 70,
        distance: { radius: 1.0, fill: 0.7 },
        elevation: 4,
        moves: [{ rig: "pushIn", amount: 0.12, ease: "smooth" }],
      },
      post: { dof: { focus: "target", range: 1.2, bokeh: 1.8 }, chromaticAberration: false },
    },
  ],
};
