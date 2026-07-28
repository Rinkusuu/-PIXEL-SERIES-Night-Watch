// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createWorldRenderer } from '../../src/world/renderer';
import { resolve } from '../../src/ambient/interpolate';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';

/**
 * jsdom has no 2-D context, so `getContext('2d')` returns null on the offscreen
 * plate — the renderer's `if (g)` guard skips the drawing and we still get to
 * assert on WHEN it decided to rebuild, which is the thing under test.
 */
function stubCtx(): CanvasRenderingContext2D {
  const noop = () => {};
  const grad = { addColorStop: noop };
  return new Proxy({} as CanvasRenderingContext2D, {
    get(_t, key) {
      if (key === 'canvas') return { width: 800, height: 600 };
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => grad;
      if (key === 'measureText') return () => ({ width: 0 });
      return typeof key === 'string' ? noop : undefined;
    },
    set: () => true,
  });
}

describe('plate caching', () => {
  const v = resolve(NIGHT_KEYS, 0.4, gradesFor(['calm']));
  const base = {
    w: 800, h: 600, deckTop: 396, v, progress: 0.4,
    timeMs: 0, motion: 1, weather: 'clear' as const,
  };

  it('builds the plate once while nothing visible changes', () => {
    const r = createWorldRenderer();
    const g = stubCtx();
    for (let i = 0; i < 60; i++) r.frame(g, { ...base, timeMs: i * 16 });
    expect(r.plateBuilds()).toBe(1);
  });

  it('rebuilds when the deck moves more than the threshold', () => {
    const r = createWorldRenderer();
    const g = stubCtx();
    r.frame(g, base);
    r.frame(g, { ...base, deckTop: 398 });
    expect(r.plateBuilds()).toBe(1);
    r.frame(g, { ...base, deckTop: 420 });
    expect(r.plateBuilds()).toBe(2);
  });

  it('rebuilds when the weather changes', () => {
    const r = createWorldRenderer();
    const g = stubCtx();
    r.frame(g, base);
    r.frame(g, { ...base, weather: 'rain' as const });
    expect(r.plateBuilds()).toBe(2);
  });
});
