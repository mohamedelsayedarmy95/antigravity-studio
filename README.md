# studio-engine: Universal Capability Engine

Config-driven cinematic motion graphics on Remotion + React Three Fiber.
Architecture and roadmap: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Commands

| Command | What it does |
| :--- | :--- |
| `pnpm install` | Install pinned dependencies (store: `D:\.pnpm-store`) |
| `pnpm dev` | Remotion Studio |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm probe` | Probe headless GPU backends; writes `.cache/gl-profile.json` |
| `pnpm determinism <CompositionId>` | Byte-identity and scrub-safety check on rendered frames |

## Rendering rules
- GL backend is `angle` (verified: hardware Radeon via Direct3D 11). `angle-egl` and `swangle` fall back to software on this machine.
- Every animated value must be a pure function of the current frame. No `Math.random`, no clock reads, no self-animating helpers.
