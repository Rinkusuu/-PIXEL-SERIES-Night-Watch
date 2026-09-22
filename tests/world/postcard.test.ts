import { describe, expect, it } from 'vitest';
import { longNight, longSpan, postcardLines, postcardName } from '../../src/world/postcard';

describe('longNight', () => {
  /**
   * Parsed by hand rather than through `new Date(key)`, which reads a bare
   * `YYYY-MM-DD` as UTC — so anyone west of Greenwich would get the night
   * before printed on a plate whose entire subject is which night it was.
   */
  it('reads a night key in local terms', () => {
    expect(longNight('2026-09-22')).toBe('22 SEPTEMBER 2026');
    expect(longNight('2026-01-01')).toBe('1 JANUARY 2026');
    expect(longNight('2026-12-31')).toBe('31 DECEMBER 2026');
  });

  it('prints something rather than nothing when handed nonsense', () => {
    expect(longNight('rubbish')).toBe('rubbish');
    expect(longNight('2026-13-01')).toBe('2026-13-01');
  });
});

describe('longSpan', () => {
  it('says minutes under the hour', () => {
    expect(longSpan(0)).toBe('0M');
    expect(longSpan(59)).toBe('59M');
  });

  /** `0H 45M` is not how anyone says forty-five minutes. */
  it('says hours once there are any, and drops an empty remainder', () => {
    expect(longSpan(60)).toBe('1H');
    expect(longSpan(120)).toBe('2H');
    expect(longSpan(95)).toBe('1H 35M');
  });
});

describe('postcardLines', () => {
  const base = { night: '2026-09-22', weather: 'fog' as const, minutes: 150, sessions: 3, streak: 4 };

  it('names the night, the weather and what was kept', () => {
    const [title, date, facts] = postcardLines(base);
    expect(title).toBe('NIGHT WATCH');
    expect(date).toBe('22 SEPTEMBER 2026');
    expect(facts).toBe('FOG · 3 WATCHES · 2H 30M · 4 NIGHTS');
  });

  it('counts one of a thing in the singular', () => {
    const [, , facts] = postcardLines({ ...base, sessions: 1, minutes: 50, streak: 1 });
    expect(facts).toBe('FOG · 1 WATCH · 50M · 1 NIGHT');
  });

  /** A night with nothing on it still gets a plate: the view was the same. */
  it('has something to say about a night nobody kept', () => {
    const [, , facts] = postcardLines({ ...base, sessions: 0, minutes: 0, streak: 0 });
    expect(facts).toBe('FOG · NO WATCH KEPT');
  });

  /** The plate is part of the world, and the world speaks English. */
  it('speaks the world\'s language throughout', () => {
    for (const line of postcardLines(base)) {
      expect(line).toBe(line.toUpperCase());
    }
  });
});

describe('postcardName', () => {
  it('names the file after the night it is of', () => {
    expect(postcardName('2026-09-22')).toBe('night-watch-2026-09-22.png');
  });
});
