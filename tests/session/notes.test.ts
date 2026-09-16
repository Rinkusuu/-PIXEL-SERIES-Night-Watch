import { describe, expect, it } from 'vitest';
import { NOTES, noteText, notesForWatch, record } from '../../src/session/notes';

const base = {
  minutes: 50, completed: true, weather: 'clear' as const, streak: 1, totalSessions: 5,
};

describe('the watch keeps a logbook, not a trophy case', () => {
  it('never congratulates and never exclaims', () => {
    // `copy.ts` states the voice: it observes, it never encourages. A note that
    // says "well done" is a different app.
    for (const n of NOTES) {
      expect(n.text, n.id).not.toContain('!');
      expect(n.text, n.id).toBe(n.text.toLowerCase());
      for (const word of ['selamat', 'hebat', 'bagus', 'keren', 'mantap']) {
        expect(n.text.includes(word), `${n.id} congratulates`).toBe(false);
      }
    }
  });

  it('gives every note a unique id', () => {
    expect(new Set(NOTES.map((n) => n.id)).size).toBe(NOTES.length);
  });
});

describe('notesForWatch', () => {
  it('marks the first night only once', () => {
    expect(notesForWatch({ ...base, totalSessions: 1 })).toContain('first');
    expect(notesForWatch({ ...base, totalSessions: 2 })).not.toContain('first');
  });

  it('separates a watch kept from a watch stopped', () => {
    // This is the one distinction the two completion paths disagree on, so it
    // is the one worth pinning.
    expect(notesForWatch({ ...base, completed: true })).toContain('kept');
    expect(notesForWatch({ ...base, completed: false })).not.toContain('kept');
  });

  it('gives exactly one weather note per night', () => {
    for (const w of ['clear', 'fog', 'rain', 'fullmoon'] as const) {
      const weather = notesForWatch({ ...base, weather: w })
        .filter((id) => ['clear', 'fog', 'rain', 'fullmoon'].includes(id));
      expect(weather, w).toHaveLength(1);
    }
  });

  it('does not claim a clear night on a full moon', () => {
    // A full moon IS a clear night, so without the split it would take both.
    expect(notesForWatch({ ...base, weather: 'fullmoon' })).not.toContain('clear');
  });

  it('earns the longer streak note only past its own threshold', () => {
    expect(notesForWatch({ ...base, streak: 6 })).not.toContain('week');
    expect(notesForWatch({ ...base, streak: 7 })).toContain('week');
    expect(notesForWatch({ ...base, streak: 7 })).not.toContain('fortnight');
    expect(notesForWatch({ ...base, streak: 14 })).toContain('fortnight');
  });
});

describe('record', () => {
  it('never repeats a note and keeps the order they were seen in', () => {
    const a = record([], ['first', 'kept']);
    const b = record(a, ['kept', 'fog']);
    expect(b).toEqual(['first', 'kept', 'fog']);
  });

  it('drops an id that is not a note, so a stale store cannot inject one', () => {
    expect(record([], ['first', 'nonsense'])).toEqual(['first']);
  });

  it('returns a list of the same length when nothing is new', () => {
    // The action relies on this to avoid a pointless write to localStorage.
    const a = record([], ['first']);
    expect(record(a, ['first'])).toHaveLength(a.length);
  });
});

describe('noteText', () => {
  it('resolves a known id and refuses an unknown one', () => {
    expect(noteText('first')).toBeTypeOf('string');
    expect(noteText('nope')).toBeUndefined();
  });
});
