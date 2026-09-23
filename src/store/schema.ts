import type { RunningWatch } from '../session/machine';

export const STORAGE_KEY = 'nightwatch:v1';
export const CORRUPT_PREFIX = 'nightwatch:corrupt:';
/** The Ledger needs 7 days, the streak needs the running chain. 90 gives room
    without letting localStorage grow forever. Spec §9. */
export const RETENTION_DAYS = 90;

export type Quarry = {
  id: string;
  name: string;
  minutes: number;
  done: boolean;
  createdAt: number;
  /**
   * How many watches you think this will take. Absent means unestimated, which
   * is most of them and has to stay the cheap default — a list that demands a
   * number before it will hold a task is a list you stop using.
   *
   * WATCHES, not minutes, because that is the unit the work is actually done
   * in: you do not plan "ninety minutes", you plan "two watches". The minutes
   * it becomes depend on `huntMinutes`, which is a setting and may change, so
   * the conversion is done at the moment of display and never stored.
   */
  estimate?: number;
};

/** Nobody plans past this honestly, and the row has room for one digit. */
export const ESTIMATE_MAX = 9;

/** 0 clears the estimate; anything else is clamped into range. */
export function clampEstimate(v: number): number | undefined {
  if (!Number.isFinite(v) || v <= 0) return undefined;
  return Math.min(ESTIMATE_MAX, Math.round(v));
}

export type SessionRecord = {
  startedAt: number;
  minutes: number;
  quarryId: string | null;
};

/**
 * How the end of a phase announces itself.
 *
 * All three default ON except `notify`, which cannot: the Notification API
 * needs a permission prompt, and a prompt the user never asked for is exactly
 * the kind of thing this app has no server and no account in order to avoid.
 * It turns on when they ask for it, and asks for permission at that moment.
 */
export type Alerts = {
  /** Countdown in the tab title. The one that works with no permission at all. */
  title: boolean;
  /** A soft two-note chime at dawn, via WebAudio. No asset, no network. */
  chime: boolean;
  /** Browser notification. Off until granted. */
  notify: boolean;
};

export type Settings = {
  huntMinutes: number;
  respiteMinutes: number;
  motion: 'auto' | 'on' | 'off';
  alerts: Alerts;
  /**
   * The river, the rain, the wind and the hour bell.
   *
   * OFF by default, and it has to be. A page that starts playing at you is a
   * hostile page — and unlike the chime, which speaks once when something has
   * happened, this runs for the whole watch. It is the one setting here that
   * changes the room you are sitting in.
   */
  ambience: boolean;
  /**
   * How loud, 0..1.
   *
   * The one place this app carries a slider rather than a switch. Everything
   * else is a decision the design can make for you; how loud a thing should be
   * in YOUR room, with your speakers, at your hour of the night, is not.
   */
  ambienceVolume: number;
};

/** Bounds for the two durations. A zero-minute hunt is not a short session. */
export const HUNT_RANGE = { min: 5, max: 120 } as const;
export const RESPITE_RANGE = { min: 1, max: 60 } as const;

export function clampMinutes(v: number, r: { min: number; max: number }): number {
  if (!Number.isFinite(v)) return r.min;
  return Math.min(r.max, Math.max(r.min, Math.round(v)));
}

export type Schema = {
  version: 1;
  quarry: Quarry[];
  sessions: SessionRecord[];
  settings: Settings;
  /** Ids from `session/notes.ts`. What the watch has seen, in the order seen. */
  notes: string[];
  /**
   * The night book: one entry per night, keyed by `nightKey`.
   *
   * Not a task list — `quarry` is that, and it is a list of things you mean to
   * do. This is what actually happened: what stuck, what did not, what you
   * would tell yourself tomorrow. The ledger could say a night was fifty
   * minutes long and never why they were hard.
   *
   * A map rather than a list, because a night has exactly one entry and the
   * key you look it up by is the key everything else here is already sorted
   * on. Empty nights are absent rather than stored as `''`.
   */
  log: Record<string, string>;
  /**
   * The watch that was running when the tab last went away, or null.
   *
   * Everything else here is a record of what already happened; this is the one
   * field describing something still in progress. It exists because the running
   * session lived in React state alone, so a reload dropped it AND the minutes
   * it had earned. See `resume()` in `session/machine.ts`.
   */
  running: RunningWatch | null;
};

export function emptySchema(): Schema {
  return {
    version: 1,
    quarry: [],
    sessions: [],
    notes: [],
    log: {},
    running: null,
    settings: {
      huntMinutes: 50,
      respiteMinutes: 10,
      motion: 'auto',
      alerts: { title: true, chime: true, notify: false },
      ambience: false,
      ambienceVolume: 0.5,
    },
  };
}
