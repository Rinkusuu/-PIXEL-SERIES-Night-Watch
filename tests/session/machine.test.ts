import { describe, expect, it } from 'vitest';
import {
  elapsedMs, initialState, progressOf, reduce,
  type SessionState,
} from '../../src/session/machine';

const T0 = 1_700_000_000_000;
const MIN = 60_000;
const fresh = (): SessionState => initialState(50, 10);

const start = (at = T0) => reduce(fresh(), { type: 'start', at }).state;

describe('idle', () => {
  it('starts at zero progress and stays there', () => {
    const s = fresh();
    expect(s.phase).toBe('idle');
    expect(progressOf(s, T0 + 99 * MIN)).toBe(0);
  });

  it('ignores a stop it never started', () => {
    const { state, completed } = reduce(fresh(), { type: 'stop', at: T0 });
    expect(state.phase).toBe('idle');
    expect(completed).toBeNull();
  });
});

describe('hunt', () => {
  it('advances with wall-clock time, not with tick count', () => {
    const s = start();
    expect(elapsedMs(s, T0 + 25 * MIN)).toBe(25 * MIN);
    expect(progressOf(s, T0 + 25 * MIN)).toBeCloseTo(0.5, 5);
  });

  it('a tick before the end changes nothing', () => {
    const { state, completed } = reduce(start(), { type: 'tick', at: T0 + 10 * MIN });
    expect(state.phase).toBe('hunt');
    expect(completed).toBeNull();
  });

  it('completes into respite and emits the record', () => {
    const s = reduce(start(), { type: 'selectQuarry', quarryId: 'q1' }).state;
    const { state, completed } = reduce(s, { type: 'tick', at: T0 + 50 * MIN });
    expect(state.phase).toBe('respite');
    expect(completed).toEqual({ startedAt: T0, minutes: 50, quarryId: 'q1' });
  });

  it('completes exactly once even after a long background gap', () => {
    const first = reduce(start(), { type: 'tick', at: T0 + 400 * MIN });
    expect(first.completed).not.toBeNull();
    expect(first.state.phase).toBe('respite');
    const second = reduce(first.state, { type: 'tick', at: T0 + 401 * MIN });
    expect(second.completed).toBeNull();
  });

  it('never reports progress above 1', () => {
    expect(progressOf(start(), T0 + 900 * MIN)).toBe(1);
  });

  it('stop records the partial minutes and returns to idle', () => {
    const { state, completed } = reduce(start(), { type: 'stop', at: T0 + 12.7 * MIN });
    expect(state.phase).toBe('idle');
    expect(completed).toEqual({ startedAt: T0, minutes: 12, quarryId: null });
  });

  it('stop under one minute records nothing', () => {
    const { completed } = reduce(start(), { type: 'stop', at: T0 + 30_000 });
    expect(completed).toBeNull();
  });
});

describe('respite', () => {
  it('freezes progress instead of rewinding the sky', () => {
    const done = reduce(start(), { type: 'tick', at: T0 + 50 * MIN }).state;
    expect(progressOf(done, T0 + 55 * MIN)).toBe(1);
    expect(done.frozenProgress).toBe(1);
  });

  it('returns to idle when the respite runs out', () => {
    const done = reduce(start(), { type: 'tick', at: T0 + 50 * MIN }).state;
    const { state } = reduce(done, { type: 'tick', at: T0 + 61 * MIN });
    expect(state.phase).toBe('idle');
  });
});

describe('skip', () => {
  it('leaves a hunt without recording anything', () => {
    const { state, completed } = reduce(start(), { type: 'skip', at: T0 + 20 * MIN });
    expect(state.phase).toBe('idle');
    expect(completed).toBeNull();
  });

  it('ends a respite early', () => {
    const done = reduce(start(), { type: 'tick', at: T0 + 50 * MIN }).state;
    expect(reduce(done, { type: 'skip', at: T0 + 51 * MIN }).state.phase).toBe('idle');
  });
});

describe('changing duration mid-hunt', () => {
  it('recomputes progress against the new duration', () => {
    const s = start();
    expect(progressOf(s, T0 + 25 * MIN)).toBeCloseTo(0.5, 5);
    const { state } = reduce(s, { type: 'setDurations', huntMinutes: 25, respiteMinutes: 5, at: T0 + 10 * MIN });
    expect(progressOf(state, T0 + 20 * MIN)).toBeCloseTo(0.8, 5);
    expect(state.startedAt).toBe(T0);
  });

  it('completes immediately if the new duration is already exceeded', () => {
    const s = start();
    const shortened = reduce(s, { type: 'setDurations', huntMinutes: 5, respiteMinutes: 5, at: T0 + 20 * MIN });
    expect(progressOf(shortened.state, T0 + 20 * MIN)).toBe(1);
    const { state, completed } = reduce(shortened.state, { type: 'tick', at: T0 + 20 * MIN });
    expect(state.phase).toBe('respite');
    expect(completed!.minutes).toBe(5);
  });
});
