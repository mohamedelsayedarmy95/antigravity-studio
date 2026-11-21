import type { FilmSpecInput } from "../engine/schema/film";

/**
 * M2 test film: kinetic type, counters, charts and HUD over the 3D stage, timed in musical units.
 * Exercises markers ("@drop", "@type.hit"), look defaults, and cut snapping: "data" asks for 3.8 s
 * and the compiler snaps its cut to the bar (4 s).
 */
export const m2TypeData: FilmSpecInput = {
  schemaVersion: "1",
  id: "m2-type-data",
  seed: 11,
  look: "cyber",
  output: { fps: 60, aspects: ["16x9", "9x16", "1x1"] },
  audio: { grid: { bpm: 120, offset: 0, beatsPerBar: 4 }, quantize: "bar" },
  data: {
    throughput: [18, 24, 22, 31, 38, 35, 44, 52, 49, 58, 60],
    gpu: [87],
  },
  markers: { drop: "bar 3" },
  timeline: [
    {
      id: "hook",
      length: "2 bars",
      transitionIn: { type: "dissolve", length: "1b" },
      world: {
        lighting: { rig: "stripRim", rotation: { keys: [{ at: 0, value: -30 }, { at: "100%", value: 30 }] } },
        nodes: [
          {
            id: "core",
            type: "morph",
            shapes: ["icosahedron", "sphere"],
            keys: [0, "4b"],
            morphLength: "1.5b",
            material: "liquidChrome",
            enter: { style: "scale", at: 0, length: "2b" },
            rotation: { keys: [{ at: 0, value: [10, 0, 0] }, { at: "100%", value: [20, 90, 0], ease: "smooth" }] },
          },
          {
            id: "dust",
            type: "particles",
            count: 20000,
            emitter: { shape: "sphere", radius: 6 },
            size: 0.01,
            color: "palette.glow",
            colorB: "palette.primary",
            intensity: 1.8,
            drift: { amount: 0.25 },
            bokeh: 0.3,
          },
        ],
      },
      camera: { lens: 70, distance: { radius: 1.1, fill: 0.42 }, elevation: 6, moves: [{ rig: "pushIn", amount: 0.1 }] },
      post: { dof: { range: 1.6, bokeh: 2 } },
      overlay: [
        { kind: "text", role: "label", content: "Universal Capability Engine", anchor: "topLeft", width: 0.6, at: "0.5b" },
        { kind: "text", role: "display", content: "One config.", emphasis: ["config."], anchor: "bottom", reveal: "maskedRise", at: "1b" },
      ],
    },
    {
      id: "data",
      length: "3.8s",
      transitionIn: { type: "glitchSlice", length: "1b", color: "palette.primary" },
      world: {
        backdrop: { type: "grid", cell: 0.4, height: -1.25, glow: { base: 1.1, mod: { source: "beat", amount: 0.8 } }, scroll: 1 },
        nodes: [
          {
            id: "data-dust",
            type: "particles",
            count: 26000,
            emitter: { shape: "box", radius: 5, extent: [6, 1.6, 6] },
            size: 0.008,
            color: "palette.primary",
            colorB: "palette.accent",
            intensity: { base: 1.6, mod: { source: "beat", amount: 2 } },
            drift: { amount: 0.3, speed: 0.4 },
            bokeh: 0.15,
          },
        ],
      },
      camera: { lens: 35, distance: 4.5, elevation: 10, moves: [{ rig: "truck", amount: 0.6 }, { rig: "impulse", on: "downbeat", scale: 0.015 }] },
      overlay: [
        {
          kind: "hud",
          preset: "telemetry",
          anchor: "topLeft",
          width: 0.42,
          label: "Render // Telemetry",
          rows: [
            { label: "Frame", value: 1200 },
            { label: "GPU", value: "D3D11" },
            { label: "Determinism", value: "PASS" },
          ],
        },
        { kind: "counter", to: 60, suffix: " fps", label: "Target", anchor: "topRight", width: 0.3, at: "2b" },
        { kind: "chart", chart: "area", data: "throughput", label: "Throughput / frames per second", anchor: "bottomLeft", width: 0.56, height: 0.3, at: "1b", length: "3b" },
        { kind: "chart", chart: "ring", data: "gpu", label: "GPU load", suffix: "%", anchor: "right", width: 0.22, offset: [0, 0.05], at: "@drop+1b" },
      ],
    },
    {
      id: "type",
      length: "2 bars",
      transitionIn: { type: "lightSweep", length: "1b" },
      markers: { hit: "1b" },
      world: {
        backdrop: { type: "gradient", inner: "palette.surface", outer: "palette.base" },
        nodes: [
          {
            id: "ring",
            type: "particles",
            count: 16000,
            emitter: { shape: "disc", radius: 3.4 },
            rotation: [70, 0, 0],
            size: 0.008,
            color: "palette.accent",
            colorB: "palette.primary",
            intensity: 1.6,
            swirl: 0.4,
            bokeh: 0.2,
          },
        ],
      },
      camera: { lens: 50, distance: 6, elevation: 0 },
      overlay: [
        { kind: "hud", preset: "brackets", anchor: "center", width: 0.72, height: 0.5, label: "Specimen 03" },
        { kind: "text", role: "headline", content: "Every frame, exact.", emphasis: ["exact."], anchor: "center", reveal: "perGlyph", at: "@type.hit" },
        { kind: "text", role: "body", content: "Deterministic. Seeded. Scrub-safe.", anchor: "bottom", reveal: "typewriter", at: "3b" },
      ],
    },
    {
      id: "resolve",
      length: "2 bars",
      transitionIn: { type: "noiseDissolve", length: "1.5b", color: "palette.accent" },
      world: {
        backdrop: { type: "gradient", inner: "#101722", outer: "palette.base" },
        lighting: { rig: "studioSoftbox", rotation: { keys: [{ at: 0, value: -50 }, { at: "100%", value: 40 }] } },
        nodes: [
          {
            id: "logo",
            type: "logo",
            src: "brand/engine-mark.svg",
            scale: 1.1,
            position: [0, 0.25, 0],
            material: "brushedMetal",
            enter: { style: "scale", at: "1b", length: "2b" },
          },
        ],
      },
      camera: { lens: 70, distance: { radius: 1.1, fill: 0.55 }, elevation: 3, moves: [{ rig: "pushIn", amount: 0.08 }] },
      overlay: [
        { kind: "text", role: "label", content: "M2 · Type & Data Engine", anchor: "top", reveal: "fade", at: "1b", exit: "none" },
        { kind: "text", role: "headline", content: "Built from config.", emphasis: ["config."], anchor: "bottom", reveal: "blurIn", at: "3b", exit: "none" },
      ],
    },
  ],
};
