import { describe, expect, it } from 'vitest';
import { bestStreak, nightGrid, windowTotals } from '../../src/session/aggregate';
import { nightKey } from '../../src/session/streak';
import type { SessionRecord } from '../../src/store/schema';

const DAY = 86_400_000;
const NOW = new Date(2026, 5, 15, 21, 0, 0).getTime();

/** A kept night `d` days before NOW. */
const on = (d: number, minutes = 50): SessionRecord =>
  ({ startedAt: NOW - d * DAY, minutes, quarryId: null });

describe('nightGrid', () => {
  it('returns one cell per night, oldest first, ending tonight', () => {
    const g = nightGrid([], NOW, 90);
    expect(g).toHaveLength(90);
    expect(g[89]!.key).toBe(nightKey(NOW));
    expect(g[0]!.key).toBe(nightKey(NOW - 89 * DAY));
  });

  it('sums several sessions landing on one night', () => {
    const g = nightGrid([on(3, 20), on(3, 25)], NOW, 90);
    expect(g.find((n) => n.key === nightKey(NOW - 3 * DAY))!.minutes).toBe(45);
  });

  it('reaches nights the seven-day view never showed', () => {
    // The whole point: the store keeps ninety days and the panel showed seven.
    const g = nightGrid([on(40)], NOW, 90);
    expect(g.find((n) => n.key === nightKey(NOW - 40 * DAY))!.minutes).toBe(50);
  });
});

describe('bestStreak', () => {
  it('finds the longest run anywhere, not the run ending tonight', () => {
    // A five-night run a month ago, and nothing since. `streakLength` would
    // report 0 here, which says nothing about whether this was a good month.
    const s = [30, 31, 32, 33, 34].map((d) => on(d));
    expect(bestStreak(s, NOW, 90)).toBe(5);
  });

  it('does not join two runs across a missed night', () => {
    const s = [10, 11, 13, 14, 15].map((d) => on(d));
    expect(bestStreak(s, NOW, 90)).toBe(3);
  });

  it('is zero on an empty ledger', () => {
    expect(bestStreak([], NOW, 90)).toBe(0);
  });
});

describe('windowTotals', () => {
  it('counts minutes and kept nights, not sessions', () => {
    // Two sessions on one night is one night kept.
    const t = windowTotals([on(2, 20), on(2, 30), on(9, 45)], NOW, 90);
    expect(t.minutes).toBe(95);
    expect(t.nights).toBe(2);
  });

  it('ignores what has already fallen out of the window', () => {
    expect(windowTotals([on(200)], NOW, 90)).toEqual({ minutes: 0, nights: 0 });
  });
});
