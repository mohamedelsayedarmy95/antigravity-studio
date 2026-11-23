# VeloraFrame Engine architecture

VeloraFrame Engine turns a typed film specification into frame-driven Remotion compositions. The factory also accepts versioned client briefs, validates local assets, and maps editorial choices to the existing FilmSpec compiler. See the [factory operator playbook](FACTORY_OPERATOR_PLAYBOOK.md) for CLI workflows and evidence paths.

## Current boundaries

| Area | Owners and responsibilities |
| --- | --- |
| Engine core | `src/engine/compile` and `src/engine/time` resolve film specifications, beat grids, and animation tracks. `src/motion`, `src/typography`, and `src/audio` provide shared motion, text, local font loading, and audio utilities. These capabilities serve multiple projects. |
| Composition and rendering | `src/index.ts` and `src/Root.tsx` register compositions. `src/engine/Film.tsx` combines DOM/SVG layers with the R3F stage in `src/stage3d`. The stage owns 3D scenes, camera, lighting, and post-processing. `scripts/lib/client-render.ts` and the delivery scripts own asset staging and export. |
| Device presentation | `src/layer2d/ScreenLayer.tsx` and `src/engine/client/screen.ts` keep screen fitting, cropping, and playback reusable. CSS/DOM framing is suitable for readable product UI. Three.js serves shots that need spatial perspective, geometry, or lighting. Both approaches remain available. |
| Shot recipes | `src/engine/client/shot-recipes.ts`, `studio-cut.ts`, and related editorial modules describe reusable hooks, reveals, guided demos, interaction-to-result beats, and calls to action. Copy, timing, screen selection, and brand styling can vary per project. |
| Project data | `src/films` contains built-in film specifications and composition-specific code. Client briefs and media belong in their own project directories. Keep screenshots, recordings, copy, brand assets, and shot configuration with the client project wherever practical. |

## Schema ownership (§2.6)

`src/engine/schema/film.ts` composes the Zod schemas for stage, overlay, and time data. `src/engine/client/brief.ts` owns client brief validation and migration. Add typed scene configuration incrementally when a production requirement warrants it, using the current compiler and schema contracts.

## Compatibility and development

Preserve existing composition IDs, legacy editorial modes, and supported brief and FilmSpec versions. Drive animation from the current frame and a stable seed where applicable. Verify scoped rendering changes with repeated PNG stills and adjacent motion samples. Keep local fonts, the client media boundary, and render-readiness behavior intact.

Use the Node version in `.nvmrc` and the pnpm version in `package.json`. The quality workflow runs lint with TypeScript, unit tests, and the factory CLI integration suite. The separate render integration and targeted frame checks cover the rendering path locally.
