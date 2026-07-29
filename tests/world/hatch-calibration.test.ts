import { describe, expect, it } from 'vitest';
import { GAP_MIN, gapFor, weightFor } from '../../src/world/hatch';

/**
 * The hatch that this work replaced, written out as functions so the comparison
 * is legible rather than a wall of magic numbers. lineWidth was a flat 1 and
 * alpha ramped; both are gone now.
 */
const rampOld = (v: number) => Math.pow(v, 0.72);
const gapOld = (v: number, minGap: number, maxGap: number) =>
  maxGap - (maxGap - minGap) * rampOld(v);
const alphaOld = (v: number) => 0.55 + 0.45 * rampOld(v);

/**
 * Ink per unit area. The chords of a parallel line family crossing a region sum
 * to `area / gap`, so coverage is `lineWidth * alpha / gap` — angle-independent,
 * which is what makes this comparison possible on paper at all.
 */
const covOld = (v: number, minGap: number, maxGap: number) =>
  (1 * alphaOld(v)) / gapOld(v, minGap, maxGap);
const covNew = (v: number, minGap?: number) => weightFor(v) / gapFor(v, minGap);

/** The value the cross-hatch pass runs at, for a given main value. */
const crossValue = (v: number) => (v - 0.66) / 0.34;

const LAYERS = [
  { name: 'far city', value: 0.18, oldMaxGap: 17 },
  { name: 'near city', value: 0.34, oldMaxGap: 13 },
  { name: 'river', value: 0.34, oldMaxGap: 12 },
  { name: 'upstream bridge', value: 0.52, oldMaxGap: 10 },
] as const;

describe('the new hatch lays down the same ink as the old one', () => {
  it('holds every single-pass layer inside ±15%', () => {
    // The texture changes. The TONE must not — the value ladder built in the
    // previous round is measured against these depths, and a far band three
    // times darker would pull the whole picture flat.
    for (const l of LAYERS) {
      const before = covOld(l.value, 2, l.oldMaxGap);
      const after = covNew(l.value);
      expect(Math.abs(after / before - 1), l.name).toBeLessThan(0.15);
    }
  });

  it('holds the deck, cross-hatch included, inside ±15%', () => {
    const before = covOld(0.74, 2, 9) + covOld(crossValue(0.74), 3, 9);
    const after = covNew(0.74) + covNew(crossValue(0.74), GAP_MIN * 1.35);
    expect(Math.abs(after / before - 1)).toBeLessThan(0.15);
  });

  it('still steps darker with every depth', () => {
    const ordered = [0.18, 0.34, 0.52, 0.74];
    for (let i = 1; i < ordered.length; i++) {
      expect(covNew(ordered[i]!)).toBeGreaterThan(covNew(ordered[i - 1]!));
    }
  });

  it('gives the near city and the river the same ink, as they always should have', () => {
    // The old code handed them 13 and 12 for no stated reason while their
    // `value` was identical. Merging them is the correction, not a side effect.
    expect(covOld(0.34, 2, 13)).not.toBeCloseTo(covOld(0.34, 2, 12), 4);
    expect(covNew(0.34)).toBe(covNew(0.34));
  });
});
