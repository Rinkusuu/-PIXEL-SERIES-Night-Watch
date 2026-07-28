import { describe, expect, it } from 'vitest';
import { HATCH_ANGLES, gapFor, hatch } from '../../src/world/hatch';

/** Minimal recorder standing in for a 2D context. */
function stubCtx() {
  const calls: string[] = [];
  const angles: number[] = [];
  let lines = 0;
  const ctx = {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    rect: () => calls.push('rect'),
    clip: () => calls.push('clip'),
    translate: () => calls.push('translate'),
    rotate: (a: number) => { calls.push('rotate'); angles.push(a); },
    moveTo: () => { lines++; },
    lineTo: () => {},
    stroke: () => calls.push('stroke'),
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 0,
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    get calls() { return calls; },
    get angles() { return angles; },
    get lines() { return lines; },
    strokes: () => calls.filter((c) => c === 'stroke').length,
  };
}

describe('gapFor', () => {
  it('is widest at zero and tightest at one', () => {
    expect(gapFor(0, 2, 11)).toBeCloseTo(11, 5);
    expect(gapFor(1, 2, 11)).toBeCloseTo(2, 5);
  });

  it('decreases monotonically as value rises', () => {
    let prev = Infinity;
    for (let v = 0; v <= 1.0001; v += 0.05) {
      const g = gapFor(v, 2, 11);
      expect(g).toBeLessThanOrEqual(prev + 1e-9);
      prev = g;
    }
  });

  it('is not linear — the eye reads line density logarithmically', () => {
    const mid = gapFor(0.5, 2, 11);
    const linear = 11 - (11 - 2) * 0.5;
    expect(mid).toBeLessThan(linear);
  });

  it('clamps values outside 0..1', () => {
    expect(gapFor(-5, 2, 11)).toBeCloseTo(11, 5);
    expect(gapFor(9, 2, 11)).toBeCloseTo(2, 5);
  });
});

describe('hatch', () => {
  it('draws nothing on near-blank paper', () => {
    const s = stubCtx();
    hatch(s.ctx, 0, 0, 100, 100, 0.01);
    expect(s.calls).toHaveLength(0);
  });

  it('always balances save with restore', () => {
    const s = stubCtx();
    hatch(s.ctx, 0, 0, 100, 100, 0.4);
    expect(s.calls.filter((c) => c === 'save')).toHaveLength(
      s.calls.filter((c) => c === 'restore').length,
    );
  });

  it('draws more lines at a higher value', () => {
    const light = stubCtx();
    const heavy = stubCtx();
    hatch(light.ctx, 0, 0, 200, 200, 0.2);
    hatch(heavy.ctx, 0, 0, 200, 200, 0.6);
    expect(heavy.lines).toBeGreaterThan(light.lines);
  });

  it('does not cross-hatch below the dark third', () => {
    const s = stubCtx();
    hatch(s.ctx, 0, 0, 200, 200, 0.6);
    expect(s.strokes()).toBe(1);
  });

  it('cross-hatches above 0.66 at a different angle', () => {
    const s = stubCtx();
    hatch(s.ctx, 0, 0, 200, 200, 0.85, { angle: HATCH_ANGLES.near });
    expect(s.strokes()).toBe(2);
    expect(s.angles).toHaveLength(2);
    expect(Math.abs(s.angles[1]! - s.angles[0]!)).toBeGreaterThan(0.5);
  });

  it('exposes one angle per depth layer, all distinct', () => {
    const values = Object.values(HATCH_ANGLES);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('HATCH_ANGLES', () => {
  it('locks one angle per depth, water included', () => {
    expect(Object.keys(HATCH_ANGLES).sort()).toEqual(['far', 'mid', 'near', 'water']);
  });

  it('draws water dead flat', () => {
    // Flat horizontal lines are the nineteenth-century engraver's convention for
    // water. Any other angle and the river reads as a wall.
    expect(HATCH_ANGLES.water).toBe(0);
  });

  it('gives every depth a distinct angle', () => {
    const values = Object.values(HATCH_ANGLES);
    expect(new Set(values).size).toBe(values.length);
  });
});
