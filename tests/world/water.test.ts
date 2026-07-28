import { describe, expect, it } from 'vitest';
import {
  RING_LIMIT, advanceRing, createWater, mirrorRow, reflectAlpha, rowWobble,
} from '../../src/world/water';

describe('mirrorRow', () => {
  it('walks UP the mirror as the river walks DOWN', () => {
    const a = mirrorRow(100, 100, 200);
    const b = mirrorRow(140, 100, 200);
    expect(b).toBeLessThan(a);
  });
  it('reports exhaustion instead of reading out of bounds', () => {
    expect(mirrorRow(9999, 100, 200)).toBe(-1);
  });
  it('starts at the bottom row of the mirror', () => {
    expect(mirrorRow(100, 100, 200)).toBe(199);
  });
});

describe('reflectAlpha', () => {
  it('is strongest at the waterline and fades toward your feet', () => {
    expect(reflectAlpha(0)).toBeGreaterThan(reflectAlpha(0.5));
    expect(reflectAlpha(0.5)).toBeGreaterThan(reflectAlpha(0.95));
  });
  it('never reaches full opacity — deep water is dark, not a mirror', () => {
    expect(reflectAlpha(0)).toBeLessThan(0.6);
  });
});

describe('rowWobble', () => {
  it('is dead still when motion is zero', () => {
    expect(rowWobble(40, 0.5, 0, 0)).toBe(0);
    expect(rowWobble(40, 0.5, 999_999, 0)).toBe(0);
  });
  it('moves with time when motion is one', () => {
    expect(rowWobble(40, 0.5, 0, 1)).not.toBeCloseTo(rowWobble(40, 0.5, 700, 1), 4);
  });
  it('displaces the water at all', () => {
    const far = Math.abs(rowWobble(40, 0.05, 1200, 1));
    const near = Math.abs(rowWobble(40, 0.95, 1200, 1));
    expect(near + far).toBeGreaterThan(0);
  });
});

describe('advanceRing', () => {
  it('expands fast then slows — a real ripple loses energy', () => {
    const a = advanceRing({ x: 0, y: 0, r: 1, life: 0, max: 0.9 }, 100);
    const b = advanceRing({ x: 0, y: 0, r: 1, life: 0.6, max: 0.9 }, 100);
    expect(a.r - 1).toBeGreaterThan(b.r - 1);
  });
  it('ages by the elapsed time', () => {
    expect(advanceRing({ x: 0, y: 0, r: 1, life: 0, max: 0.9 }, 500).life).toBeCloseTo(0.5, 6);
  });
});

describe('createWater', () => {
  it('shares ONE ring implementation with rain and the barge', () => {
    const w = createWater();
    w.ring(10, 20, 1);
    w.ring(30, 40, 0.5);
    expect(w.rings()).toHaveLength(2);
  });
  it('expires rings instead of growing forever', () => {
    const w = createWater();
    w.ring(10, 20, 1);
    for (let i = 0; i < 40; i++) w.update(100, 1);
    expect(w.rings()).toHaveLength(0);
  });
  it('caps the ring field so a downpour cannot unbound it', () => {
    const w = createWater();
    for (let i = 0; i < RING_LIMIT * 3; i++) w.ring(i, i, 1);
    expect(w.rings().length).toBeLessThanOrEqual(RING_LIMIT);
  });
  it('freezes rings when motion is zero', () => {
    const w = createWater();
    w.ring(10, 20, 1);
    const before = w.rings()[0]!.r;
    w.update(500, 0);
    expect(w.rings()[0]!.r).toBe(before);
  });
});
