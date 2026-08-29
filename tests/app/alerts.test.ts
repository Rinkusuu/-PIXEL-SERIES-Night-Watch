import { describe, expect, it } from 'vitest';
import { titleFor } from '../../src/app/alerts';

describe('titleFor', () => {
  it('puts the clock FIRST', () => {
    // A pinned tab shows about six characters. "Night Watch — 12:0…" is a
    // countdown nobody can read, which defeats the only alert channel that
    // needs no permission at all.
    expect(titleFor('hunt', '12:04', 'menulis')).toMatch(/^12:04/);
    expect(titleFor('respite', '09:12', null)).toMatch(/^09:12/);
  });

  it('names the quarry while hunting, and the rest while resting', () => {
    expect(titleFor('hunt', '12:04', 'menulis')).toContain('menulis');
    expect(titleFor('respite', '09:12', 'menulis')).not.toContain('menulis');
  });

  it('goes back to the plain name when idle', () => {
    expect(titleFor('idle', '50:00', 'menulis')).toBe('Night Watch');
  });
});
