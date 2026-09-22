import { describe, expect, it } from 'vitest';
import {
  elapsedMs, initialState, isHeld, progressOf, reduce, remainingMs, resume, runningOf,
} from '../../src/session/machine';

const MIN = 60_000;
const T0 = 1_700_000_000_000;
const base = initialState(50, 10);
const hunting = (startedAt = T0) => reduce(base, { type: 'start', at: startedAt }).state;

describe('holding a watch', () => {
  it('stops the clock where it was held, however long you are away', () => {
    const s = hunting();
    const held = reduce(s, { type: 'pause', at: T0 + 12 * MIN }).state;
    // Two hours pass in the world. None of them pass in the watch.
    expect(elapsedMs(held, T0 + 132 * MIN)).toBe(12 * MIN);
    expect(remainingMs(held, T0 + 132 * MIN)).toBe(38 * MIN);
  });

  it('gives back exactly what was left when the hold is lifted', () => {
    let s = hunting();
    s = reduce(s, { type: 'pause', at: T0 + 12 * MIN }).state;
    s = reduce(s, { type: 'unpause', at: T0 + 47 * MIN }).state;
    // 35 minutes were held, so 12 minutes of watch have been kept.
    expect(elapsedMs(s, T0 + 47 * MIN)).toBe(12 * MIN);
    expect(remainingMs(s, T0 + 50 * MIN)).toBe(35 * MIN);
  });

  it('accumulates across several holds', () => {
    let s = hunting();
    for (const [at, until] of [[5, 15], [20, 40], [45, 50]] as const) {
      s = reduce(s, { type: 'pause', at: T0 + at * MIN }).state;
      s = reduce(s, { type: 'unpause', at: T0 + until * MIN }).state;
    }
    // Held for 10 + 20 + 5 = 35 minutes, so at T0+50 only 15 have been watched.
    expect(elapsedMs(s, T0 + 50 * MIN)).toBe(15 * MIN);
  });

  /**
   * The bug this rules out: a second `pause` overwriting `pausedAt` would throw
   * away the first hold's origin, and every minute held so far would silently
   * be counted as watched.
   */
  it('ignores a second hold rather than losing the first', () => {
    let s = hunting();
    s = reduce(s, { type: 'pause', at: T0 + 10 * MIN }).state;
    s = reduce(s, { type: 'pause', at: T0 + 30 * MIN }).state;
    s = reduce(s, { type: 'unpause', at: T0 + 40 * MIN }).state;
    expect(elapsedMs(s, T0 + 40 * MIN)).toBe(10 * MIN);
  });

  it('ignores a lift when nothing is held', () => {
    const s = reduce(hunting(), { type: 'unpause', at: T0 + 5 * MIN }).state;
    expect(elapsedMs(s, T0 + 5 * MIN)).toBe(5 * MIN);
  });

  it('has nothing to hold while idle', () => {
    expect(isHeld(reduce(base, { type: 'pause', at: T0 }).state)).toBe(false);
  });

  /** The sky is driven by the same elapsed clock, so it holds too. */
  it('freezes the night with the clock', () => {
    const s = reduce(hunting(), { type: 'pause', at: T0 + 25 * MIN }).state;
    expect(progressOf(s, T0 + 25 * MIN)).toBeCloseTo(0.5);
    expect(progressOf(s, T0 + 200 * MIN)).toBeCloseTo(0.5);
  });

  it('records only the minutes actually watched', () => {
    let s = hunting();
    s = reduce(s, { type: 'pause', at: T0 + 20 * MIN }).state;
    s = reduce(s, { type: 'unpause', at: T0 + 80 * MIN }).state;
    const { completed } = reduce(s, { type: 'stop', at: T0 + 85 * MIN });
    expect(completed?.minutes).toBe(25);
  });

  it('starts every watch unheld, whatever the last one ended as', () => {
    let s = reduce(hunting(), { type: 'pause', at: T0 + 5 * MIN }).state;
    s = reduce(s, { type: 'stop', at: T0 + 5 * MIN }).state;
    s = reduce(s, { type: 'start', at: T0 + 100 * MIN }).state;
    expect(isHeld(s)).toBe(false);
    expect(elapsedMs(s, T0 + 110 * MIN)).toBe(10 * MIN);
  });

  it('does not let a tick end a phase that is held', () => {
    const s = reduce(hunting(), { type: 'pause', at: T0 + 1 * MIN }).state;
    const { state, completed } = reduce(s, { type: 'tick', at: T0 + 500 * MIN });
    expect(state.phase).toBe('hunt');
    expect(completed).toBeNull();
  });
});

describe('the toggle', () => {
  /**
   * Found in the browser, not here: the decision used to live in a
   * `useCallback` that did not depend on the session, so it read `pausedAt`
   * from the render that created it — `null`, forever — and dispatched `pause`
   * every time. The button held the watch and then refused to lift it. The
   * reducer is the only party that cannot be stale about this.
   */
  it('holds a running watch and lifts a held one', () => {
    let s = hunting();
    s = reduce(s, { type: 'toggleHold', at: T0 + 5 * MIN }).state;
    expect(isHeld(s)).toBe(true);
    s = reduce(s, { type: 'toggleHold', at: T0 + 25 * MIN }).state;
    expect(isHeld(s)).toBe(false);
    expect(elapsedMs(s, T0 + 25 * MIN)).toBe(5 * MIN);
  });

  it('does nothing at all while idle', () => {
    const s = reduce(base, { type: 'toggleHold', at: T0 }).state;
    expect(s).toEqual(base);
  });
});

describe('a held watch across a reload', () => {
  it('comes back still held, with the same time left', () => {
    const s = reduce(hunting(), { type: 'pause', at: T0 + 12 * MIN }).state;
    const running = runningOf(s);
    // A week away. It is still where it was left.
    const { state, completed } = resume(base, running, T0 + 7 * 24 * 60 * MIN);
    expect(isHeld(state)).toBe(true);
    expect(remainingMs(state, T0 + 7 * 24 * 60 * MIN)).toBe(38 * MIN);
    expect(completed).toBeNull();
  });

  /**
   * The second browser-only bug: `runningOf` carried the hold, but the effect
   * that WRITES it compared only phase, start and quarry, so holding changed
   * nothing the store could see. A refresh then cashed the whole pause in as
   * watched time. This checks the value that has to reach the store.
   */
  it('carries the hold into what gets saved', () => {
    const s = reduce(hunting(), { type: 'pause', at: T0 + 12 * MIN }).state;
    expect(runningOf(s)).toMatchObject({ pausedAt: T0 + 12 * MIN, pausedMs: 0 });
    const lifted = reduce(s, { type: 'unpause', at: T0 + 20 * MIN }).state;
    expect(runningOf(lifted)).toMatchObject({ pausedAt: null, pausedMs: 8 * MIN });
  });

  /** A store written before holding existed has neither field. */
  it('reads a watch saved before holding existed', () => {
    const { state } = resume(
      base, { phase: 'hunt', startedAt: T0, quarryId: null }, T0 + 5 * MIN,
    );
    expect(isHeld(state)).toBe(false);
    expect(remainingMs(state, T0 + 5 * MIN)).toBe(45 * MIN);
  });
});
