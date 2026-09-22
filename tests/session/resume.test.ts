import { describe, expect, it } from 'vitest';
import { initialState, remainingMs, resume, runningOf } from '../../src/session/machine';

const MIN = 60_000;
const T0 = 1_700_000_000_000;
const base = initialState(50, 10);

describe('runningOf', () => {
  it('reports nothing while idle — there is no watch to save', () => {
    expect(runningOf(base)).toBeNull();
  });

  it('keeps only what cannot be recomputed', () => {
    const s = { ...base, phase: 'hunt' as const, startedAt: T0, quarryId: 'q1' };
    expect(runningOf(s)).toEqual({
      phase: 'hunt', startedAt: T0, quarryId: 'q1', pausedMs: 0, pausedAt: null,
    });
  });
});

describe('resume', () => {
  it('does nothing when there was no watch running', () => {
    const { state, completed } = resume(base, null, T0);
    expect(state).toEqual(base);
    expect(completed).toBeNull();
  });

  it('hands back a watch still inside its phase, clock and all', () => {
    // This is the case the whole feature exists for: a refresh twenty minutes
    // into a fifty-minute hunt used to drop the hunt AND the twenty minutes.
    const { state, completed } = resume(
      base, { phase: 'hunt', startedAt: T0, quarryId: 'q1' }, T0 + 20 * MIN,
    );
    expect(state.phase).toBe('hunt');
    expect(state.startedAt).toBe(T0);
    expect(state.quarryId).toBe('q1');
    expect(remainingMs(state, T0 + 20 * MIN)).toBe(30 * MIN);
    expect(completed).toBeNull();
  });

  it('records a hunt that ran out while the tab was gone, in full', () => {
    // Closed at minute 20, reopened three hours later. The time passed; the app
    // was simply not on screen. A timer that refuses to count an hour because
    // nobody was looking at it punishes you for closing a tab.
    const { state, completed } = resume(
      base, { phase: 'hunt', startedAt: T0, quarryId: 'q1' }, T0 + 3 * 60 * MIN,
    );
    expect(completed).not.toBeNull();
    expect(completed!.minutes).toBe(50);
    expect(completed!.startedAt).toBe(T0);
    expect(completed!.quarryId).toBe('q1');
    expect(state.phase).toBe('idle');
    expect(state.startedAt).toBeNull();
  });

  it('keeps the quarry selected after a watch is recovered and closed', () => {
    // You came back to the same task. Making you pick it again is a small
    // insult on top of having lost the tab.
    const { state } = resume(
      base, { phase: 'hunt', startedAt: T0, quarryId: 'q7' }, T0 + 5 * 60 * MIN,
    );
    expect(state.quarryId).toBe('q7');
  });

  it('closes an expired respite without recording anything', () => {
    // A rest is not work. It was already recorded when the hunt before it ended.
    const { state, completed } = resume(
      base, { phase: 'respite', startedAt: T0, quarryId: null }, T0 + 60 * MIN,
    );
    expect(completed).toBeNull();
    expect(state.phase).toBe('idle');
  });

  it('hands back a respite still running, on the respite clock', () => {
    const { state } = resume(
      base, { phase: 'respite', startedAt: T0, quarryId: null }, T0 + 4 * MIN,
    );
    expect(state.phase).toBe('respite');
    expect(remainingMs(state, T0 + 4 * MIN)).toBe(6 * MIN);
    // The sky must not rewind while resting. Spec §4.1.
    expect(state.frozenProgress).toBe(1);
  });

  it('survives a clock that jumped backwards', () => {
    // A machine waking with a corrected system clock can make `now` earlier
    // than `startedAt`. That must not produce a negative watch.
    const { state, completed } = resume(
      base, { phase: 'hunt', startedAt: T0, quarryId: null }, T0 - 60 * MIN,
    );
    expect(completed).toBeNull();
    expect(remainingMs(state, T0 - 60 * MIN)).toBeLessThanOrEqual(50 * MIN);
  });

  it('round-trips: what runningOf saves is what resume restores', () => {
    const live = { ...base, phase: 'hunt' as const, startedAt: T0, quarryId: 'q3' };
    const { state } = resume(base, runningOf(live), T0 + MIN);
    expect(state.phase).toBe(live.phase);
    expect(state.startedAt).toBe(live.startedAt);
    expect(state.quarryId).toBe(live.quarryId);
  });
});
