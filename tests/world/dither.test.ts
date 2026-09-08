// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BAYER4, STEPS, quant } from '../../src/world/dither';

describe('BAYER4', () => {
  it('is a permutation of 0..15 — every cell a different threshold', () => {
    // A matrix with a repeated value has two pixels in the 4x4 cell that flip
    // together, which is the start of the checkerboard the DNA warns about.
    const flat = BAYER4.flat().slice().sort((a, b) => a - b);
    expect(flat).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it('scatters neighbouring thresholds far apart', () => {
    // This is what separates Bayer from a periodic lattice. Neighbours holding
    // nearly the same threshold flip together, and over a smooth field that
    // hardens into the 1px checkerboard the DNA warns about. Measured as a
    // mean rather than a floor per pair: the matrix wraps, and one wrapped
    // pair (7 under 8) is adjacent by exactly one — the average is what
    // actually decides whether the edge crumbles.
    let total = 0;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        total += Math.abs(BAYER4[y]![x]! - BAYER4[y]![(x + 1) & 3]!);
        total += Math.abs(BAYER4[y]![x]! - BAYER4[(y + 1) & 3]![x]!);
      }
    }
    // A left-to-right lattice would average 1; this averages well above 5.
    expect(total / 32).toBeGreaterThan(5);
  });
});

describe('quant', () => {
  it('snaps to a ladder of `steps` levels', () => {
    const seen = new Set<number>();
    for (let v = 0; v <= 255; v++) seen.add(quant(v, 0.5, 8));
    // Quantising to 8 steps must not give back 256 distinct values.
    expect(seen.size).toBeLessThanOrEqual(9);
  });

  it('stays inside the byte range at both ends', () => {
    for (const th of [0, 0.5, 1]) {
      expect(quant(0, th)).toBeGreaterThanOrEqual(0);
      expect(quant(255, th)).toBeLessThanOrEqual(255);
    }
  });

  it('pushes a value up or down depending on its threshold', () => {
    // The whole mechanism: one input value lands on different levels in
    // different cells of the matrix, and that spread IS the dither.
    const low = quant(128, 0, STEPS);
    const high = quant(128, 1, STEPS);
    expect(high).toBeGreaterThan(low);
  });

  it('is monotonic in the input', () => {
    let prev = -1;
    for (let v = 0; v <= 255; v += 5) {
      const q = quant(v, 0.5, STEPS);
      expect(q).toBeGreaterThanOrEqual(prev);
      prev = q;
    }
  });
});
