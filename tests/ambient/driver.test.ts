// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAmbientDriver, writeAmbient } from '../../src/ambient/driver';
import { resolve } from '../../src/ambient/interpolate';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute('style');
});

describe('writeAmbient', () => {
  it('writes all eight roles', () => {
    const root = document.documentElement;
    writeAmbient(root, resolve(NIGHT_KEYS, 0.5, gradesFor(['calm'])));
    for (const role of ['--amb-deep', '--amb-mid', '--amb-lift', '--amb-glow',
                        '--amb-accent', '--amb-ink', '--amb-ink-soft', '--amb-lum']) {
      expect(root.style.getPropertyValue(role)).not.toBe('');
    }
  });
});

describe('startAmbientDriver', () => {
  it('writes once immediately so the first paint is already correct', () => {
    const root = document.createElement('div');
    startAmbientDriver({ read: () => ({ progress: 0, grades: ['calm'] }), root });
    expect(root.style.getPropertyValue('--amb-glow')).not.toBe('');
  });

  it('ticks at 4 Hz', () => {
    const root = document.createElement('div');
    const onValues = vi.fn();
    startAmbientDriver({ read: () => ({ progress: 0, grades: ['calm'] }), root, onValues });
    onValues.mockClear();
    vi.advanceTimersByTime(1000);
    expect(onValues).toHaveBeenCalledTimes(4);
  });

  it('reads fresh state on every tick', () => {
    const root = document.createElement('div');
    let progress = 0;
    startAmbientDriver({ read: () => ({ progress, grades: ['calm'] }), root });
    const first = root.style.getPropertyValue('--amb-deep');
    progress = 1;
    vi.advanceTimersByTime(250);
    expect(root.style.getPropertyValue('--amb-deep')).not.toBe(first);
  });

  it('stops when the returned function is called', () => {
    const root = document.createElement('div');
    const onValues = vi.fn();
    const stop = startAmbientDriver({
      read: () => ({ progress: 0, grades: ['calm'] }), root, onValues,
    });
    stop();
    onValues.mockClear();
    vi.advanceTimersByTime(2000);
    expect(onValues).not.toHaveBeenCalled();
  });
});
