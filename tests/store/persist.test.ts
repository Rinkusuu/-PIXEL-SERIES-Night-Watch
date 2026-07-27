// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { CORRUPT_PREFIX, STORAGE_KEY, emptySchema } from '../../src/store/schema';
import { load, pruneSessions, save } from '../../src/store/persist';

const DAY = 86_400_000;

beforeEach(() => localStorage.clear());

describe('load / save round trip', () => {
  it('returns what was written', () => {
    const data = emptySchema();
    data.quarry.push({ id: 'q1', name: 'refactor auth', minutes: 25, done: false, createdAt: 1 });
    save(data);
    const { data: back, recovered } = load();
    expect(recovered).toBe(false);
    expect(back.quarry[0]!.name).toBe('refactor auth');
  });

  it('returns an empty schema when nothing is stored', () => {
    const { data, recovered } = load();
    expect(recovered).toBe(false);
    expect(data).toEqual(emptySchema());
  });
});

describe('recovery', () => {
  it('starts clean but preserves unreadable data instead of deleting it', () => {
    localStorage.setItem(STORAGE_KEY, '{ this is not json');
    const { data, recovered } = load();
    expect(recovered).toBe(true);
    expect(data).toEqual(emptySchema());

    const rescued = Object.keys(localStorage).filter((k) => k.startsWith(CORRUPT_PREFIX));
    expect(rescued).toHaveLength(1);
    expect(localStorage.getItem(rescued[0]!)).toBe('{ this is not json');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('treats an unknown version as unreadable', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 7, quarry: [] }));
    const { recovered } = load();
    expect(recovered).toBe(true);
  });

  it('treats a structurally wrong payload as unreadable', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, quarry: 'nope' }));
    const { recovered } = load();
    expect(recovered).toBe(true);
  });

  it('fills in a missing settings block rather than failing', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, quarry: [], sessions: [] }));
    const { data, recovered } = load();
    expect(recovered).toBe(false);
    expect(data.settings.huntMinutes).toBe(50);
  });
});

describe('pruneSessions', () => {
  const now = 1_000 * DAY;

  it('keeps the last 90 days and drops the rest', () => {
    const sessions = [
      { startedAt: now - 1 * DAY, minutes: 50, quarryId: null },
      { startedAt: now - 89 * DAY, minutes: 50, quarryId: null },
      { startedAt: now - 91 * DAY, minutes: 50, quarryId: null },
    ];
    const kept = pruneSessions(sessions, now);
    expect(kept).toHaveLength(2);
    expect(kept.every((s) => s.startedAt > now - 90 * DAY)).toBe(true);
  });

  it('runs on save', () => {
    const data = emptySchema();
    data.sessions.push({ startedAt: now - 200 * DAY, minutes: 50, quarryId: null });
    data.sessions.push({ startedAt: now - 2 * DAY, minutes: 50, quarryId: null });
    save(data, now);
    expect(load().data.sessions).toHaveLength(1);
  });
});

describe('quota failure', () => {
  it('does not throw when the write is rejected', () => {
    const hostile: Storage = {
      length: 0,
      clear: () => {},
      getItem: () => null,
      key: () => null,
      removeItem: () => {},
      setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
    };
    expect(() => save(emptySchema(), Date.now(), hostile)).not.toThrow();
  });
});
