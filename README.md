# VeloraFrame Studio

VeloraFrame Engine turns validated product briefs and typed film specifications into cinematic motion graphics with Remotion and Three.js.
See the [engine architecture](docs/ARCHITECTURE.md) and the [reproducible Relay example](examples/studio-cut-demo/README.md).

## Commands

Use the Node version in `.nvmrc` and the pnpm version in `package.json`. Corepack selects the pinned pnpm version when invoked as `corepack pnpm`. Factory and delivery checks require FFmpeg and FFprobe on PATH.

| Command | What it does |
| :--- | :--- |
| `pnpm install --frozen-lockfile --ignore-scripts` | Install pinned dependencies (store: `D:\.pnpm-store`) |
| `pnpm dev` | Remotion Studio |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm probe` | Probe headless GPU backends; writes `.cache/gl-profile.json` |
| `pnpm determinism <CompositionId>` | Byte-identity and scrub-safety check on rendered frames |

## Rendering rules
- GL backend is `angle` (verified: hardware Radeon via Direct3D 11). `angle-egl` and `swangle` fall back to software on this machine.
- Every animated value must be a pure function of the current frame. No `Math.random`, no clock reads, no self-animating helpers.
