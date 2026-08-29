import { describe, expect, it } from 'vitest';
import { HUNT_RANGE, RESPITE_RANGE, clampMinutes, emptySchema } from '../../src/store/schema';
import { load } from '../../src/store/persist';
import { STORAGE_KEY } from '../../src/store/schema';

function fakeStore(seed?: string): Storage {
  const m = new Map<string, string>();
  if (seed !== undefined) m.set(STORAGE_KEY, seed);
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

describe('duration bounds', () => {
  it('refuses a zero-minute hunt, which is not a short session', () => {
    expect(clampMinutes(0, HUNT_RANGE)).toBe(HUNT_RANGE.min);
    expect(clampMinutes(-30, RESPITE_RANGE)).toBe(RESPITE_RANGE.min);
  });

  it('caps the top and rounds, and survives a blank field', () => {
    expect(clampMinutes(9999, HUNT_RANGE)).toBe(HUNT_RANGE.max);
    expect(clampMinutes(25.6, HUNT_RANGE)).toBe(26);
    // `Number('')` is NaN, which is what an emptied number input produces.
    expect(clampMinutes(NaN, HUNT_RANGE)).toBe(HUNT_RANGE.min);
  });
});

describe('loading a store written before alerts existed', () => {
  it('fills the alerts block rather than leaving it undefined', () => {
    const old = JSON.stringify({
      version: 1, quarry: [], sessions: [],
      settings: { huntMinutes: 25, respiteMinutes: 5, motion: 'off' },
    });
    const { data } = load(fakeStore(old));
    // The user's own settings survive…
    expect(data.settings.huntMinutes).toBe(25);
    expect(data.settings.motion).toBe('off');
    // …and the block that did not exist yet is filled from the defaults, so
    // every reader of `settings.alerts.title` gets a boolean, not a crash.
    expect(data.settings.alerts).toEqual(emptySchema().settings.alerts);
  });

  it('leaves notifications off by default', () => {
    // An unprompted permission dialog is the thing this app avoids by having
    // no account and no server.
    expect(emptySchema().settings.alerts.notify).toBe(false);
  });
});
