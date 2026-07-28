import { describe, expect, it } from 'vitest';
import { hashString, rand, stream } from '../../src/world/rng';

describe('rand', () => {
  it('is deterministic for a given seed', () => {
    expect(rand(7)).toBe(rand(7));
  });
  it('stays inside [0, 1)', () => {
    for (let i = 0; i < 500; i++) {
      const v = rand(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('gives different values for neighbouring seeds', () => {
    expect(rand(11)).not.toBeCloseTo(rand(12), 3);
  });
});

describe('stream', () => {
  it('replays identically from the same seed', () => {
    const a = stream(42);
    const b = stream(42);
    const left = [a(), a(), a(), a()];
    const right = [b(), b(), b(), b()];
    expect(left).toEqual(right);
  });
  it('advances, so consecutive draws differ', () => {
    const s = stream(3);
    expect(s()).not.toBe(s());
  });
});

describe('hashString', () => {
  it('is stable for the same key', () => {
    expect(hashString('2026-07-28')).toBe(hashString('2026-07-28'));
  });
  it('separates adjacent night keys', () => {
    expect(hashString('2026-07-28')).not.toBe(hashString('2026-07-29'));
  });
  it('returns an unsigned 32-bit integer', () => {
    const h = hashString('anything at all');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});
