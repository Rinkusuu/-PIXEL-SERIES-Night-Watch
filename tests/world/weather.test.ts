import { describe, expect, it } from 'vitest';
import {
  BARGE_CROSS_MS, BARGE_PERIOD_MS, BIRD_COUNT, bargeAt, birdAt, effectsFor, weatherFor,
} from '../../src/world/weather';
import { drawWeather } from '../../src/world/weather';
import { horizon } from '../../src/world/horizon';
import { skyline } from '../../src/world/city';
import { resolve } from '../../src/ambient/interpolate';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';
import type { Water } from '../../src/world/water';

describe('weatherFor', () => {
  it('gives the same night the same weather, always', () => {
    expect(weatherFor('2026-07-28')).toBe(weatherFor('2026-07-28'));
  });

  it('does not give every night the same weather', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 28; d++) {
      seen.add(weatherFor(`2026-02-${String(d).padStart(2, '0')}`));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('lands near the intended weights over a thousand nights', () => {
    const tally: Record<string, number> = { clear: 0, fog: 0, rain: 0, fullmoon: 0 };
    for (let i = 0; i < 1000; i++) tally[weatherFor(`k${i}`)]!++;
    expect(tally.clear! / 1000).toBeGreaterThan(0.30);
    expect(tally.clear! / 1000).toBeLessThan(0.50);
    expect(tally.fullmoon! / 1000).toBeGreaterThan(0.04);
    expect(tally.fullmoon! / 1000).toBeLessThan(0.17);
    expect(tally.rain!).toBeGreaterThan(0);
    expect(tally.fog!).toBeGreaterThan(0);
  });
});

describe('effectsFor', () => {
  it('thins the fog when it rains — rain washes fog out', () => {
    expect(effectsFor('rain').fogScale).toBeLessThan(effectsFor('clear').fogScale);
    expect(effectsFor('fog').fogScale).toBeGreaterThan(effectsFor('clear').fogScale);
  });
  it('only rains on a rainy night', () => {
    expect(effectsFor('rain').rain).toBeGreaterThan(0);
    for (const w of ['clear', 'fog', 'fullmoon'] as const) {
      expect(effectsFor(w).rain).toBe(0);
    }
  });
  it('grounds the birds when the weather is bad', () => {
    expect(effectsFor('clear').birds).toBe(true);
    expect(effectsFor('fullmoon').birds).toBe(true);
    expect(effectsFor('rain').birds).toBe(false);
    expect(effectsFor('fog').birds).toBe(false);
  });
  it('only enlarges the moon on a full moon', () => {
    expect(effectsFor('fullmoon').moonScale).toBeGreaterThan(1);
    expect(effectsFor('clear').moonScale).toBe(1);
  });
});

describe('bargeAt', () => {
  it('is deterministic for a moment in time', () => {
    expect(bargeAt(1_234_567)).toBe(bargeAt(1_234_567));
  });
  it('is absent for most of its period — a barge is rare, not traffic', () => {
    let present = 0;
    const samples = 900;
    for (let i = 0; i < samples; i++) {
      if (bargeAt((i / samples) * BARGE_PERIOD_MS) !== null) present++;
    }
    expect(present / samples).toBeLessThan(0.2);
  });
  it('crosses in one direction while it is on screen', () => {
    const a = bargeAt(1000)!;
    const b = bargeAt(BARGE_CROSS_MS - 1000)!;
    expect(a).not.toBeNull();
    expect(b).toBeGreaterThan(a);
  });
  it('enters and leaves off-screen', () => {
    expect(bargeAt(0)!).toBeLessThan(0);
    expect(bargeAt(BARGE_CROSS_MS - 1)!).toBeGreaterThan(1);
  });
});

describe('birdAt', () => {
  it('is deterministic', () => {
    expect(birdAt(500_000, 0)).toEqual(birdAt(500_000, 0));
  });

  it('gives each bird its own altitude, so they are not one dot', () => {
    // Sampled at the moment each bird enters the frame — they are deliberately
    // offset in time, so asking for all three at one instant would usually find
    // only one and prove nothing.
    const altitudes = new Set<number>();
    for (let i = 0; i < BIRD_COUNT; i++) {
      for (let t = 0; t < 40_000; t += 250) {
        const b = birdAt(t, i);
        if (b) { altitudes.add(Math.round(b.y * 100)); break; }
      }
    }
    expect(altitudes.size).toBeGreaterThan(1);
  });

  it('lets every bird finish its crossing and leave', () => {
    for (let i = 0; i < BIRD_COUNT; i++) {
      let seen = false;
      for (let t = 0; t < 40_000; t += 250) if (birdAt(t, i)) { seen = true; break; }
      expect(seen).toBe(true);
    }
  });
});

describe('rain', () => {
  const hz = horizon(900, Math.round(900 * 0.66));
  const v = resolve(NIGHT_KEYS, 0.5, gradesFor(['calm']));
  const blocks = skyline(1440, hz.cityTop, hz.cityBot, 11);
  const water: Water = { ring: () => {}, update: () => {}, draw: () => {} } as unknown as Water;

  /** Every y a stroke path starts at, over a spread of frames. */
  function heads(): number[] {
    const out: number[] = [];
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get(_t, key) {
        if (key === 'moveTo') return (_x: number, y: number) => out.push(y);
        if (key === 'createLinearGradient' || key === 'createRadialGradient') {
          return () => ({ addColorStop: () => {} });
        }
        return () => {};
      },
      set: () => true,
    });
    for (const t of [0, 137, 401, 909, 1600]) {
      drawWeather(g, 1440, hz, v, 'rain', blocks, water, t, 1, 0);
    }
    return out;
  }

  it('falls all the way to the foot of the frame, not to the parapet', () => {
    // It was modulo `hz.railBot`, so every drop wrapped back to the top the
    // instant it reached the balustrade, and the deck the player stands on
    // stayed dry through a rainy night — the ONE surface near enough to notice.
    // A fifth of all nights are rainy.
    const below = heads().filter((y) => y > hz.railBot);
    expect(below.length).toBeGreaterThan(0);
    expect(Math.max(...heads())).toBeGreaterThan(hz.deckTop);
  });

  it('still never starts a drop below the frame', () => {
    expect(Math.max(...heads())).toBeLessThanOrEqual(hz.h);
  });
});
