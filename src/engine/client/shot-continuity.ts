/**
 * A film's GPU scene transition is centered on the nominal cut. Studio Cut's product UI and
 * text switch at the nominal cut. A small opacity change tracks the GPU window while
 * the active shot remains visible on both sides of the edit.
 *
 * This never changes the film timeline, the approved copy, or the prepared media frames.
 */
export type ContinuityScene = {
  start: number;
  transitionIn: { start: number; end: number } | null;
};

const smooth = (v: number): number => {
  const x = Math.max(0, Math.min(1, v));
  return x * x * (3 - 2 * x);
};

const maxAttenuation = 0.1;

export function editorialContinuityOpacity(
  scenes: readonly ContinuityScene[], sceneIndex: number, absoluteSeconds: number,
): number {
  const current = scenes[sceneIndex];
  if (!current) return 1;

  const next = scenes[sceneIndex + 1];
  const exit = next?.transitionIn;
  if (exit && absoluteSeconds >= exit.start && absoluteSeconds < next.start) {
    const duration = next.start - exit.start;
    return duration > 0 ? 1 - maxAttenuation * smooth((absoluteSeconds - exit.start) / duration) : 1;
  }

  const entry = current.transitionIn;
  if (entry && absoluteSeconds >= current.start && absoluteSeconds < entry.end) {
    const duration = entry.end - current.start;
    return duration > 0 ? 1 - maxAttenuation * (1 - smooth((absoluteSeconds - current.start) / duration)) : 1;
  }
  return 1;
}
