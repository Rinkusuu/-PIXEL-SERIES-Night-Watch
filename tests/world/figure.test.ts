import { describe, expect, it } from 'vitest';
import {
  FIGURE_H, WALK_CROSS_MS, WALK_PERIOD_MS, WATCHER_X,
  drawWalker, drawWatcher, walkerAt,
} from '../../src/world/figure';
import { horizon } from '../../src/world/horizon';
import { STANDARD_X } from '../../src/world/foreground';
import { resolve } from '../../src/ambient/interpolate';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';
import { countingCtx } from '../helpers/counting-ctx';

const hz = horizon(900, 594);
const v = resolve(NIGHT_KEYS, 0.35, gradesFor(['calm']));

describe('walkerAt', () => {
  it('leaves the bridge empty most of the time', () => {
    // A figure who is always there stops being an event. He crosses for three
    // minutes in every seven, so four nights out of seven you look up to an
    // empty bridge.
    let present = 0;
    const step = WALK_PERIOD_MS / 400;
    for (let t = 0; t < WALK_PERIOD_MS; t += step) if (walkerAt(t) !== null) present++;
    expect(present / 400).toBeLessThan(0.5);
  });

  it('enters off one edge and leaves off the other', () => {
    expect(walkerAt(0)!).toBeLessThan(0);
    expect(walkerAt(WALK_CROSS_MS - 1)!).toBeGreaterThan(1);
  });

  it('crosses in one direction only, never jumping back', () => {
    let prev = -Infinity;
    for (let t = 0; t < WALK_CROSS_MS; t += WALK_CROSS_MS / 200) {
      const at = walkerAt(t)!;
      expect(at).toBeGreaterThan(prev);
      prev = at;
    }
  });

  it('is a pure function of the clock, with no state to drift', () => {
    expect(walkerAt(12_345)).toBe(walkerAt(12_345));
    expect(walkerAt(WALK_PERIOD_MS + 500)).toBeCloseTo(walkerAt(500)!, 10);
  });

  it('handles a clock before the epoch without teleporting', () => {
    for (const t of [-1, -WALK_PERIOD_MS - 7, -500_000]) {
      const at = walkerAt(t);
      if (at !== null) expect(at).toBeGreaterThanOrEqual(-0.06);
    }
  });
});

describe('the watcher', () => {
  it('stands clear of the gas standard, not on top of it', () => {
    // Two silhouettes in the same column would read as one broken shape.
    expect(Math.abs(WATCHER_X - STANDARD_X) * 1440).toBeGreaterThan(FIGURE_H * 4);
  });

  it('stands on the upstream bridge, above the water', () => {
    expect(hz.bridgeTop).toBeLessThan(hz.waterTop);
    expect(hz.bridgeTop - FIGURE_H).toBeGreaterThan(hz.cityTop);
  });

  it('draws something', () => {
    const c = countingCtx();
    drawWatcher(c.g, 1440, hz, v, '#0a0e10');
    expect(c.calls()).toBeGreaterThan(0);
  });
});

describe('the walker', () => {
  it('draws nothing at all when nobody is crossing', () => {
    const c = countingCtx();
    drawWalker(c.g, 1440, hz, v, '#0a0e10', WALK_CROSS_MS + 1000, 1);
    expect(c.calls()).toBe(0);
  });

  it('draws a figure and a light while he is on the bridge', () => {
    const c = countingCtx();
    drawWalker(c.g, 1440, hz, v, '#0a0e10', WALK_CROSS_MS / 2, 1);
    expect(c.calls()).toBeGreaterThan(0);
  });

  it('freezes completely with motion off', () => {
    // A figure who teleports across a still scene is worse than no figure. The
    // POSITION still comes from the clock — he is not a session animation — but
    // his gait must not tick.
    const record = () => {
      const legs: number[] = [];
      const g = new Proxy({} as CanvasRenderingContext2D, {
        get(_t, key) {
          if (key === 'createRadialGradient') return () => ({ addColorStop: () => {} });
          if (key === 'fillRect') return (x: number) => { legs.push(x); };
          return () => {};
        },
        set: () => true,
      });
      return { g, legs };
    };
    const a = record();
    const b = record();
    drawWalker(a.g, 1440, hz, v, '#0a0e10', WALK_CROSS_MS / 2, 0);
    drawWalker(b.g, 1440, hz, v, '#0a0e10', WALK_CROSS_MS / 2 + 500, 0);
    // Same phase of the crossing is barely moved; the gait must be identical.
    expect(a.legs.length).toBe(b.legs.length);
  });
});
