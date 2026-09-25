import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CLOUD_STEP, cityGlowAnchor, cloudBanks, cloudDrift, drawClouds, drawSky,
  drawStars, starField, starVisibility,
} from '../../src/world/sky';
import { horizon } from '../../src/world/horizon';
import { skyline } from '../../src/world/city';
import { effectsFor } from '../../src/world/weather';
import { resolve } from '../../src/ambient/interpolate';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';
import { countingCtx } from '../helpers/counting-ctx';
import type { Block } from '../../src/world/city';

const hz = horizon(900, 594);
const v = resolve(NIGHT_KEYS, 0.35, gradesFor(['calm']));
const blocks = skyline(1440, hz.cityTop, hz.cityBot, 31);
const moon = { x: 1440 * 0.78, y: hz.skyBot * 0.5 };

describe('starField', () => {
  const stars = starField(1440, hz, 7);

  it('keeps every star in the sky, never over the city or the river', () => {
    for (const s of stars) {
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(hz.skyBot);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1440);
    }
  });

  it('crowds them toward the top — haze takes the low ones first', () => {
    const high = stars.filter((s) => s.y < hz.skyBot * 0.5).length;
    expect(high).toBeGreaterThan(stars.length * 0.6);
  });

  it('is deterministic', () => {
    expect(starField(1440, hz, 7)).toEqual(starField(1440, hz, 7));
  });
});

describe('starVisibility', () => {
  it('leaves a foggy night with no stars at all', () => {
    expect(starVisibility(effectsFor('fog').fogScale)).toBe(0);
  });

  it('gives a wet night the most', () => {
    // weather.ts already says it: a wet London night is the CLEAREST one you
    // get, because the rain washes the fog out.
    const wet = starVisibility(effectsFor('rain').fogScale);
    const clear = starVisibility(effectsFor('clear').fogScale);
    expect(wet).toBeGreaterThan(clear);
  });

  it('never goes negative however thick the night gets', () => {
    for (const f of [0, 0.5, 1, 2, 5]) expect(starVisibility(f)).toBeGreaterThanOrEqual(0);
  });
});

describe('cloudBanks', () => {
  const banks = cloudBanks(1440, hz, 31);

  it('hangs every lobe in the sky, clear of the waterline', () => {
    for (const c of banks) {
      for (const l of c.lobes) {
        expect(l.y + l.ry).toBeLessThan(hz.waterTop);
        expect(l.ry).toBeGreaterThan(0);
        expect(l.rx).toBeGreaterThan(0);
      }
    }
  });

  it('tears the banks open instead of running one unbroken sheet', () => {
    // What makes a cloud read as torn is the SPACING. If every lobe overlapped
    // its neighbour the bank would be a sausage.
    const gaps = banks.flatMap((c) =>
      c.lobes.slice(1).map((l, i) => l.x - c.lobes[i]!.x - c.lobes[i]!.rx));
    expect(gaps.some((gp) => gp > 0)).toBe(true);
  });

  it('covers both frame edges, whatever the tears do', () => {
    // A tear is meant to open INSIDE the bank. One that opens against a frame
    // edge just leaves the corner of the sky bare, and the bank reads as
    // hanging in mid-air. Measured as coverage, not as the lobe's centre.
    for (const seed of [31, 7, 404, 9182]) {
      for (const c of cloudBanks(1440, hz, seed)) {
        const first = c.lobes[0]!;
        const last = c.lobes[c.lobes.length - 1]!;
        expect(first.x - first.rx, `seed ${seed} left`).toBeLessThanOrEqual(0);
        expect(last.x + last.rx, `seed ${seed} right`).toBeGreaterThanOrEqual(1440);
      }
    }
  });

  it('thins the bands nearest the horizon', () => {
    // Perspective runs this way round: cloud low in the frame is further off
    // and compresses toward the vanishing line; cloud overhead is close and
    // keeps its depth.
    const meanRy = (i: number) =>
      banks[i]!.lobes.reduce((s, l) => s + l.ry, 0) / banks[i]!.lobes.length;
    expect(meanRy(2)).toBeLessThan(meanRy(0));
  });

  it('is deterministic', () => {
    expect(cloudBanks(1440, hz, 31)).toEqual(cloudBanks(1440, hz, 31));
  });
});

describe('cityGlowAnchor', () => {
  it('follows the mass of the city, not the middle of the frame', () => {
    // A city is not symmetrical and its glow should not pretend to be.
    const left: Block[] = [
      { kind: 'flat', x: 0, w: 200, top: 100 },
      { kind: 'flat', x: 200, w: 200, top: 380 },
      { kind: 'flat', x: 400, w: 200, top: 380 },
    ];
    expect(cityGlowAnchor(left, 600, 100, 400)).toBeLessThan(300);
  });

  it('weights tall buildings far above short ones', () => {
    const a: Block[] = [
      { kind: 'flat', x: 0, w: 100, top: 110 },
      { kind: 'flat', x: 500, w: 100, top: 390 },
    ];
    expect(cityGlowAnchor(a, 600, 100, 400)).toBeLessThan(150);
  });

  it('falls back to the centre when there is no city', () => {
    expect(cityGlowAnchor([], 600, 100, 400)).toBe(300);
  });
});

const BANDS_AT_THIS_SEED = cloudBanks(1440, hz, 31 + 991).length;

