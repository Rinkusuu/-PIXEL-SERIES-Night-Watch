import { describe, expect, it } from 'vitest';
import { fileName, fromTransfer, toTransfer } from '../../src/store/transfer';
import { emptySchema, type Schema } from '../../src/store/schema';

const at = (t: number, minutes = 30, quarryId: string | null = null) =>
  ({ startedAt: t, minutes, quarryId });

function schema(over: Partial<Schema> = {}): Schema {
  return { ...emptySchema(), ...over };
}

describe('toTransfer', () => {
  it('drops a watch that was running when it was exported', () => {
    // A watch in progress on another machine is not in progress here. Importing
    // one would start a clock the reader never began — possibly hours ago,
    // which would then be recorded as work they did not do.
    const t = toTransfer(schema({ running: { phase: 'hunt', startedAt: 1, quarryId: null } }));
    expect(t.data.running).toBeNull();
  });

  it('names the file by the day it was written', () => {
    expect(fileName(new Date(2026, 8, 7, 23, 0).getTime())).toBe('night-watch-2026-09-07.json');
  });
});

describe('fromTransfer', () => {
  const mine = schema({ sessions: [at(100), at(200)], notes: ['first'] });
  const wrap = (data: Partial<Schema>, version = 1) => JSON.stringify({
    kind: 'nightwatch-ledger', version, exportedAt: 0, data: { ...emptySchema(), ...data },
  });

  it('merges rather than replaces — the reader keeps their own nights', () => {
    // Replacing is the obvious behaviour and the wrong one: an import that
    // discards your history is a data loss dressed as a feature.
    const r = fromTransfer(wrap({ sessions: [at(300)] }), mine);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.sessions.map((s) => s.startedAt)).toEqual([100, 200, 300]);
    expect(r.added).toBe(1);
  });

  it('never imports the same night twice', () => {
    // Import the same file again and nothing should move. `startedAt` is a
    // millisecond stamp, so it identifies a session without needing an id.
    const r = fromTransfer(wrap({ sessions: [at(100), at(200)] }), mine);
    expect(r.ok && r.added).toBe(0);
    expect(r.ok && r.data.sessions).toHaveLength(2);
  });

  it('keeps sessions in order however jumbled the file was', () => {
    const r = fromTransfer(wrap({ sessions: [at(400), at(50), at(300)] }), mine);
    expect(r.ok && r.data.sessions.map((s) => s.startedAt)).toEqual([50, 100, 200, 300, 400]);
  });

  it('takes the larger total for a quarry both machines know', () => {
    // Both counted part of the same work. Summing would double whatever had
    // already been synced once.
    const withQ = schema({
      quarry: [{ id: 'q1', name: 'spec', minutes: 100, done: false, createdAt: 0 }],
    });
    const r = fromTransfer(wrap({
      quarry: [{ id: 'q1', name: 'spec', minutes: 60, done: false, createdAt: 0 }],
    }), withQ);
    expect(r.ok && r.data.quarry[0]!.minutes).toBe(100);

    const r2 = fromTransfer(wrap({
      quarry: [{ id: 'q1', name: 'spec', minutes: 400, done: false, createdAt: 0 }],
    }), withQ);
    expect(r2.ok && r2.data.quarry[0]!.minutes).toBe(400);
  });

  it('unions the notes, because a night seen anywhere was seen', () => {
    const r = fromTransfer(wrap({ notes: ['kept', 'first'] }), mine);
    expect(r.ok && [...r.data.notes].sort()).toEqual(['first', 'kept']);
  });

  it("leaves the reader's settings alone", () => {
    // Settings describe this machine — how long you like to work, whether this
    // browser may notify you — not the ledger.
    const r = fromTransfer(wrap({
      settings: { ...emptySchema().settings, huntMinutes: 25, motion: 'off' },
    }), mine);
    expect(r.ok && r.data.settings).toEqual(mine.settings);
  });

  it('never starts a clock on import', () => {
    const r = fromTransfer(wrap({ running: { phase: 'hunt', startedAt: 1, quarryId: null } }), mine);
    expect(r.ok && r.data.running).toBeNull();
  });

  it('refuses a file that is not ours, and says which way it failed', () => {
    expect(fromTransfer('not json at all', mine)).toEqual({ ok: false, reason: 'unreadable' });
    expect(fromTransfer('{"kind":"something-else"}', mine)).toEqual({ ok: false, reason: 'foreign' });
    // Written by a later build. Guessing at a shape we do not know is how an
    // import corrupts a ledger.
    expect(fromTransfer(wrap({}, 99), mine)).toEqual({ ok: false, reason: 'newer' });
  });

  it('survives a file whose arrays are missing or the wrong type', () => {
    const r = fromTransfer(JSON.stringify({
      kind: 'nightwatch-ledger', version: 1, exportedAt: 0,
      data: { sessions: 'nope', quarry: null, notes: 7 },
    }), mine);
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.sessions).toHaveLength(2);
  });

  it('round-trips a ledger through export and import unchanged', () => {
    const full = schema({ sessions: [at(1), at(2)], notes: ['first', 'kept'] });
    const r = fromTransfer(JSON.stringify(toTransfer(full)), emptySchema());
    expect(r.ok && r.data.sessions).toEqual(full.sessions);
    expect(r.ok && [...r.data.notes].sort()).toEqual([...full.notes].sort());
  });
});
