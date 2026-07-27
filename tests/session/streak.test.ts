import { describe, expect, it } from 'vitest';
import { NIGHT_BOUNDARY_HOUR, nightKey, streakLength } from '../../src/session/streak';

/** Local-time helper so these tests pass in any timezone. */
const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0).getTime();

const session = (ts: number) => ({ startedAt: ts, minutes: 50, quarryId: null });

describe('nightKey', () => {
  it('uses a 04:00 boundary, not midnight', () => {
    expect(NIGHT_BOUNDARY_HOUR).toBe(4);
    // 01:30 on the 12th still belongs to the night of the 11th
    expect(nightKey(at(2026, 7, 12, 1, 30))).toBe('2026-07-11');
    // 04:00 on the 12th starts the new night
    expect(nightKey(at(2026, 7, 12, 4, 0))).toBe('2026-07-12');
    expect(nightKey(at(2026, 7, 12, 23, 0))).toBe('2026-07-12');
  });

  it('rolls back across a month boundary', () => {
    expect(nightKey(at(2026, 8, 1, 2, 0))).toBe('2026-07-31');
  });

  it('rolls back across a year boundary', () => {
    expect(nightKey(at(2027, 1, 1, 3, 59))).toBe('2026-12-31');
  });
});

describe('streakLength', () => {
  const now = at(2026, 7, 27, 22, 0);

  it('is zero with no sessions', () => {
    expect(streakLength([], now)).toBe(0);
  });

  it('counts a chain ending tonight', () => {
    const s = [
      session(at(2026, 7, 27, 21, 0)),
      session(at(2026, 7, 26, 21, 0)),
      session(at(2026, 7, 25, 21, 0)),
    ];
    expect(streakLength(s, now)).toBe(3);
  });

  it('counts a chain ending last night when tonight is still empty', () => {
    const s = [session(at(2026, 7, 26, 21, 0)), session(at(2026, 7, 25, 21, 0))];
    expect(streakLength(s, now)).toBe(2);
  });

  it('breaks when a night is missed', () => {
    const s = [
      session(at(2026, 7, 27, 21, 0)),
      session(at(2026, 7, 25, 21, 0)),
      session(at(2026, 7, 24, 21, 0)),
    ];
    expect(streakLength(s, now)).toBe(1);
  });

  it('is zero when the last session is older than last night', () => {
    expect(streakLength([session(at(2026, 7, 20, 21, 0))], now)).toBe(0);
  });

  it('does not count two sessions in one night twice', () => {
    const s = [
      session(at(2026, 7, 27, 21, 0)),
      session(at(2026, 7, 28, 1, 0)),   // same night as above
      session(at(2026, 7, 26, 21, 0)),
    ];
    expect(streakLength(s, now)).toBe(2);
  });

  it('is order-independent', () => {
    const s = [
      session(at(2026, 7, 25, 21, 0)),
      session(at(2026, 7, 27, 21, 0)),
      session(at(2026, 7, 26, 21, 0)),
    ];
    expect(streakLength(s, now)).toBe(3);
  });
});
