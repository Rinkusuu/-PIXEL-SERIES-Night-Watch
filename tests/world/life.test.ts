import { describe, expect, it } from 'vitest';
import { createLife, mothBudget } from '../../src/world/life';
import { horizon } from '../../src/world/horizon';
import type { LampSpot } from '../../src/world/water';
import { resolve } from '../../src/ambient/interpolate';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';

const hz = horizon(800, 560);
const v = resolve(NIGHT_KEYS, 0.4, gradesFor(['calm']));

const lamps = (n: number, lit = true): LampSpot[] =>
  Array.from({ length: n }, (_, i) => ({
    x: 100 + i * 60, y: 200, r: 3, lit, kind: 'street' as const,
  }));

/** Records every call, so we can tell the two surfaces apart. */
function spy() {
  const calls: { fn: string; op?: string }[] = [];
  let op = 'source-over';
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get: (_t, key) => (..._a: unknown[]) => { calls.push({ fn: String(key), op }); },
    set: (_t, key, value) => {
      if (key === 'globalCompositeOperation') op = String(value);
      return true;
    },
  });
  return { ctx, calls };
}

const run = (life: ReturnType<typeof createLife>, seconds: number, ls: LampSpot[], season: Parameters<typeof mothBudget>[0] = 'summer', wet = false) => {
  for (let t = 0; t < seconds * 60; t++) life.update(16, hz, 800, ls, season, wet, 1);
};

describe('mothBudget', () => {
  /**
   * Both halves of this are real rules, not decoration: moths are a summer
   * insect and they are drawn to gas. It is also the only thing in the app
   * that tells you what month it is without using words.
   */
  it('is empty in winter, whatever the lamps are doing', () => {
    expect(mothBudget('winter', 20, false)).toBe(0);
  });

  it('is fullest in summer', () => {
    expect(mothBudget('summer', 10, false)).toBeGreaterThan(mothBudget('autumn', 10, false));
    expect(mothBudget('summer', 10, false)).toBeGreaterThan(mothBudget('spring', 10, false));
  });

  it('follows how many lamps are actually burning', () => {
    expect(mothBudget('summer', 8, false)).toBeGreaterThan(mothBudget('summer', 2, false));
  });

  /** Rain grounds them — but there is always one idiot moth. */
  it('thins in the wet without emptying', () => {
    const dry = mothBudget('summer', 12, false);
    const wet = mothBudget('summer', 12, true);
    expect(wet).toBeLessThan(dry);
    expect(wet).toBeGreaterThan(0);
  });

  it('never runs away with itself, however many lamps there are', () => {
    expect(mothBudget('summer', 10_000, false)).toBeLessThanOrEqual(30);
  });
});

describe('the pool', () => {
  /**
   * The whole argument for doing it this way. A particle system that allocates
   * stutters every few seconds when the collector runs, and that stutter is
   * the fastest way to make a careful canvas scene feel cheap.
   */
  it('never grows, however long it runs', () => {
    const life = createLife();
    const ls = lamps(14);
    run(life, 120, ls);
    expect(life.debug().pool).toBe(96);
    expect(life.debug().moths).toBeLessThanOrEqual(30);
  });

  it('fills toward the budget and stops', () => {
    const life = createLife();
    run(life, 60, lamps(14));
    const settled = life.debug().moths;
    run(life, 60, lamps(14));
    expect(life.debug().moths).toBeLessThanOrEqual(30);
    expect(settled).toBeGreaterThan(0);
  });

  it('puts nobody out on a winter night', () => {
    const life = createLife();
    run(life, 60, lamps(14), 'winter');
    expect(life.debug().moths).toBe(0);
  });

  /** A moth is at a lamp because the lamp is lit. Unlit, it has no reason. */
  it('empties when the lamps go out', () => {
    const life = createLife();
    run(life, 40, lamps(14));
    expect(life.debug().moths).toBeGreaterThan(0);
    run(life, 40, lamps(14, false));
    expect(life.debug().moths).toBe(0);
  });

  /** Motion zero holds the picture still; it does not clear the embankment. */
  it('freezes rather than emptying when motion is off', () => {
    const life = createLife();
    run(life, 40, lamps(14));
    const before = life.debug().moths;
    for (let t = 0; t < 600; t++) life.update(16, hz, 800, lamps(14), 'summer', false, 0);
    expect(life.debug().moths).toBe(before);
  });
});

describe('drawing', () => {
  /**
   * The rule two surfaces exist for. The emissive buffer is screened OVER the
   * scene and `screen` lightens, so a dark speck under a bright halo comes out
   * bright — the moth would be washed away by the light it is crossing. It is
   * erased out of the glow instead, which is not a trick around the blend mode
   * but what a moth actually does to a lamp it is in front of.
   */
  it('puts the body on the scene and a hole in the light', () => {
    const life = createLife();
    run(life, 40, lamps(14));
    const scene = spy();
    const glow = spy();
    life.draw(scene.ctx, glow.ctx, v, '#000');

    expect(scene.calls.some((c) => c.fn === 'fillRect')).toBe(true);
    const holes = glow.calls.filter((c) => c.fn === 'fillRect');
    expect(holes.length).toBeGreaterThan(0);
    for (const hole of holes) expect(hole.op).toBe('destination-out');
  });

  it('leaves both surfaces as it found them', () => {
    const life = createLife();
    run(life, 20, lamps(14));
    const scene = spy();
    const glow = spy();
    life.draw(scene.ctx, glow.ctx, v, '#000');
    expect(scene.calls.filter((c) => c.fn === 'save').length).toBe(1);
    expect(scene.calls.filter((c) => c.fn === 'restore').length).toBe(1);
    expect(glow.calls.filter((c) => c.fn === 'restore').length).toBe(1);
  });
});
