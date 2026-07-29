import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  cityGlowAnchor, cloudBanks, drawSky, starField, starVisibility,
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

describe('drawSky', () => {
  it('draws stars on a clear night and none in the fog', () => {
    const clear = countingCtx();
    const foggy = countingCtx();
    drawSky(clear.g, 1440, hz, v, blocks, moon, effectsFor('clear').fogScale, '#0a0e10', 31);
    drawSky(foggy.g, 1440, hz, v, blocks, moon, effectsFor('fog').fogScale, '#0a0e10', 31);
    expect(clear.calls()).toBeGreaterThan(foggy.calls());
  });

  it('goes on the plate behind the city, never in front of it', () => {
    // Order is the whole of depth here. Stars over rooftops would be a bug you
    // could see from across the room.
    const src = readFileSync('src/world/layers.ts', 'utf8');
    expect(src.indexOf('drawSky(')).toBeGreaterThan(-1);
    expect(src.indexOf('drawSky(')).toBeLessThan(src.indexOf('drawSkyline('));
  });

  it('never strokes a cloud, and never outlines one', () => {
    // `fill` merges overlapping subpaths; `stroke` does not. Stroking a bank
    // draws a loop of wire around every ellipse in it, including the ones
    // buried in the middle. Nothing in the world layer strokes at all now —
    // a one-pixel line is what stopped this reading as pixel art.
    const c = countingCtx();
    drawSky(c.g, 1440, hz, v, blocks, moon, 1, '#0a0e10', 31);
    expect(c.strokes()).toBe(0);
  });

  it('washes each bank once from the side the moon is on', () => {
    let grads = 0;
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get(_t, key) {
        if (key === 'createLinearGradient') {
          return () => { grads++; return { addColorStop: () => {} }; };
        }
        if (key === 'createRadialGradient') return () => ({ addColorStop: () => {} });
        return () => {};
      },
      set: () => true,
    });
    drawSky(g, 1440, hz, v, blocks, moon, 1, '#0a0e10', 31);
    expect(grads).toBe(cloudBanks(1440, hz, 31 + 991).length);
  });

  it('fills each bank in one path so the lobes do not show through', () => {
    // Filling lobe by lobe doubles the alpha at every overlap and outlines each
    // ellipse in the body — a row of pills instead of a cloud.
    let fills = 0;
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get(_t, key) {
        if (key === 'createRadialGradient' || key === 'createLinearGradient') {
          return () => ({ addColorStop: () => {} });
        }
        if (key === 'fill') return () => { fills++; };
        return () => {};
      },
      set: () => true,
    });
    drawSky(g, 1440, hz, v, blocks, moon, 1, '#0a0e10', 31);
    // One per bank, and none for the dome or the stars, which are fillRects.
    expect(fills).toBe(cloudBanks(1440, hz, 31 + 991).length);
  });
});
