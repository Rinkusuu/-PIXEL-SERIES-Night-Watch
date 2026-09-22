import type { SessionRecord } from '../store/schema';

export type Phase = 'idle' | 'hunt' | 'respite';

export type SessionState = {
  phase: Phase;
  /** wall-clock ms when the current phase began; null when idle */
  startedAt: number | null;
  huntMs: number;
  respiteMs: number;
  quarryId: string | null;
  /** progress held during respite so the sky does not rewind. Spec §4.1 */
  frozenProgress: number;
};

export type SessionEvent =
  | { type: 'start'; at: number }
  | { type: 'stop'; at: number }
  | { type: 'skip'; at: number }
  | { type: 'tick'; at: number }
  | { type: 'setDurations'; huntMinutes: number; respiteMinutes: number; at: number }
  | { type: 'selectQuarry'; quarryId: string | null };

const MIN = 60_000;

/**
 * A watch caught mid-flight, as it goes to the store.
 *
 * The state above lives in React and nowhere else, so a reload dropped it and
 * the minutes went with it — measured: forty minutes of work, one refresh, no
 * record anywhere. For an app whose only job is to count and record time that
 * is the worst failure available to it.
 *
 * Only what cannot be recomputed is kept. The durations come back from
 * settings; `frozenProgress` is derivable from the phase.
 */
export type RunningWatch = {
  phase: 'hunt' | 'respite';
  startedAt: number;
  quarryId: string | null;
};

export function runningOf(s: SessionState): RunningWatch | null {
  if (s.phase === 'idle' || s.startedAt === null) return null;
  return { phase: s.phase, startedAt: s.startedAt, quarryId: s.quarryId };
}

/**
 * Pick up a watch that was running when the tab went away.
 *
 * The clock is wall-clock throughout — `elapsedMs` reads timestamps rather than
 * accumulating ticks, precisely so a sleeping laptop leaves it correct — so the
 * only question is whether the phase is still running or has already run out.
 *
 * If it has, the watch is recorded in FULL and the app goes quiet. The time
 * genuinely passed; the app was simply not on screen to watch it, and a timer
 * that refuses to count an hour because nobody was looking at it is a timer
 * that punishes you for closing a tab.
 */
export function resume(
  base: SessionState, running: RunningWatch | null, now: number,
): { state: SessionState; completed: SessionRecord | null } {
  if (!running) return { state: base, completed: null };

  const state: SessionState = {
    ...base,
    phase: running.phase,
    startedAt: running.startedAt,
    quarryId: running.quarryId,
    frozenProgress: running.phase === 'respite' ? 1 : 0,
  };

  // Still inside its own phase: hand it straight back, clock and all.
  if (remainingMs(state, now) > 0) return { state, completed: null };

  // The phase ran out while nobody was here. Run the machine's own tick over
  // it rather than reimplementing what a finished phase does — that is the
  // function that decides what a completed hunt records, and a second copy of
  // that decision is a second thing to get wrong.
  const ended = reduce(state, { type: 'tick', at: running.startedAt + phaseLength(state) });
  return {
    // A respite that ended, and a hunt whose respite would also have ended,
    // both land the same way: idle, with the night's progress released.
    state: { ...base, quarryId: running.quarryId },
    completed: ended.completed,
  };
}

/** How long the phase currently running is meant to last. */
function phaseLength(s: SessionState): number {
  return s.phase === 'respite' ? s.respiteMs : s.huntMs;
}

export function initialState(huntMinutes: number, respiteMinutes: number): SessionState {
  return {
    phase: 'idle',
    startedAt: null,
    huntMs: huntMinutes * MIN,
    respiteMs: respiteMinutes * MIN,
    quarryId: null,
    frozenProgress: 0,
  };
}

/**
 * Derived from timestamps, never accumulated from ticks. A backgrounded tab, a
 * sleeping laptop and a dropped frame all leave this correct. Spec §10.
 */
export function elapsedMs(state: SessionState, now: number): number {
  if (state.startedAt === null) return 0;
  return Math.max(0, now - state.startedAt);
}

/**
 * Milliseconds left in whatever phase is actually running.
 *
 * It lives HERE, beside the state it reads, because `useNightWatch` used to
 * compute it inline as `huntMs - elapsed` for every phase — including respite,
 * where `startedAt` has been reset to the start of the BREAK. A ten-minute
 * respite therefore displayed a fifty-minute countdown that stopped at 40:06
 * and vanished, so the rest had no clock at all. Whichever phase is running
 * owns the duration the clock counts against; one function, one answer.
 */
export function remainingMs(state: SessionState, now: number): number {
  if (state.phase === 'idle') return state.huntMs;
  const target = state.phase === 'respite' ? state.respiteMs : state.huntMs;
  return Math.max(0, target - elapsedMs(state, now));
}

export function progressOf(state: SessionState, now: number): number {
  if (state.phase === 'idle') return 0;
  if (state.phase === 'respite') return state.frozenProgress;
  if (state.huntMs <= 0) return 1;
  return Math.min(1, elapsedMs(state, now) / state.huntMs);
}

function record(state: SessionState, now: number): SessionRecord | null {
  const minutes = Math.floor(elapsedMs(state, now) / MIN);
  if (minutes < 1 || state.startedAt === null) return null;
  return { startedAt: state.startedAt, minutes, quarryId: state.quarryId };
}

export function reduce(
  state: SessionState,
  ev: SessionEvent,
): { state: SessionState; completed: SessionRecord | null } {
  switch (ev.type) {
    case 'start':
      if (state.phase === 'hunt') return { state, completed: null };
      return {
        state: { ...state, phase: 'hunt', startedAt: ev.at, frozenProgress: 0 },
        completed: null,
      };

    case 'stop': {
      if (state.phase !== 'hunt') {
        return { state: { ...state, phase: 'idle', startedAt: null }, completed: null };
      }
      return {
        state: { ...state, phase: 'idle', startedAt: null, frozenProgress: 0 },
        completed: record(state, ev.at),
      };
    }

    case 'skip':
      return {
        state: { ...state, phase: 'idle', startedAt: null, frozenProgress: 0 },
        completed: null,
      };

    case 'tick': {
      if (state.phase === 'hunt' && elapsedMs(state, ev.at) >= state.huntMs) {
        const completed: SessionRecord | null = state.startedAt === null ? null : {
          startedAt: state.startedAt,
          minutes: Math.round(state.huntMs / MIN),
          quarryId: state.quarryId,
        };
        return {
          state: { ...state, phase: 'respite', startedAt: ev.at, frozenProgress: 1 },
          completed,
        };
      }
      if (state.phase === 'respite' && elapsedMs(state, ev.at) >= state.respiteMs) {
        return {
          state: { ...state, phase: 'idle', startedAt: null, frozenProgress: 0 },
          completed: null,
        };
      }
      return { state, completed: null };
    }

    case 'setDurations':
      // startedAt is untouched: the hunt keeps its origin, only the target moves.
      return {
        state: {
          ...state,
          huntMs: ev.huntMinutes * MIN,
          respiteMs: ev.respiteMinutes * MIN,
        },
        completed: null,
      };

    case 'selectQuarry':
      return { state: { ...state, quarryId: ev.quarryId }, completed: null };
  }
}
