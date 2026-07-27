import { describe, expect, it } from 'vitest';
import { splitDigits } from '../../src/components/Digit';

describe('splitDigits', () => {
  it('splits a clock into individually addressable characters', () => {
    expect(splitDigits('02:41')).toEqual(['0', '2', ':', '4', '1']);
  });

  it('handles an empty string', () => {
    expect(splitDigits('')).toEqual([]);
  });
});
