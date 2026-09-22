import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startAmbientDriver } from '../ambient/driver';
import { gradesFor } from '../ambient/grade';
import { resolve } from '../ambient/interpolate';
import { NIGHT_KEYS } from '../ambient/keyframes';
import type { AmbientValues, GradeName } from '../ambient/types';
import {
  initialState, isHeld, progressOf, reduce, remainingMs as remainingOf, resume, runningOf,
  type SessionEvent, type SessionState,
} from '../session/machine';
import {
  bestStreak, minutesByNight, minutesByQuarry, nightGrid, windowTotals,
} from '../session/aggregate';
import { streakLength } from '../session/streak';
import { notesForWatch, record } from '../session/notes';
import { load, save } from '../store/persist';
import { downloadTransfer, fromTransfer } from '../store/transfer';
import { STORAGE_KEY } from '../store/schema';
import { RETENTION_DAYS } from '../store/schema';
import type { Schema } from '../store/schema';
import { motionValue, nextMotion } from './motion';
import { nightKey } from '../session/streak';
import { weatherFor, type Weather } from '../world/weather';
import { announce, requestNotify, titleFor } from './alerts';
import { COPY, formatClock } from './copy';
import { HUNT_RANGE, RESPITE_RANGE, clampMinutes, type Alerts } from '../store/schema';

const BLOODMOON_STREAK = 5;
const PRESSED_MS = 5 * 60_000;

