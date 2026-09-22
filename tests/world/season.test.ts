import { describe, expect, it } from 'vitest';
import { seasonOf, type Season } from '../../src/world/season';
import { effectsFor, weatherFor, type Weather } from '../../src/world/weather';

describe('seasonOf', () => {
  it('reads the month out of a night key', () => {
    expect(seasonOf('2026-01-15')).toBe('winter');
    expect(seasonOf('2026-02-28')).toBe('winter');
    expect(seasonOf('2026-12-01')).toBe('winter');
    expect(seasonOf('2026-04-01')).toBe('spring');
    expect(seasonOf('2026-07-04')).toBe('summer');
    expect(seasonOf('2026-10-31')).toBe('autumn');
  });

  it('covers all twelve months without a gap', () => {
    const seen = new Set<Season>();
    for (let m = 1; m <= 12; m++) {
      seen.add(seasonOf(`2026-${String(m).padStart(2, '0')}-15`));
    }
    expect(seen.size).toBe(4);
  });

  it('answers something for a key it cannot read', () => {
    expect(seasonOf('rubbish')).toBe('autumn');
    expect(seasonOf('2026-99-01')).toBe('autumn');
  });
});

/**
 * Sampled across real night keys rather than by reading the table back. A test
 * that reads the constant it is checking only proves the constant was copied
 * correctly into two places.
 */
function tally(year: number, month: number): Record<Weather, number> {
  const out = { clear: 0, fog: 0, rain: 0, snow: 0, fullmoon: 0 };
  for (let d = 1; d <= 28; d++) {
    out[weatherFor(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)]++;
  }
  return out;
}

describe('the weather through the year', () => {
  /** Snow happens in winter or it does not happen. */
  it('never snows outside winter', () => {
    for (const m of [3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      for (const y of [2025, 2026, 2027]) expect(tally(y, m).snow).toBe(0);
    }
  });

  it('does snow in winter', () => {
    const total = [1, 2, 12].reduce((s, m) => s + tally(2026, m).snow, 0);
    expect(total).toBeGreaterThan(0);
  });

  /** The great fogs are an autumn and winter affair. */
  it('fogs more in autumn than in summer', () => {
    const years = [2024, 2025, 2026, 2027, 2028];
    const autumn = years.reduce((s, y) => s + tally(y, 10).fog + tally(y, 11).fog, 0);
    const summer = years.reduce((s, y) => s + tally(y, 7).fog + tally(y, 8).fog, 0);
    expect(autumn).toBeGreaterThan(summer);
  });

  it('clears more in summer than in autumn', () => {
    const years = [2024, 2025, 2026, 2027, 2028];
    const summer = years.reduce((s, y) => s + tally(y, 7).clear + tally(y, 8).clear, 0);
    const autumn = years.reduce((s, y) => s + tally(y, 10).clear + tally(y, 11).clear, 0);
    expect(summer).toBeGreaterThan(autumn);
  });

  /**
   * The point of seeding from the key. A night that reshuffled on a resize, or
   * between two tabs, would not be a night.
   */
  it('gives the same night the same weather every time', () => {
    for (const k of ['2026-01-09', '2026-06-21', '2026-11-02']) {
      expect(weatherFor(k)).toBe(weatherFor(k));
    }
  });

  /** Every column has to sum to 1, or the tail outcome absorbs the remainder. */
  it('always reaches an answer, on every day of every month', () => {
    for (let m = 1; m <= 12; m++) {
      const t = tally(2026, m);
      expect(Object.values(t).reduce((a, b) => a + b, 0)).toBe(28);
    }
  });
});

describe('snow as its own night', () => {
  /**
   * Snow is not rain drawn slowly. Every surface turns reflective, so the halos
   * swell and the frame comes up — the opposite of what rain does to it.
   */
  it('lifts the light where rain hardens it', () => {
    const snow = effectsFor('snow');
    const rain = effectsFor('rain');
    expect(snow.haloScale).toBeGreaterThan(rain.haloScale);
    expect(snow.lumLift).toBeGreaterThan(rain.lumLift);
  });

  it('never falls as both at once', () => {
    for (const w of ['clear', 'fog', 'rain', 'snow', 'fullmoon'] as const) {
      const fx = effectsFor(w);
      expect(fx.rain > 0 && fx.snow > 0).toBe(false);
    }
  });
});
