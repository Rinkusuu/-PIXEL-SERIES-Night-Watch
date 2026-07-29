import { describe, expect, it } from 'vitest';
import {
  GAP_MAX, GAP_MIN, HATCH_ANGLES, gapFor, hatch, inkRatio, reachFor, spreadFor,
  weightFor,
} from '../../src/world/hatch';

/** Minimal recorder standing in for a 2D context. */
function stubCtx() {
  const calls: string[] = [];
  const angles: number[] = [];
  let lines = 0;
  // Captured from the FIRST pass only: the cross-hatch pass would otherwise
  // overwrite the numbers we came to measure.
  let width = 0;
  let alpha = 0;
  let stroked = false;
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
    stroke: () => { calls.push('stroke'); stroked = true; },
    strokeStyle: '',
    set lineWidth(v: number) { if (!stroked) width = v; },
    get lineWidth() { return width; },
    set globalAlpha(v: number) { if (!stroked) alpha = v; },
    get globalAlpha() { return alpha; },
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    get calls() { return calls; },
    get angles() { return angles; },
    get lines() { return lines; },
    get width() { return width; },
    get alpha() { return alpha; },
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
    // Angles here are measured FROM VERTICAL: hatch() lays its lines out
    // vertically and then rotates them. 0 rad is a wall of verticals, which is
    // exactly what the river must never be. A quarter turn is flat.
    expect(HATCH_ANGLES.water).toBeCloseTo(Math.PI / 2, 10);
  });

  it('gives every depth a distinct angle', () => {
    const values = Object.values(HATCH_ANGLES);
    expect(new Set(values).size).toBe(values.length);
  });
});

const USED_ANGLES = [
  HATCH_ANGLES.far, HATCH_ANGLES.mid, HATCH_ANGLES.near, HATCH_ANGLES.water,
  // Cross-hatch adds 1.13 rad to whatever angle it was given.
  HATCH_ANGLES.far + 1.13, HATCH_ANGLES.mid + 1.13,
  HATCH_ANGLES.near + 1.13, HATCH_ANGLES.water + 1.13,
];

const BOXES: readonly (readonly [number, number])[] = [
  [1440, 250],  // the river: very wide, very shallow
  [250, 1440],  // a tower slot: very tall
  [300, 300],
  [60, 400],
];

describe('hatch geometry', () => {
  it('reaches every corner of the rect at every angle we draw', () => {
    // `o` steps along the OFFSET axis and each segment runs along the LINE
    // axis. Both have to clear the rect's corners or the hatching stops short.
    for (const [w, h] of BOXES) {
      for (const a of USED_ANGLES) {
        const spread = spreadFor(w, h, a);
        const reach = reachFor(w, h, a);
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            const cx = (sx * w) / 2;
            const cy = (sy * h) / 2;
            const along = cx * Math.cos(a) + cy * Math.sin(a);
            const across = -cx * Math.sin(a) + cy * Math.cos(a);
            expect(Math.abs(along), `spread ${w}x${h} @${a}`)
              .toBeLessThanOrEqual(spread + 1e-9);
            expect(Math.abs(across), `reach ${w}x${h} @${a}`)
              .toBeLessThanOrEqual(reach + 1e-9);
          }
        }
      }
    }
  });

  it('would have fallen short across the river with the old single formula', () => {
    // The old code computed one `diag` and used it for both jobs. That number is
    // spreadFor's, and for flat water lines it measures the river's DEPTH where
    // the segment needs the river's WIDTH.
    const a = HATCH_ANGLES.water;
    expect(spreadFor(1440, 250, a) * 2).toBeLessThan(reachFor(1440, 250, a));
  });
});

describe('the gap never widens into a motif', () => {
  it('keeps every gap under the countable threshold', () => {
    for (let v = 0; v <= 1.0001; v += 0.01) {
      expect(gapFor(v)).toBeLessThanOrEqual(GAP_MAX + 1e-9);
    }
  });

  it('pins the threshold itself', () => {
    // Without this, the test above passes forever by raising GAP_MAX.
    expect(GAP_MAX).toBeLessThanOrEqual(3.7);
    expect(GAP_MIN).toBeGreaterThan(1);
  });
});

describe('weightFor', () => {
  it('rises monotonically with value', () => {
    let prev = -Infinity;
    for (let v = 0.02; v <= 1.0001; v += 0.02) {
      const wv = weightFor(v);
      expect(wv).toBeGreaterThanOrEqual(prev);
      prev = wv;
    }
  });

  it('never returns a width at or below zero', () => {
    for (let v = 0; v <= 1.0001; v += 0.01) {
      expect(weightFor(v)).toBeGreaterThan(0);
    }
  });
});

describe('inkRatio', () => {
  it('orders the four depths the picture actually uses', () => {
    // 0.18 far city, 0.34 near city and river, 0.52 bridge, 0.74 deck.
    const used = [0.18, 0.34, 0.52, 0.74];
    for (let i = 1; i < used.length; i++) {
      expect(inkRatio(used[i]!)).toBeGreaterThan(inkRatio(used[i - 1]!));
    }
  });
});

describe('sub-pixel ink is paid for with alpha', () => {
  it('never sets a stroke thinner than canvas can draw', () => {
    const s = stubCtx();
    hatch(s.ctx, 0, 0, 300, 300, 0.18);
    expect(s.width).toBeGreaterThanOrEqual(0.5);
  });

  it('lands the same total ink either side of that floor', () => {
    // lineWidth x alpha must come back to weightFor, whichever side of
    // MIN_STROKE the wanted width falls on.
    for (const v of [0.18, 0.34, 0.52, 0.74]) {
      const s = stubCtx();
      hatch(s.ctx, 0, 0, 300, 300, v);
      expect(s.width * s.alpha, `value ${v}`).toBeCloseTo(weightFor(v), 6);
    }
  });
});
