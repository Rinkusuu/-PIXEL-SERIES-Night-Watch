import { describe, expect, it } from 'vitest';
import { minutesByNight, minutesByQuarry } from '../../src/session/aggregate';

const at = (y: number, m: number, d: number, h: number) =>
  new Date(y, m - 1, d, h, 0, 0, 0).getTime();

const now = at(2026, 7, 27, 22);

describe('minutesByNight', () => {
  it('returns exactly `days` rows, oldest first, gaps filled with zero', () => {
    const rows = minutesByNight([{ startedAt: at(2026, 7, 27, 21), minutes: 50, quarryId: null }], now, 7);
    expect(rows).toHaveLength(7);
    expect(rows[0]!.key).toBe('2026-07-21');
    expect(rows[6]!.key).toBe('2026-07-27');
    expect(rows[6]!.minutes).toBe(50);
    expect(rows[0]!.minutes).toBe(0);
  });

  it('sums several sessions in one night', () => {
    const rows = minutesByNight([
      { startedAt: at(2026, 7, 27, 21), minutes: 50, quarryId: null },
      { startedAt: at(2026, 7, 28, 1), minutes: 25, quarryId: null },
    ], now, 7);
    expect(rows[6]!.minutes).toBe(75);
  });

  it('ignores sessions outside the window', () => {
    const rows = minutesByNight([{ startedAt: at(2026, 6, 1, 21), minutes: 50, quarryId: null }], now, 7);
    expect(rows.every((r) => r.minutes === 0)).toBe(true);
  });
});

describe('minutesByQuarry', () => {
  it('totals per quarry and drops unattached sessions', () => {
    const totals = minutesByQuarry([
      { startedAt: 1, minutes: 50, quarryId: 'q1' },
      { startedAt: 2, minutes: 25, quarryId: 'q1' },
      { startedAt: 3, minutes: 10, quarryId: 'q2' },
      { startedAt: 4, minutes: 99, quarryId: null },
    ]);
    expect(totals).toEqual({ q1: 75, q2: 10 });
  });

  it('is an empty object for no sessions', () => {
    expect(minutesByQuarry([])).toEqual({});
  });
});
