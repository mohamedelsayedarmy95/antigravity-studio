# Motion Engine Performance Budget & Quality Gates

This performance budget establishes non-negotiable engineering thresholds for all Remotion video compositions, 3D device layers, shader pipelines, and kinetic typography across the studio.

---

## 1. Core Performance Targets

| Metric | Target Ceiling / Floor | Measurement Protocol | Impact Surface |
| :--- | :--- | :--- | :--- |
| **Frame Render Time Budget** | **> 90% of frames $\le 16.67\text{ms}$** | Remotion headless verbose log (`--log=verbose`) analyzing `cleared after Xms` | Deterministic Chromium rendering speed, CI/CD pipeline |
| **Remotion Studio Preview FPS** | **$\ge 55.0\text{ FPS}$** (target $60\text{ FPS}$) | Built-in Remotion Studio canvas FPS counter during live playback | Developer iteration speed, smooth previewing |
| **1080p @ 60 FPS Render Time** | **$< 60\text{ seconds}$** for a $30\text{s}$ video ($1,800\text{ frames}$) | CLI wall clock duration using multi-thread Chromium rasterization | Quick export for client & App Store review cycles |
| **4K @ 60 FPS Master Render Time** | **$< 5\text{ minutes}$** for a $30\text{s}$ master ($1,800\text{ frames}$) | Remotion CLI render at $3840 \times 2160$ with hardware acceleration | Final broadcast & Apple keynote export |
| **TypeScript Type Safety** | **0 errors** (`strict: true`, no `any`) | `pnpm exec tsc --noEmit` | Code stability, refactoring safety |

---

## 2. Rendering & Optimization Rules

1. **Blur Radius Discipline**:
   - Never apply `backdrop-filter: blur(>16px)` on elements containing rapidly mutating text or numbers (e.g. per-frame HUD telemetry).
   - Use high-contrast tinted glass surfaces (`bg-[#0B0D14]/90 border border-white/10 shadow-2xl`) for active telemetry.
   - For character-level kinetic text animations (`split="chars"`), use `maxBlur: 0` to prevent launching dozens of concurrent SVG blur kernels. Keep blur to word-level or container-level transitions.

2. **Optical Channel Dispersion (Chromatic Aberration)**:
   - Never use nested `drop-shadow` for chromatic aberration (which produces an outer colored halo).
   - Use true SVG channel separation (`feOffset` + `feColorMatrix` + `feBlend mode="screen"`) to physically disperse Red and Cyan channels.
   - When motion is stationary or velocity $< 0.04$, dynamically bypass the filter (`filter: "none"`) to drop compositor cost to zero.
   - *Architecture Note (Phase 3+)*: If Scene 2 drops below 90% when 3D is added, revisit the ChromaticAberration cost and clamp filter activation to peak velocity moments only.

3. **GPU Hardware Acceleration & Compositor Layers**:
   - Explicitly declare `willChange: "transform, opacity, filter"` on all actively translating or scaling nodes.
   - Stagger heavy entrance animations by 2–4 frames to prevent compositor rasterization pileups.
   - Keep 3D transforms (`rotateX`, `rotateY`, `translateZ`) isolated inside `preserve-3d` containers with dedicated perspective roots.

---

## 3. Enforcement Gate

Before any phase is declared complete:
1. Run `remotion studio` and verify preview maintains $\ge 55\text{ FPS}$.
2. Run verbose render: `npx remotion render <CompId> --log=verbose`.
3. Parse frame times to verify $>90\%$ of frames execute under $16.67\text{ms}$.
4. If breached, optimize before proceeding to the next layer.
