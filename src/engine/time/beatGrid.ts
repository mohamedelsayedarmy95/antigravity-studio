/**
 * Musical time. A BeatGrid maps seconds ↔ beats/bars. In M4 the grid comes from offline beat
 * analysis of the music; until then a film declares it (bpm, offset, meter).
 */
export interface BeatGrid {
  bpm: number;
  /** Seconds from film start to the first downbeat. */
  offset: number;
  beatsPerBar: number;
}

export const secondsPerBeat = (grid: BeatGrid) => 60 / grid.bpm;

/** Continuous beat position at absolute time t (seconds). Negative before the first downbeat. */
export const beatAt = (grid: BeatGrid, t: number) => (t - grid.offset) / secondsPerBeat(grid);

export const beatsToSeconds = (grid: BeatGrid, beats: number) => beats * secondsPerBeat(grid);

export interface ImpulseOptions {
  /** Fire every N beats (1 = every beat, beatsPerBar = downbeats). */
  every?: number;
  /** Beat offset of the first impulse (e.g. 1 = off-beat start). */
  phase?: number;
  /** Exponential decay time constant in seconds. */
  decay?: number;
  /** Attack time constant in seconds; a hair of attack avoids single-frame pops. */
  attack?: number;
}

/**
 * Beat-locked impulse envelope in [0, 1]: a fast attack then exponential decay after every
 * `every` beats. Pure function of t, so it is safe for scrubbing and parallel rendering.
 */
export function beatImpulse(grid: BeatGrid, t: number, options: ImpulseOptions = {}): number {
  const every = options.every ?? 1;
  const decay = options.decay ?? 0.18;
  const attack = options.attack ?? 0.012;
  const beats = beatAt(grid, t) - (options.phase ?? 0);
  if (beats < 0) return 0;
  const since = (beats % every) * secondsPerBeat(grid);
  return Math.exp(-since / decay) * (1 - Math.exp(-since / attack));
}

/** Index of the impulse currently decaying (useful for alternating directions per beat). */
export function impulseIndex(grid: BeatGrid, t: number, every = 1, phase = 0): number {
  return Math.floor((beatAt(grid, t) - phase) / every);
}
