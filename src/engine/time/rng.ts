/**
 * Seeded randomness. Every random stream in the engine derives from (film seed, element path),
 * so the same config always produces the same pixels. Math.random is never used.
 */

/** FNV-1a 32-bit string hash. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, statistically solid 32-bit PRNG returning [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deterministic stream for one element, e.g. rng(seed, "scene:hook", "node:dust"). */
export function rng(seed: number, ...path: Array<string | number>): () => number {
  return mulberry32(hashString(`${seed}/${path.join("/")}`));
}
