import { describe, expect, it } from 'vitest';
import { motionLabel, motionValue, nextMotion } from '../../src/app/motion';

describe('nextMotion', () => {
  it('cycles auto -> on -> off -> auto', () => {
    expect(nextMotion('auto')).toBe('on');
    expect(nextMotion('on')).toBe('off');
    expect(nextMotion('off')).toBe('auto');
  });
});

describe('motionValue', () => {
  it('follows the OS preference on auto', () => {
    expect(motionValue('auto', true)).toBe(0);
    expect(motionValue('auto', false)).toBe(1);
  });

  it('overrides the OS preference in BOTH directions', () => {
    // A bare media query cannot be cancelled by the user. DNA §4.
    expect(motionValue('on', true)).toBe(1);
    expect(motionValue('off', false)).toBe(0);
  });
});

describe('motionLabel', () => {
  it('has a distinct uppercase label per setting', () => {
    const labels = (['auto', 'on', 'off'] as const).map(motionLabel);
    expect(new Set(labels).size).toBe(3);
    for (const l of labels) expect(l).toBe(l.toUpperCase());
  });
});
