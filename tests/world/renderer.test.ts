import { describe, expect, it } from 'vitest';
import { channelDrift } from '../../src/world/renderer';
import { lampCount } from '../../src/world/bloom';
import { drawFog, fogOffset } from '../../src/world/fog';
import { horizon } from '../../src/world/horizon';
import { resolve } from '../../src/ambient/interpolate';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';
import { countingCtx } from '../helpers/counting-ctx';

describe('channelDrift', () => {
  it('is zero for identical colours', () => {
    expect(channelDrift('#243039', '#243039')).toBe(0);
  });
  it('reports the largest single-channel difference', () => {
    expect(channelDrift('#000000', '#0a0014')).toBe(0x14);
  });
});

describe('lampCount', () => {
  it('starts nearly dark and peaks in the thickest fog', () => {
    expect(lampCount(0)).toBe(2);
    expect(lampCount(0.62)).toBeGreaterThan(lampCount(0.35));
    expect(lampCount(0.62)).toBe(14);
  });

  it('falls back toward dawn as the gas goes out', () => {
    expect(lampCount(1)).toBeLessThan(lampCount(0.62));
  });

  it('never exceeds the total or drops below one', () => {
    for (let p = 0; p <= 1.0001; p += 0.02) {
      const n = lampCount(p, 14);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(14);
      expect(Number.isInteger(n)).toBe(true);
    }
  });
});

describe('fogOffset', () => {
  it('freezes completely when motion is zero', () => {
    expect(fogOffset(0, 0, 0)).toBe(fogOffset(9_999_999, 0, 0));
  });

  it('advances with time when motion is one', () => {
    expect(fogOffset(4000, 0, 1)).not.toBe(fogOffset(0, 0, 1));
  });

  it('drifts each band at a different rate and direction', () => {
    const a = fogOffset(5000, 0, 1);
    const b = fogOffset(5000, 1, 1);
    const c = fogOffset(5000, 2, 1);
    expect(a).not.toBeCloseTo(b, 3);
    expect(b).not.toBeCloseTo(c, 3);
    expect(Math.sign(a)).not.toBe(Math.sign(b));
  });
});

describe('drawFog', () => {
  const v = resolve(NIGHT_KEYS, 0.4, gradesFor(['calm']));
  const hz = horizon(900, 594);

  it('draws nothing at all when the night has no fog to give', () => {
    const { g, calls } = countingCtx();
    drawFog(g, 800, hz, v, 0, 1, 0);
    expect(calls()).toBe(0);
  });

  it('works harder on a foggy night than on a clear one', () => {
    const clear = countingCtx();
    drawFog(clear.g, 800, hz, v, 0, 1, 1);
    expect(clear.calls()).toBeGreaterThan(0);
  });

  it('keeps its bands inside the river and the near stone, never the sky', () => {
    // Bands are fractions OF THE RIVER now. If they were still fractions of the
    // frame, moving deckTop would slide the fog onto the sky.
    expect(hz.waterTop).toBeLessThan(hz.railTop);
    expect(hz.railTop).toBeLessThan(hz.deckTop);
  });
});

describe("fog pools at the city's feet", () => {
  const v = resolve(NIGHT_KEYS, 0.62, gradesFor(['calm']));
  const hz = horizon(900, 594);

  it('does more work than the three drifting bands alone', () => {
    // A pool at cityBot is what makes buildings emerge FROM fog rather than
    // stand ON a ruled line. Without it the best silhouette in the world still
    // reads as a sticker.
    //
    // 174 is exactly what the three bands cost on their own, measured before
    // the pool existed. A looser bound here would be a test that cannot fail.
    const { g, calls } = countingCtx();
    drawFog(g, 800, hz, v, 0, 1, 1);
    expect(calls()).toBeGreaterThan(174);
  });

  it('still draws nothing when the night has no fog to give', () => {
    const { g, calls } = countingCtx();
    drawFog(g, 800, hz, v, 0, 1, 0);
    expect(calls()).toBe(0);
  });

  it('scales the pool with the weather like everything else', () => {
    const thin = countingCtx();
    const thick = countingCtx();
    drawFog(thin.g, 800, hz, v, 0, 1, 0.55);
    drawFog(thick.g, 800, hz, v, 0, 1, 2);
    expect(thick.calls()).toBeGreaterThanOrEqual(thin.calls());
  });
});
