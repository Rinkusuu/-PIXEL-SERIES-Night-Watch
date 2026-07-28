/**
 * Deterministic pseudo-random. The world must be identical between redraws —
 * a skyline that reshuffles on every cache rebuild is a skyline made of static.
 */
export function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** A stateful stream from one seed, for generators that need many draws. */
export function stream(seed: number): () => number {
  let i = seed;
  return () => rand(i++);
}

/**
 * Stable 32-bit FNV-1a hash. Lets `nightKey()` seed the weather without
 * parsing the date back out of the string.
 */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
