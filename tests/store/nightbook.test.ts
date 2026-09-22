import { describe, expect, it } from 'vitest';
import { emptySchema, type Schema } from '../../src/store/schema';
import { load, pruneLog, save } from '../../src/store/persist';
import { fromTransfer, toTransfer } from '../../src/store/transfer';
import { nightKey } from '../../src/session/streak';

const DAY = 86_400_000;
const NOW = new Date(2026, 8, 22, 21, 0, 0).getTime();

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

describe('pruneLog', () => {
  /**
   * Compared by KEY rather than by parsing each one into a date: the keys are
   * `YYYY-MM-DD` and sort lexicographically, so there is no timezone in the
   * comparison to get wrong.
   */
  it('keeps what is inside the window and drops what is not', () => {
    const log = {
      [nightKey(NOW)]: 'tonight',
      [nightKey(NOW - 30 * DAY)]: 'a month ago',
      [nightKey(NOW - 200 * DAY)]: 'long gone',
    };
    const kept = pruneLog(log, NOW);
    expect(kept[nightKey(NOW)]).toBe('tonight');
    expect(kept[nightKey(NOW - 30 * DAY)]).toBe('a month ago');
    expect(kept[nightKey(NOW - 200 * DAY)]).toBeUndefined();
  });

  it('survives a store that has no book at all', () => {
    expect(pruneLog(undefined as unknown as Record<string, string>, NOW)).toEqual({});
  });
});

describe('the book through a save and a load', () => {
  it('comes back as it went in', () => {
    const s = memory();
    const data: Schema = { ...emptySchema(), log: { '2026-09-22': 'the fog never lifted' } };
    save(data, NOW, s);
    expect(load(s).data.log).toEqual({ '2026-09-22': 'the fog never lifted' });
  });

  /**
   * A store written before the book existed has no `log`, and every reader
   * expects a map — the same repair `notes` and `running` already get.
   */
  it('repairs a store written before the book existed', () => {
    const s = memory();
    const { log: _drop, ...old } = emptySchema();
    s.setItem('nightwatch:v1', JSON.stringify(old));
    expect(load(s).data.log).toEqual({});
  });

  /** An array and a null both pass `typeof === 'object'`; neither is a book. */
  it('refuses a book that is not one', () => {
    for (const bad of [null, [], 'text', 42]) {
      const s = memory();
      s.setItem('nightwatch:v1', JSON.stringify({ ...emptySchema(), log: bad }));
      expect(load(s).data.log).toEqual({});
    }
  });

  it('drops entries that are not text', () => {
    const s = memory();
    s.setItem('nightwatch:v1', JSON.stringify({
      ...emptySchema(), log: { a: 'kept', b: 7, c: null, d: '' },
    }));
    expect(load(s).data.log).toEqual({ a: 'kept' });
  });
});

describe('the book through export and import', () => {
  const carry = (mine: Schema, theirs: Schema) =>
    fromTransfer(JSON.stringify(toTransfer(theirs)), mine);

  it('takes a night the reader has nothing for', () => {
    const r = carry(emptySchema(), { ...emptySchema(), log: { '2026-09-01': 'theirs' } });
    expect(r.ok && r.data.log).toEqual({ '2026-09-01': 'theirs' });
  });

  it('keeps a night the reader already wrote and they did not', () => {
    const r = carry({ ...emptySchema(), log: { '2026-09-01': 'mine' } }, emptySchema());
    expect(r.ok && r.data.log).toEqual({ '2026-09-01': 'mine' });
  });

  /**
   * Free text is the one thing here that cannot be merged honestly. Longer
   * wins because it is IDEMPOTENT — the rule has a cost, and stability under
   * repeated import is what it buys.
   */
  it('keeps the longer entry when both wrote the same night', () => {
    const mine = { ...emptySchema(), log: { n: 'short' } };
    const theirs = { ...emptySchema(), log: { n: 'a considerably longer account' } };
    // Both directions: the rule has to be symmetric or two machines importing
    // from each other would ping-pong the same night between two texts.
    const a = carry(mine, theirs);
    const b = carry(theirs, mine);
    expect(a.ok && a.data.log.n).toBe('a considerably longer account');
    expect(b.ok && b.data.log.n).toBe('a considerably longer account');
  });

  it('settles rather than growing when the same file is imported twice', () => {
    const theirs = { ...emptySchema(), log: { n: 'an account of the night' } };
    const once = carry(emptySchema(), theirs);
    expect(once.ok).toBe(true);
    const twice = once.ok ? carry(once.data, theirs) : null;
    expect(twice?.ok && twice.data.log).toEqual({ n: 'an account of the night' });
  });
});
