import { describe, expect, it } from 'vitest';
import { fuzzy } from '../../src/app/fuzzy';

const best = (q: string, xs: string[]) =>
  xs.map((h) => ({ h, s: fuzzy(q, h) }))
    .filter((r) => r.s >= 0)
    .sort((a, b) => b.s - a.s)[0]?.h;

describe('fuzzy', () => {
  it('matches letters out of contact, which is the whole point', () => {
    // `includes` would fail this, and then you have to type the label exactly —
    // which is the thing a palette exists to avoid.
    expect(fuzzy('lwt', 'lewati sesi')).toBeGreaterThan(0);
    expect(fuzzy('pjg', 'panjang jaga')).toBeGreaterThan(0);
  });

  it('refuses when a letter is simply absent', () => {
    expect(fuzzy('zz', 'mulai jaga')).toBe(-1);
  });

  it('ranks word initials above the same letters caught mid-word', () => {
    // This is what makes an acronym find the thing it is an acronym of. The
    // first candidate has both letters starting a word; the second has one
    // buried inside "lampu", so it scores one boundary bonus instead of two.
    expect(best('mj', ['mulai jaga', 'lampu jangan'])).toBe('mulai jaga');
  });

  it('prefers a run of letters over the same letters spread out', () => {
    expect(fuzzy('jaga', 'jaga')).toBeGreaterThan(fuzzy('jaga', 'j a g a'));
  });

  it('rewards the start of a word', () => {
    expect(fuzzy('m', 'mulai')).toBeGreaterThan(fuzzy('m', 'lampu'));
  });

  it('breaks ties toward the shorter label', () => {
    expect(fuzzy('zen', 'zen')).toBeGreaterThan(fuzzy('zen', 'zen mode, hide everything'));
  });

  it('treats a space in the query as a separator, not a character', () => {
    // "set dur" should find "atur durasi" even though the space is not in it.
    expect(fuzzy('atur dur', 'atur durasi jaga')).toBeGreaterThan(0);
  });

  it('matches everything on an empty query', () => {
    expect(fuzzy('', 'anything at all')).toBe(0);
    expect(fuzzy('   ', 'anything at all')).toBe(0);
  });

  it('is case-insensitive in both directions', () => {
    expect(fuzzy('MULAI', 'mulai')).toBeGreaterThan(0);
    expect(fuzzy('mulai', 'MULAI')).toBeGreaterThan(0);
  });
});