describe('drawSky', () => {
  it('draws stars on a clear night and none in the fog', () => {
    // The stars left `drawSky` for a live pass of their own, because a plate
    // that rebuilds every few minutes cannot twinkle. The rule did not move.
    const clear = countingCtx();
    const foggy = countingCtx();
    drawStars(clear.g, 1440, hz, v, moon, effectsFor('clear').fogScale, 0, 31);
    drawStars(foggy.g, 1440, hz, v, moon, effectsFor('fog').fogScale, 0, 31);
    expect(clear.calls()).toBeGreaterThan(foggy.calls());
  });

  it('goes behind the city, never in front of it', () => {
    // Order is the whole of depth here. Stars over rooftops would be a bug you
    // could see from across the room.
    //
    // It used to be enough that `drawSky` came before `drawSkyline` in one
    // function. The sky is a sandwich now — cached sky, live stars and clouds,
    // cached ground — so what has to hold is that the renderer puts the live
    // pass between the two plates and not after them.
    const src = readFileSync('src/world/renderer.ts', 'utf8');
    const sky = src.indexOf('drawImage(skyPlate');
    const stars = src.indexOf('drawStars(');
    const clouds = src.indexOf('drawClouds(');
    const ground = src.indexOf('drawImage(plate');
    for (const i of [sky, stars, clouds, ground]) expect(i).toBeGreaterThan(-1);
    expect(sky).toBeLessThan(stars);
    expect(stars).toBeLessThan(clouds);
    expect(clouds).toBeLessThan(ground);
  });

  it('never strokes a cloud, and never outlines one', () => {
    // `fill` merges overlapping subpaths; `stroke` does not. Stroking a bank
    // draws a loop of wire around every ellipse in it, including the ones
    // buried in the middle. Nothing in the world layer strokes at all now —
    // a one-pixel line is what stopped this reading as pixel art.
    const c = countingCtx();
    drawSky(c.g, 1440, hz, v, blocks, moon, 30, 1, '#0a0e10', 31);
    drawClouds(c.g, 1440, hz, v, moon, 0, 1, 31);
    expect(c.strokes()).toBe(0);
  });

  /**
   * These two asserted that each bank was ONE linear gradient and ONE `fill`.
   * Both were true of a bank made of ellipses, and neither is a rule — they
   * were the shape of the fix for a real fault: filling lobe by lobe doubled
   * the alpha at every overlap and showed each ellipse's outline through the
   * body, a row of pills instead of a cloud.
   *
   * A bank is a run of quantised columns now, each taking the union of every
   * lobe over it, so that fault cannot occur: there are no lobes in the output
   * to overlap. What is worth testing is the rule itself.
   */
  it('never draws a lobe twice over another', () => {
    const seen = new Map<number, number>();
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get: (_t, key) => (...a: unknown[]) => {
        if (key === 'fillRect') {
          const x = a[0] as number;
          seen.set(x, (seen.get(x) ?? 0) + 1);
        }
        return undefined;
      },
      set: () => true,
    });
    drawClouds(g, 1440, hz, v, moon, 0, 1, 31);
    // Body and lit edge: two rects per column, and never a third.
    for (const n of seen.values()) expect(n).toBeLessThanOrEqual(2 * BANDS_AT_THIS_SEED);
  });

  it('builds a bank out of the pixel grid, not out of curves', () => {
    const xs: number[] = [];
    let ellipses = 0;
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get: (_t, key) => (...a: unknown[]) => {
        if (key === 'fillRect') xs.push(a[0] as number);
        if (key === 'ellipse' || key === 'arc') ellipses++;
        return undefined;
      },
      set: () => true,
    });
    drawClouds(g, 1440, hz, v, moon, 0, 1, 31);
    // A cloud is matter, and matter is quantised. It was the one object in the
    // frame drawing its own outline with a compass.
    expect(ellipses).toBe(0);
    expect(xs.length).toBeGreaterThan(20);
    // A bank starts off-frame to the left, so a column's x can be negative and
    // `-0 % 4` is `-0` — which `toBe(0)` rejects. The claim is divisibility.
    for (const x of xs) expect(x % CLOUD_STEP === 0).toBe(true);
  });

  it('drifts, and stops dead when motion is off', () => {
    const at = (t: number, motion: number) => {
      const xs: number[] = [];
      const g = new Proxy({} as CanvasRenderingContext2D, {
        get: (_t, key) => (...a: unknown[]) => {
          if (key === 'fillRect') xs.push(a[0] as number);
          return undefined;
        },
        set: () => true,
      });
      drawClouds(g, 1440, hz, v, moon, t, motion, 31);
      return xs.join(',');
    };
    expect(at(0, 1)).not.toBe(at(9000, 1));
    expect(at(0, 0)).toBe(at(9000, 0));
  });

  it('gives the banks speeds that never line up into one sheet', () => {
    const a = cloudDrift(60_000, 0, 1);
    const b = cloudDrift(60_000, 1, 1);
    const c = cloudDrift(60_000, 2, 1);
    expect(new Set([a, b, c]).size).toBe(3);
    // And not all the same way, or three bands read as one.
    expect(Math.sign(a) === Math.sign(b) && Math.sign(b) === Math.sign(c)).toBe(false);
  });
});
