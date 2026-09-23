import { describe, expect, it } from 'vitest';
import { bellAt, mixFor } from '../../src/app/ambience';
import { emptySchema } from '../../src/store/schema';
import type { Weather } from '../../src/world/weather';

const ALL: Weather[] = ['clear', 'fog', 'rain', 'snow', 'fullmoon'];

describe('the mix', () => {
  it('always has a river under it — that is what the place is', () => {
    for (const w of ALL) {
      expect(mixFor(w, 0.5).river).toBeGreaterThan(0);
    }
  });

  it('only rains when it is raining', () => {
    for (const w of ALL) {
      expect(mixFor(w, 0.5).rain > 0).toBe(w === 'rain');
    }
  });

  /**
   * The whole trick of the weather here. Fog and snow do not ADD a sound, they
   * take the top off everything — which is what they do to a city, and why a
   * foggy night is remembered as a quiet one even though nothing has stopped.
   */
  it('muffles rather than adding, in fog and snow', () => {
    const clear = mixFor('clear', 0.5);
    for (const w of ['fog', 'snow'] as const) {
      const m = mixFor(w, 0.5);
      expect(m.cutoff).toBeLessThan(clear.cutoff);
      expect(m.rain).toBe(0);
    }
    // And snow is the quietest thing that happens to a city.
    expect(mixFor('snow', 0.5).cutoff).toBeLessThan(mixFor('fog', 0.5).cutoff);
  });

  it('carries furthest on a clear cold night', () => {
    expect(mixFor('fullmoon', 0.5).cutoff).toBeGreaterThan(mixFor('clear', 0.5).cutoff);
  });

  /** Rain drowns the river: standing in it you would not hear what you stand over. */
  it('drops the river when it rains', () => {
    expect(mixFor('rain', 0.5).river).toBeLessThan(mixFor('clear', 0.5).river);
  });

  it('thins toward both ends of the night', () => {
    const peak = mixFor('clear', 0.62).river;
    expect(mixFor('clear', 0).river).toBeLessThan(peak);
    expect(mixFor('clear', 1).river).toBeLessThan(peak);
  });

  it('never asks for a gain it cannot have', () => {
    for (const w of ALL) {
      for (const p of [0, 0.25, 0.62, 1]) {
        const m = mixFor(w, p);
        for (const level of [m.river, m.rain, m.wind]) {
          expect(level).toBeGreaterThanOrEqual(0);
          expect(level).toBeLessThanOrEqual(1);
        }
        expect(m.cutoff).toBeGreaterThan(40);
      }
    }
  });
});

describe('the hour bell', () => {
  const at = (h: number, m: number) => new Date(2026, 8, 23, h, m, 0, 0).getTime();

  /**
   * The wall clock, not the session — the same decision the barge already
   * makes. A bell that only rang while you worked would be a reward; one that
   * rings at one in the morning whether or not anyone is listening is a city.
   */
  it('strikes only on the hour', () => {
    expect(bellAt(at(21, 0))).not.toBeNull();
    for (const m of [1, 17, 30, 59]) expect(bellAt(at(21, m))).toBeNull();
  });

  it('counts the hour the way a bell does', () => {
    expect(bellAt(at(1, 0))).toBe(1);
    expect(bellAt(at(11, 0))).toBe(11);
    // Twelve, not zero. Nobody has ever heard a clock strike nought.
    expect(bellAt(at(0, 0))).toBe(12);
    expect(bellAt(at(12, 0))).toBe(12);
    expect(bellAt(at(13, 0))).toBe(1);
    expect(bellAt(at(23, 0))).toBe(11);
  });

  it('never asks for a count outside a dial', () => {
    for (let h = 0; h < 24; h++) {
      const n = bellAt(at(h, 0))!;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(12);
    }
  });
});

describe('the setting', () => {
  /**
   * Off, and it has to be. A page that starts playing at you is a hostile
   * page — and unlike the chime, which speaks once when something happened,
   * this runs for the whole watch.
   */
  it('is silent until it is asked for', () => {
    expect(emptySchema().settings.ambience).toBe(false);
  });

  it('starts at a level nobody has to reach for', () => {
    const v = emptySchema().settings.ambienceVolume;
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThanOrEqual(1);
  });
});
