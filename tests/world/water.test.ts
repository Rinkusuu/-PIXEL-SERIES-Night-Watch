import { describe, expect, it } from 'vitest';
import { horizon } from '../../src/world/horizon';
import {
  RING_LIMIT, advanceRing, createWater, mirrorRow, reflectAlpha, rowWobble,
  stoneSkip,
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

/**
 * Records every drawing call so two frames can be compared exactly. Screenshots
 * caught this bug and the unit tests did not: the ripples, the glitter dashes
 * and the waterline foam all read `timeMs` directly, so they kept twinkling
 * after motion was switched off.
 */
function recordingCtx(): { g: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = [];
  const grad = { addColorStop: (...a: unknown[]) => log.push(`stop(${a.join(',')})`) };
  const g = new Proxy({} as CanvasRenderingContext2D, {
    get(_t, key) {
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return (...a: unknown[]) => { log.push(`grad(${a.join(',')})`); return grad; };
      }
      return (...a: unknown[]) => log.push(`${String(key)}(${a.map(String).join(',')})`);
    },
    set(_t, key, value) { log.push(`${String(key)}=${String(value)}`); return true; },
  });
  return { g, log };
}

describe('motion: 0 freezes the river without emptying it', () => {
  const hz = {
    h: 900, cityTop: 144, cityTopMid: 179, cityTopFar: 217,
    skyBot: 198, cityBot: 360, bridgeTop: 310, bridgeBot: 387,
    waterTop: 360, waterBot: 540, railTop: 540, railBot: 594, deckTop: 594,
  };
  const v = {
    deep: '#0e1218', mid: '#243039', lift: '#4a6070', glow: '#ffb347',
    accent: '#6f8f9c', ink: '#ece4d8', inkSoft: '#9aa5a8', lum: 0.22,
    sky: ['#0e1218', '#243039', '#4a6070'] as const,
  };
  const lamps = [
    { x: 300, y: 300, r: 3, lit: true, kind: 'bridge' as const },
    { x: 900, y: 190, r: 16, lit: true, kind: 'moon' as const },
  ];

  const frameAt = (timeMs: number, motion: number) => {
    const { g, log } = recordingCtx();
    createWater().draw(g, 1440, hz, v, null, lamps, timeMs, motion, 0);
    return log.join('\n');
  };

  it('draws the identical frame at any two moments', () => {
    expect(frameAt(0, 0)).toBe(frameAt(5_000, 0));
    expect(frameAt(5_000, 0)).toBe(frameAt(9_999_999, 0));
  });

  it('still draws a river — frozen is not blank', () => {
    expect(frameAt(0, 0).length).toBeGreaterThan(2000);
  });

  it('but does move when motion is on', () => {
    expect(frameAt(0, 1)).not.toBe(frameAt(5_000, 1));
  });
});

describe('stoneSkip', () => {
  const hz = horizon(900, Math.round(900 * 0.6));

  it('refuses a throw that never reached the water', () => {
    // Sky and stone. A stone thrown at a building did not skip, and saying so
    // is better than quietly rippling somewhere the pointer never was.
    expect(stoneSkip(700, hz.waterTop - 40, hz, 0)).toEqual([]);
    expect(stoneSkip(700, hz.waterBot + 40, hz, 0)).toEqual([]);
  });

  it('bounces at least once anywhere on the river', () => {
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const y = hz.waterTop + (hz.waterBot - hz.waterTop) * f;
      expect(stoneSkip(700, y, hz, 0).length, `f=${f}`).toBeGreaterThan(0);
    }
  });

  it('gives a flatter throw more bounces than a steep one', () => {
    // Near water is closer to you; the far bank is a long throw at a bad angle.
    const near = stoneSkip(700, hz.waterBot - 2, hz, 0).length;
    const far = stoneSkip(700, hz.waterTop + 2, hz, 0).length;
    expect(near).toBeGreaterThan(far);
  });

  it('carries the stone upstream and away, never backwards', () => {
    const hits = stoneSkip(400, hz.waterBot - 4, hz, 0.9);
    expect(hits.length).toBeGreaterThan(2);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i]!.x, 'x must advance').toBeGreaterThan(hits[i - 1]!.x);
      expect(hits[i]!.y, 'y must rise toward the far bank').toBeLessThan(hits[i - 1]!.y);
    }
  });

  it('never leaves a ring above the waterline', () => {
    // The bank is not water. A ring drawn there is a ripple in a wall.
    for (const f of [0.1, 0.4, 0.9]) {
      const y = hz.waterTop + (hz.waterBot - hz.waterTop) * f;
      for (const p of stoneSkip(700, y, hz, 1)) {
        expect(p.y).toBeGreaterThanOrEqual(hz.waterTop);
      }
    }
  });

  it('fades each bounce weaker than the one before it', () => {
    const hits = stoneSkip(400, hz.waterBot - 4, hz, 0.9);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i]!.strength).toBeLessThan(hits[i - 1]!.strength);
    }
  });

  it('is deterministic when the roll is given', () => {
    expect(stoneSkip(700, hz.waterTop + 30, hz, 0.42))
      .toEqual(stoneSkip(700, hz.waterTop + 30, hz, 0.42));
  });
});
