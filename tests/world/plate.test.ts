// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createWorldRenderer } from '../../src/world/renderer';
import { resolve } from '../../src/ambient/interpolate';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';
import { countingCtx } from '../helpers/counting-ctx';
import { drawStatic } from '../../src/world/layers';
import { horizon } from '../../src/world/horizon';
import { skyline } from '../../src/world/city';

/** Measured from the finished plate, then raised by about 15%. */
const BUDGET = 20300;

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

/* The same stub stands in for both the scene and the emissive buffer. Nothing
   here is about what was drawn — only about how often the plate is rebuilt —
   and a second stub would be a second thing to keep in step for no gain. */
describe('plate caching', () => {
  const v = resolve(NIGHT_KEYS, 0.4, gradesFor(['calm']));
  const base = {
    w: 800, h: 600, deckTop: 396, v, progress: 0.4,
    timeMs: 0, motion: 1, weather: 'clear' as const, pointer: null, season: 'autumn' as const,
  };

  it('builds the plate once while nothing visible changes', () => {
    const r = createWorldRenderer();
    const g = stubCtx();
    for (let i = 0; i < 60; i++) r.frame(g, g, { ...base, timeMs: i * 16 });
    expect(r.plateBuilds()).toBe(1);
  });

  it('rebuilds when the deck moves more than the threshold', () => {
    const r = createWorldRenderer();
    const g = stubCtx();
    r.frame(g, g, base);
    r.frame(g, g, { ...base, deckTop: 398 });
    expect(r.plateBuilds()).toBe(1);
    r.frame(g, g, { ...base, deckTop: 420 });
    expect(r.plateBuilds()).toBe(2);
  });

  it('rebuilds when the weather changes', () => {
    const r = createWorldRenderer();
    const g = stubCtx();
    r.frame(g, g, base);
    r.frame(g, g, { ...base, weather: 'rain' as const });
    expect(r.plateBuilds()).toBe(2);
  });
});

describe('the plate stays affordable', () => {
  it('builds the whole world inside its call budget', () => {
    // The plate is cached, so per-frame cost is nil — but it IS rebuilt on
    // resize, and that is what a hitch feels like. The bound below was measured
    // from the finished code and then raised by about 15%; a bound picked by
    // guess is a test that cannot fail.
    const hz = horizon(900, 594);
    const v = resolve(NIGHT_KEYS, 0.62, gradesFor(['calm']));
    const blocks = skyline(1440, hz.cityTop, hz.cityBot, 31);
    const { g, calls } = countingCtx();
    drawStatic(g, 1440, hz, v, 0.62, blocks, 'clear');
    expect(calls()).toBeLessThan(BUDGET);
  });
});
