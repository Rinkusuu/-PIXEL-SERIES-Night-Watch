/** Three notches: full, reduced, minimum. */
export const NOTCHES = 3;

/** Over this and we shed texture. Addendum §B.3 as amended. */
export const DROP_MS = 8;

/**
 * Under this and we take it back. The gap between the two thresholds is the
 * hysteresis: with a single threshold a load sitting exactly on the line makes
 * the picture pump between notches once a second, which is worse than either.
 */
export const RAISE_MS = 5;

export const WINDOW = 30;

export function qualityStep(avgMs: number, notch: number): number {
  if (avgMs > DROP_MS) return Math.min(NOTCHES - 1, notch + 1);
  if (avgMs < RAISE_MS) return Math.max(0, notch - 1);
  return notch;
}

/**
 * Owns the only frame timing in the app. Modules receive a notch; none of them
 * measures its own clock, because two clocks disagreeing is how you get one
 * layer at full detail beside another at minimum.
 */
export function createFrameClock(window = WINDOW) {
  const samples: number[] = [];
  let notch = 0;
  return {
    sample(ms: number): number {
      samples.push(ms);
      if (samples.length >= window) {
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        notch = qualityStep(avg, notch);
        samples.length = 0;
      }
      return notch;
    },
    notch: () => notch,
  };
}
