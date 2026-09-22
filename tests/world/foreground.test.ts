import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { horizon } from '../../src/world/horizon';
import { GATE_X, STANDARD_X, lanternAnchor, railStandards } from '../../src/world/foreground';
import { lampSpots } from '../../src/world/bloom';
import { effectsFor } from '../../src/world/weather';

const hz = horizon(900, 900 * 0.66);

describe('placement', () => {
  it('hugs both edges without leaving the frame', () => {
    expect(GATE_X.left).toBeGreaterThan(0);
    expect(GATE_X.left).toBeLessThan(0.06);
    expect(GATE_X.right).toBeGreaterThan(0.94);
    expect(GATE_X.right).toBeLessThan(1);
  });

  it('stands the gas standard inside the left gate pier, not on top of it', () => {
    expect(STANDARD_X).toBeGreaterThan(GATE_X.left);
    expect(STANDARD_X).toBeLessThan(0.2);
  });

  it('hangs the lantern above the deck and below the bridge', () => {
    const a = lanternAnchor(1440, hz);
    expect(a.y).toBeLessThan(hz.deckTop);
    expect(a.y).toBeGreaterThan(hz.bridgeTop);
  });

  it('reaches the bracket arm inward, so the flame clears the shaft', () => {
    const a = lanternAnchor(1440, hz);
    expect(a.x).toBeGreaterThan(STANDARD_X * 1440);
  });

  it('is deterministic', () => {
    expect(lanternAnchor(1440, hz)).toEqual(lanternAnchor(1440, hz));
  });
});

describe('the vignette never touches the ambient palette', () => {
  const src = readFileSync('src/world/foreground.ts', 'utf8');

  it('takes its ink as an argument and derives nothing', () => {
    expect(src).not.toContain('AmbientValues');
    expect(src).not.toContain('v.sky');
    expect(src).not.toContain('v.deep');
  });

  it('reads every vertical bound off the Horizon, inventing no fractions', () => {
    // tests/smoke.test.ts already forbids `h * 0.x` outside horizon.ts; this
    // states the intent so a reader knows the omission is deliberate.
    for (const line of src.split('\n')) {
      expect(/\bh\s*\*\s*0\.\d/.test(line), line.trim()).toBe(false);
    }
  });
});

describe('the vignette is drawn last, not baked into the plate', () => {
  const renderer = readFileSync('src/world/renderer.ts', 'utf8');
  const layers = readFileSync('src/world/layers.ts', 'utf8');

  it('lives in the live pass, where nothing can paint over it', () => {
    // It went on the static plate first, and the river — drawn live on top of
    // that plate — washed the gate piers straight back out.
    expect(renderer).toContain('drawForeground');
    expect(layers).not.toContain('drawForeground(');
  });

  it('is the very last thing the frame draws', () => {
    const body = renderer.slice(renderer.indexOf('function frame'));
    for (const earlier of ['water.draw', 'drawWeather', 'drawFog', 'drawLamps']) {
      expect(body.indexOf(earlier), earlier).toBeLessThan(body.indexOf('drawForeground'));
    }
  });
});

describe('the standards along the near rail', () => {

  /**
   * The fault this exists to rule out: `bloom.ts` lit five lamps here that
   * nothing drew, so five flames hung in the air over the balustrade. It is the
   * lantern-over-its-own-flame fault in the other direction — there, ironwork
   * with no light; here, light with no ironwork.
   */
  it('gives bloom the same positions the posts are drawn at', () => {
    const spots = lampSpots(1200, hz, [], 0.5, effectsFor('clear'), { x: 0, y: 0 })
      .filter((s) => s.kind === 'arc' || s.kind === 'street');
    const posts = railStandards(1200, hz);
    expect(spots).toHaveLength(posts.length);
    for (const p of posts) {
      expect(spots.some((s) => s.x === p.x && s.y === p.y)).toBe(true);
    }
  });

  it('calls the electric ones electric', () => {
    const posts = railStandards(1200, hz);
    const spots = lampSpots(1200, hz, [], 0.5, effectsFor('clear'), { x: 0, y: 0 });
    for (const p of posts) {
      const s = spots.find((q) => q.x === p.x && q.y === p.y)!;
      expect(s.kind).toBe(p.arc ? 'arc' : 'street');
    }
  });

  /** An arc lamp stood taller than the gas it replaced. */
  it('stands the arc lamps higher than the gas', () => {
    const posts = railStandards(1200, hz);
    const arcs = posts.filter((p) => p.arc);
    const gas = posts.filter((p) => !p.arc);
    expect(arcs.length).toBeGreaterThan(0);
    expect(Math.max(...arcs.map((p) => p.y))).toBeLessThan(Math.min(...gas.map((p) => p.y)));
  });

  /**
   * At `0.18 + k * 0.19` the last one landed at 0.94, two per cent from the
   * right gate pier, and the two read as one object.
   */
  it('keeps clear of both gate piers and of the near standard', () => {
    const w = 1200;
    const others = [GATE_X.left * w, GATE_X.right * w, STANDARD_X * w];
    for (const p of railStandards(w, hz)) {
      for (const o of others) expect(Math.abs(p.x - o)).toBeGreaterThan(w * 0.04);
    }
  });

  it('stands them all above the parapet', () => {
    for (const p of railStandards(1200, hz)) expect(p.y).toBeLessThan(hz.railTop);
  });
});
