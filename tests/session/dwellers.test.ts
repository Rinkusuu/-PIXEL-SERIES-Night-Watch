import { describe, expect, it } from 'vitest';
import { DWELLER_COUNT, DWELLER_LINES, dwellerAt } from '../../src/session/dwellers';

describe('dwellerAt', () => {
  /**
   * The whole point. A window that offered a fresh stranger on every press
   * would be a slot machine, and the scene would stop being a place.
   */
  it('gives the same window the same occupant, every time', () => {
    for (const [x, y] of [[120, 340], [880, 210], [43, 97]] as const) {
      const first = dwellerAt(x, y);
      for (let i = 0; i < 20; i++) expect(dwellerAt(x, y)).toBe(first);
    }
  });

  it('always answers with a line it actually has', () => {
    for (let x = 0; x < 400; x += 7) {
      for (let y = 0; y < 200; y += 11) {
        expect(DWELLER_LINES).toContain(dwellerAt(x, y));
      }
    }
  });

  /** A city of one occupant repeated is not a city. */
  it('uses the whole cast across a frame of windows', () => {
    const seen = new Set<string>();
    for (let x = 0; x < 1400; x += 13) {
      for (let y = 0; y < 400; y += 17) seen.add(dwellerAt(x, y));
    }
    expect(seen.size).toBe(DWELLER_COUNT);
  });

  it('does not put the same person in every window of a wall', () => {
    const row = Array.from({ length: 12 }, (_, i) => dwellerAt(200 + i * 9, 300));
    expect(new Set(row).size).toBeGreaterThan(4);
  });
});

describe('what the watch says', () => {
  /** The controls speak Indonesian; the world speaks English, in lower case. */
  it('speaks in the watchman\'s register', () => {
    for (const line of DWELLER_LINES) {
      expect(line).toBe(line.toLowerCase());
      expect(line.endsWith('.')).toBe(true);
      // It has to fit the one line under the clock.
      expect(line.length).toBeLessThanOrEqual(78);
    }
  });

  it('has no duplicates', () => {
    expect(new Set(DWELLER_LINES).size).toBe(DWELLER_COUNT);
  });
});