export function useNightWatch() {
  const boot = useMemo(() => load(), []);
  const [data, setData] = useState<Schema>(boot.data);
  /**
   * Boot picks the watch back up where it was left.
   *
   * `resume` is given the store's running watch and the wall clock, and returns
   * either the watch still running or — if its phase ran out while the tab was
   * gone — an idle state plus the record that should have been written. The
   * record is applied in the effect below rather than here: this runs during
   * render, and writing to the store from a `useState` initialiser is a side
   * effect in the wrong place.
   */
  const revived = useMemo(
    () => resume(
      initialState(boot.data.settings.huntMinutes, boot.data.settings.respiteMinutes),
      boot.data.running,
      Date.now(),
    ),
    [boot],
  );
  const [session, setSession] = useState<SessionState>(revived.state);
  const [now, setNow] = useState(() => Date.now());
  const [values, setValues] = useState<AmbientValues>(() =>
    resolve(NIGHT_KEYS, 0, gradesFor(['calm'])),
  );

  const streak = useMemo(() => streakLength(data.sessions, now), [data.sessions, now]);
  const ledger = useMemo(() => minutesByNight(data.sessions, now, 7), [data.sessions, now]);

  // The store has kept RETENTION_DAYS of nights since it was written and the
  // Ledger was reading seven of them. These are the other eighty-three.
  const nightsGrid = useMemo(
    () => nightGrid(data.sessions, now, RETENTION_DAYS), [data.sessions, now],
  );
  const best = useMemo(
    () => bestStreak(data.sessions, now, RETENTION_DAYS), [data.sessions, now],
  );
  const totals = useMemo(
    () => windowTotals(data.sessions, now, RETENTION_DAYS), [data.sessions, now],
  );
  // `minutesByQuarry` has existed since the session module was written and was
  // called from nowhere. Resolved to names here, sorted, so the panel gets a
  // list rather than a map keyed by an id it would have to look up itself.
  const quarryTotals = useMemo(() => {
    const byId = minutesByQuarry(data.sessions);
    return data.quarry
      .map((q) => ({ name: q.name, minutes: byId[q.id] ?? 0 }))
      .filter((q) => q.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
  }, [data.sessions, data.quarry]);

  // The night's weather, drawn once from the same key the streak counts by. It
  // must not change on a re-render, or the sky would reshuffle mid-session.
  const tonight = nightKey(now);
  const weather = useMemo<Weather>(() => weatherFor(tonight), [tonight]);

  const progress = progressOf(session, now);
  const remainingMs = remainingOf(session, now);
  const selectedName = data.quarry.find((q) => q.id === session.quarryId)?.name ?? null;

  // What tonight itself has amounted to so far. The Watch had a clock and four
  // hundred pixels of nothing beside it; these are the facts that were already
  // in the store and were never shown anywhere.
  const tonightStats = useMemo(() => {
    const key = nightKey(now);
    const mine = data.sessions.filter((s) => nightKey(s.startedAt) === key);
    return {
      key,
      count: mine.length,
      minutes: mine.reduce((sum, s) => sum + s.minutes, 0),
      startedAt: session.startedAt,
    };
  }, [data.sessions, now, session.startedAt]);

  const grades = useMemo<GradeName[]>(() => {
    const g: GradeName[] = [];
    if (session.phase === 'hunt' && remainingMs <= PRESSED_MS) g.push('pressed');
    if (streak >= BLOODMOON_STREAK) g.push('bloodmoon');
    return g.length === 0 ? ['calm'] : g;
  }, [session.phase, remainingMs, streak]);

  // Read by the heartbeat below, which is mounted once and would otherwise
  // close over the settings as they were at boot.
  // Read inside the heartbeat, which is mounted once and would otherwise close
  // over tonight's weather as it was at boot.
  const weatherRef = useRef<Weather>(weather);
  weatherRef.current = weather;

  const alertsRef = useRef<Alerts>(data.settings.alerts);
  alertsRef.current = data.settings.alerts;

  /**
   * The watch that finished while nobody was here, written down once.
   *
   * It has to run after mount, and it has to be guarded: React mounts effects
   * twice in development's strict mode, and a watch recorded twice is an hour
   * that never happened.
   */
  const revivedApplied = useRef(false);
  useEffect(() => {
    if (revivedApplied.current) return;
    revivedApplied.current = true;
    const done = revived.completed;
    setData((d) => {
      const sessions = done ? [...d.sessions, done] : d.sessions;
      const next: Schema = {
        ...d,
        sessions,
        running: runningOf(revived.state),
        ...(done ? {
          notes: record(d.notes, notesForWatch({
            minutes: done.minutes,
            completed: true,
            weather: weatherFor(nightKey(done.startedAt)),
            streak: streakLength(sessions, Date.now()),
            totalSessions: sessions.length,
          })),
          quarry: d.quarry.map((q) =>
            q.id === done.quarryId ? { ...q, minutes: q.minutes + done.minutes } : q),
        } : {}),
      };
      save(next);
      return next;
    });
  }, [revived]);

  /**
   * And from here on, every change of phase is written down as it happens.
   *
   * Cheap: `running` is a handful of fields, and this only fires when the phase,
   * its start or the hold actually moves — not on every tick.
   *
   * The hold has to be in here, and in the comparison below. It was not, so a
   * watch held at 12:04 and then reloaded came back running: the store still
   * held the version from before the hold, and every minute of the pause was
   * counted as watched. A pause that a refresh silently cashes in is worse than
   * no pause, because you would not have left the desk without it.
   */
  useEffect(() => {
    const now2 = runningOf(session);
    setData((d) => {
      const was = d.running;
      const same = was === now2
        || (was !== null && now2 !== null
            && was.phase === now2.phase && was.startedAt === now2.startedAt
            && was.quarryId === now2.quarryId
            && was.pausedMs === now2.pausedMs && was.pausedAt === now2.pausedAt);
      if (same) return d;
      const next: Schema = { ...d, running: now2 };
      save(next);
      return next;
    });
  }, [session.phase, session.startedAt, session.quarryId, session.pausedMs, session.pausedAt]);

  /**
   * Another tab wrote to the store.
   *
   * `save()` writes the whole schema at once, so two tabs open meant the one
   * that wrote last silently erased whatever the other had recorded — a
   * finished watch could simply vanish because you had the app open twice.
   *
   * The `storage` event fires only in OTHER tabs, never the one that wrote, so
   * this cannot loop. Sessions are merged by `startedAt` rather than replaced:
   * both tabs may have recorded real work, and taking the newer wholesale is
   * the same data loss from the other direction.
   */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue === null) return;
      setData((mine) => {
        const merged = fromTransfer(
          JSON.stringify({ kind: 'nightwatch-ledger', version: 1, exportedAt: Date.now(),
                           data: JSON.parse(e.newValue!) }),
          mine,
        );
        // A write we cannot read is a write we leave alone. The other tab still
        // holds it, and overwriting from here would lose it for both.
        return merged.ok ? merged.data : mine;
      });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // The rAF-free heartbeat: one tick a second is enough for a clock, and the
  // machine reads wall-clock time anyway.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  useEffect(() => {
    const id = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      const { state, completed } = reduce(sessionRef.current, { type: 'tick', at });
      if (state !== sessionRef.current) {
        // A phase ended on its own. That is the ONE moment worth interrupting
        // for — a phase the user ended themselves needs no announcement, which
        // is why this lives on the tick and not in `dispatch`.
        const from = sessionRef.current.phase;
        if (from === 'hunt') announce(alertsRef.current, COPY.done);
        else if (from === 'respite') announce(alertsRef.current, COPY.respiteOver);
        setSession(state);
      }
      if (completed) {
        setData((d) => {
          const sessions = [...d.sessions, completed];
          const next: Schema = {
            ...d,
            sessions,
            // The phase ran out on its own, so the watch was KEPT rather than
            // ended — that is the one note the two completion paths disagree on.
            notes: record(d.notes, notesForWatch({
              minutes: completed.minutes,
              completed: true,
              weather: weatherRef.current,
              streak: streakLength(sessions, at),
              totalSessions: sessions.length,
            })),
            quarry: d.quarry.map((q) =>
              q.id === completed.quarryId ? { ...q, minutes: q.minutes + completed.minutes } : q,
            ),
          };
          save(next, at);
          return next;
        });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // The tab title, rewritten every tick while a phase runs. This is the one
  // channel that needs no permission and no sound, and it is the one that
  // actually matches how the app is used: press start, switch to your work.
  useEffect(() => {
    document.title = data.settings.alerts.title
      ? titleFor(session.phase, formatClock(remainingMs), selectedName, isHeld(session))
      : 'Night Watch';
  }, [data.settings.alerts.title, session.phase, remainingMs, selectedName, session.pausedAt]);

  const gradesRef = useRef(grades);
  gradesRef.current = grades;
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() =>
    startAmbientDriver({
      read: () => ({ progress: progressRef.current, grades: gradesRef.current }),
      onValues: setValues,
    }),
  []);

  const motion = motionValue(
    data.settings.motion,
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    document.documentElement.dataset.motion = data.settings.motion;
  }, [data.settings.motion]);

  const dispatch = useCallback((ev: SessionEvent) => {
    setSession((s) => {
      const { state, completed } = reduce(s, ev);
      if (completed) {
        setData((d) => {
          const now2 = Date.now();
          const sessions = [...d.sessions, completed];
          const next: Schema = {
            ...d,
            sessions,
            // Stopped by hand, so no `kept`.
            notes: record(d.notes, notesForWatch({
              minutes: completed.minutes,
              completed: false,
              weather: weatherRef.current,
              streak: streakLength(sessions, now2),
              totalSessions: sessions.length,
            })),
            quarry: d.quarry.map((q) =>
              q.id === completed.quarryId ? { ...q, minutes: q.minutes + completed.minutes } : q,
            ),
          };
          save(next);
          return next;
        });
      }
      return state;
    });
  }, []);

  // Clearing the selection when the selected quarry goes away. Left behind, the
  // machine would hold an id that resolves to nothing and the Watch would show
  // a blank name above the clock for the rest of the session.
  const dispatchIfSelected = useCallback((id: string) => {
    setSession((s) => (s.quarryId === id ? reduce(s, { type: 'selectQuarry', quarryId: null }).state : s));
  }, []);

  const actions = useMemo(() => ({
    start: () => dispatch({ type: 'start', at: Date.now() }),
    stop: () => dispatch({ type: 'stop', at: Date.now() }),
    skip: () => dispatch({ type: 'skip', at: Date.now() }),
    /**
     * One action, not two. Holding and lifting are the same button and the same
     * key, and asking the caller to work out which it wants would put the same
     * `pausedAt !== null` test in the button, the shortcut and the palette —
     * three copies of one question, which is how they end up disagreeing.
     */
    toggleHold: () => dispatch({ type: 'toggleHold', at: Date.now() }),
    selectQuarry: (quarryId: string | null) => dispatch({ type: 'selectQuarry', quarryId }),
    addQuarry: (name: string) => setData((d) => {
      const trimmed = name.trim();
      if (trimmed === '') return d;
      const next: Schema = {
        ...d,
        quarry: [...d.quarry, {
          id: `q${Date.now()}`, name: trimmed, minutes: 0, done: false, createdAt: Date.now(),
        }],
      };
      save(next);
      return next;
    }),
    /**
     * Removing a quarry does NOT remove the sessions logged against it — the
     * ledger records what actually happened, and rewriting history because a
     * task was tidied away would make the totals lie. The orphaned `quarryId`
     * simply stops resolving to a name, which `quarryTotals` already handles by
     * mapping over the quarry list rather than over the ids in the sessions.
     */
    removeQuarry: (id: string) => {
      dispatchIfSelected(id);
      setData((d) => {
        const next: Schema = { ...d, quarry: d.quarry.filter((q) => q.id !== id) };
        save(next);
        return next;
      });
    },

    renameQuarry: (id: string, name: string) => setData((d) => {
      const trimmed = name.trim();
      // An empty rename is a cancelled rename, not a request for a nameless
      // task. Deleting is a separate, deliberate action.
      if (trimmed === '') return d;
      const next: Schema = {
        ...d,
        quarry: d.quarry.map((q) => (q.id === id ? { ...q, name: trimmed } : q)),
      };
      save(next);
      return next;
    }),

    toggleQuarryDone: (id: string) => setData((d) => {
      const next: Schema = {
        ...d,
        quarry: d.quarry.map((q) => (q.id === id ? { ...q, done: !q.done } : q)),
      };
      save(next);
      return next;
    }),
    /**
     * Wires up `setDurations`, which the machine has implemented and tested
     * since it was written and which nothing ever dispatched — so 50 and 10
     * were unreachable constants in a timer whose whole subject is duration.
     *
     * Both the store and the running machine are updated: the store so it
     * survives a reload, the machine so a hunt already under way retargets
     * without losing its origin (see `setDurations` in machine.ts).
     */
    setDurations: (huntMinutes: number, respiteMinutes: number) => {
      const hunt = clampMinutes(huntMinutes, HUNT_RANGE);
      const respite = clampMinutes(respiteMinutes, RESPITE_RANGE);
      dispatch({ type: 'setDurations', huntMinutes: hunt, respiteMinutes: respite, at: Date.now() });
      setData((d) => {
        const next: Schema = {
          ...d,
          settings: { ...d.settings, huntMinutes: hunt, respiteMinutes: respite },
        };
        save(next);
        return next;
      });
    },

    /**
     * `notify` is the only one that can refuse to turn on: the browser owns
     * that decision. Asking HERE, in the click that turns it on, is the whole
     * reason it defaults to off — a permission dialog on first load would be
     * the most intrusive thing in an app with no account and no server.
     */
    toggleAlert: async (key: keyof Alerts) => {
      if (key === 'notify') {
        const granted = await requestNotify();
        setData((d) => {
          const on = d.settings.alerts.notify ? false : granted;
          const next: Schema = {
            ...d,
            settings: { ...d.settings, alerts: { ...d.settings.alerts, notify: on } },
          };
          save(next);
          return next;
        });
        return;
      }
      setData((d) => {
        const next: Schema = {
          ...d,
          settings: {
            ...d.settings,
            alerts: { ...d.settings.alerts, [key]: !d.settings.alerts[key] },
          },
        };
        save(next);
        return next;
      });
    },

    /**
     * Notes that are not earned by finishing a watch — a stone that skipped
     * well, the lamps put out. Idempotent, so a caller may fire it every time
     * the thing happens without checking first.
     */
    note: (id: string) => setData((d) => {
      const notes = record(d.notes, [id]);
      if (notes.length === d.notes.length) return d;
      const next: Schema = { ...d, notes };
      save(next);
      return next;
    }),

    /** Hand the whole ledger over as a file. */
    exportLedger: () => setData((d) => { downloadTransfer(d); return d; }),

    /**
     * Read one back. Merges; never replaces. Returns how many nights were new,
     * or null when the file was not ours to read.
     */
    importLedger: (raw: string): number | null => {
      let added: number | null = null;
      setData((mine) => {
        const r = fromTransfer(raw, mine);
        if (!r.ok) return mine;
        added = r.added;
        save(r.data);
        return r.data;
      });
      return added;
    },

    cycleMotion: () => setData((d) => {
      const next: Schema = {
        ...d,
        settings: { ...d.settings, motion: nextMotion(d.settings.motion) },
      };
      save(next);
      return next;
    }),
  }), [dispatch, dispatchIfSelected]);

  return {
    session, values, progress, motion, grades, data, remainingMs, streak, ledger, weather,
    nightsGrid, best, totals, quarryTotals, retentionDays: RETENTION_DAYS,
    tonight: tonightStats,
    recovered: boot.recovered, actions,
  };
}
