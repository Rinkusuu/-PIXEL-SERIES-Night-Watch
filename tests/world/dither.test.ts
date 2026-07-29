import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BAYER4, BAYER_N, ditherLevel, ditherMask, inkRatio } from '../../src/world/dither';

/** What the calibrated hatch laid down at each call site, measured before it
 *  was replaced. The technique changed; the tone must not. */
const OLD_COVERAGE = [
  { name: 'far city', value: 0.18, coverage: 0.0539 },
  { name: 'near city', value: 0.34, coverage: 0.0953 },
  { name: 'river', value: 0.34, coverage: 0.1023 },
  { name: 'upstream bridge', value: 0.52, coverage: 0.1661 },
  { name: 'deck', value: 0.74, coverage: 0.3741 },
] as const;

describe('BAYER4', () => {
  it('is a complete 4x4 threshold matrix', () => {
    expect(BAYER4).toHaveLength(BAYER_N * BAYER_N);
    expect([...BAYER4].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => i),
    );
  });

  it('spreads its thresholds instead of clumping them', () => {
    // The whole virtue of an ordered matrix: no two neighbours are close in
    // value, so a large flat area never grows a visible blotch. Random
    // thresholds do exactly that, and it is why noise dither looks dirty.
    //
    // Measured WITHIN the tile. Across a tile boundary a 7 does land beside an
    // 8, and that is the matrix repeating rather than a clump in it.
    for (let y = 0; y < BAYER_N; y++) {
      for (let x = 0; x < BAYER_N; x++) {
        const here = BAYER4[y * BAYER_N + x]!;
        if (x + 1 < BAYER_N) {
          expect(Math.abs(here - BAYER4[y * BAYER_N + x + 1]!)).toBeGreaterThanOrEqual(3);
        }
        if (y + 1 < BAYER_N) {
          expect(Math.abs(here - BAYER4[(y + 1) * BAYER_N + x]!)).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});

describe('ditherLevel', () => {
  it('lays down the same ink the hatch did, within one level', () => {
    // One level out of sixteen is the finest this matrix can resolve, so that
    // is the tightest the tone can be held.
    for (const l of OLD_COVERAGE) {
      const want = l.coverage * BAYER_N * BAYER_N;
      expect(Math.abs(ditherLevel(l.value) - want), l.name).toBeLessThanOrEqual(1);
    }
  });

  it('never fills more than the tile has cells', () => {
    for (let v = 0; v <= 1.0001; v += 0.01) {
      expect(ditherLevel(v)).toBeLessThanOrEqual(BAYER_N * BAYER_N);
      expect(ditherLevel(v)).toBeGreaterThanOrEqual(0);
    }
  });

  it('rises with value and keeps the depths in order', () => {
    const ordered = [0.18, 0.34, 0.52, 0.74];
    for (let i = 1; i < ordered.length; i++) {
      expect(inkRatio(ordered[i]!)).toBeGreaterThan(inkRatio(ordered[i - 1]!));
    }
  });

  it('leaves the deck far short of solid', () => {
    // Reusing the gap curve put it at 13/16 — not a dark tone, a black
    // rectangle with holes in it.
    expect(ditherLevel(0.74)).toBeLessThan(8);
  });
});

describe('ditherMask', () => {
  it('inks exactly as many cells as the level says', () => {
    for (const v of [0, 0.18, 0.34, 0.52, 0.74, 1]) {
      expect(ditherMask(v).filter(Boolean)).toHaveLength(ditherLevel(v));
    }
  });

  it('leaves bare paper bare', () => {
    expect(ditherMask(0).some(Boolean)).toBe(false);
  });
});

describe('the world layer draws no line work at all', () => {
  // The addendum's §C swapped dither for hatching on the grounds that the world
  // was an engraved plate. That is reversed: the world renders into a small
  // buffer and blows up with nearest neighbour, and a two-pixel line does not
  // survive the trip.
  for (const f of ['city.ts', 'bridge.ts', 'deck.ts', 'water.ts', 'sky.ts', 'layers.ts']) {
    it(`${f} has no hatch left in it`, () => {
      const src = readFileSync(`src/world/${f}`, 'utf8');
      expect(src).not.toContain('hatch(');
      expect(src).not.toContain('HATCH_ANGLES');
    });
  }
});
