import { describe, expect, it } from 'vitest';
import { bestHour, minutesByHour } from '../../src/session/aggregate';
import { NIGHT_BOUNDARY_HOUR } from '../../src/session/streak';

/** A local time, built the way the aggregate reads them back. */
const at = (h: number, m = 0) => new Date(2026, 0, 15, h, m, 0, 0).getTime();
const minutesAt = (rows: { hour: number; minutes: number }[], hour: number) =>
  rows.find((r) => r.hour === hour)!.minutes;

describe('minutesByHour', () => {
  it('reads the night from its own boundary, not from midnight', () => {
    const rows = minutesByHour([]);
    expect(rows).toHaveLength(24);
    expect(rows[0]!.hour).toBe(NIGHT_BOUNDARY_HOUR);
    expect(rows[23]!.hour).toBe((NIGHT_BOUNDARY_HOUR + 23) % 24);
    expect(new Set(rows.map((r) => r.hour)).size).toBe(24);
  });

  /**
   * The whole reason this is not a one-liner. Filing a watch under the hour it
   * STARTED puts fifty minutes at 20:00 when thirty of them happened at 21:00,
   * and the chart then recommends an hour you were not working in.
   */
  it('splits a watch across the hours it actually occupied', () => {
    const rows = minutesByHour([{ startedAt: at(20, 30), minutes: 50, quarryId: null }]);
    expect(minutesAt(rows, 20)).toBe(30);
    expect(minutesAt(rows, 21)).toBe(20);
  });

  it('carries a watch across midnight into the same night', () => {
    const rows = minutesByHour([{ startedAt: at(23, 40), minutes: 45, quarryId: null }]);
    expect(minutesAt(rows, 23)).toBe(20);
    expect(minutesAt(rows, 0)).toBe(25);
    // And 00:00 sits AFTER 23:00 in the row, because the night has not ended.
    const i = (h: number) => rows.findIndex((r) => r.hour === h);
    expect(i(0)).toBeGreaterThan(i(23));
  });

  it('keeps a watch that starts exactly on the hour in one bucket', () => {
    const rows = minutesByHour([{ startedAt: at(2), minutes: 60, quarryId: null }]);
    expect(minutesAt(rows, 2)).toBe(60);
    expect(minutesAt(rows, 3)).toBe(0);
  });

  it('adds up several watches in the same hour', () => {
    const rows = minutesByHour([
      { startedAt: at(21, 0), minutes: 20, quarryId: null },
      { startedAt: at(21, 30), minutes: 15, quarryId: null },
    ]);
    expect(minutesAt(rows, 21)).toBe(35);
  });

  it('never loses or invents a minute', () => {
    const rows = minutesByHour([
      { startedAt: at(19, 17), minutes: 50, quarryId: null },
      { startedAt: at(23, 55), minutes: 90, quarryId: null },
      { startedAt: at(4, 3), minutes: 25, quarryId: null },
    ]);
    expect(rows.reduce((s, r) => s + r.minutes, 0)).toBe(165);
  });

  /** One corrupt record must not spin the loop; nothing legitimate reaches it. */
  it('survives a nonsense record', () => {
    const rows = minutesByHour([
      { startedAt: at(12), minutes: Number.POSITIVE_INFINITY, quarryId: null },
      { startedAt: at(12), minutes: -5, quarryId: null },
      { startedAt: at(12), minutes: 1e9, quarryId: null },
    ]);
    expect(rows.reduce((s, r) => s + r.minutes, 0)).toBe(2160);
  });
});

describe('bestHour', () => {
  it('has no answer before there is anything to rank', () => {
    expect(bestHour(minutesByHour([]))).toBeNull();
  });

  it('names the hour with the most minutes in it', () => {
    const rows = minutesByHour([
      { startedAt: at(20, 0), minutes: 20, quarryId: null },
      { startedAt: at(22, 0), minutes: 55, quarryId: null },
    ]);
    expect(bestHour(rows)).toEqual({ hour: 22, minutes: 55 });
  });

  /** Ties resolve toward the start of the NIGHT, which is the row's own order. */
  it('breaks a tie toward the earlier hour of the night', () => {
    const rows = minutesByHour([
      { startedAt: at(5, 0), minutes: 30, quarryId: null },
      { startedAt: at(23, 0), minutes: 30, quarryId: null },
    ]);
    expect(bestHour(rows)?.hour).toBe(5);
  });
});
