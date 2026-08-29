import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startAmbientDriver } from '../ambient/driver';
import { gradesFor } from '../ambient/grade';
import { resolve } from '../ambient/interpolate';
import { NIGHT_KEYS } from '../ambient/keyframes';
import type { AmbientValues, GradeName } from '../ambient/types';
import {
  initialState, progressOf, reduce, remainingMs as remainingOf,
  type SessionEvent, type SessionState,
} from '../session/machine';
import { minutesByNight } from '../session/aggregate';
import { streakLength } from '../session/streak';
import { load, save } from '../store/persist';
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
  const [session, setSession] = useState<SessionState>(() =>
    initialState(boot.data.settings.huntMinutes, boot.data.settings.respiteMinutes),
  );
  const [now, setNow] = useState(() => Date.now());
  const [values, setValues] = useState<AmbientValues>(() =>
    resolve(NIGHT_KEYS, 0, gradesFor(['calm'])),
  );

  const streak = useMemo(() => streakLength(data.sessions, now), [data.sessions, now]);
  const ledger = useMemo(() => minutesByNight(data.sessions, now, 7), [data.sessions, now]);

  // The night's weather, drawn once from the same key the streak counts by. It
  // must not change on a re-render, or the sky would reshuffle mid-session.
  const tonight = nightKey(now);
  const weather = useMemo<Weather>(() => weatherFor(tonight), [tonight]);

  const progress = progressOf(session, now);
  const remainingMs = remainingOf(session, now);
  const selectedName = data.quarry.find((q) => q.id === session.quarryId)?.name ?? null;

  const grades = useMemo<GradeName[]>(() => {
    const g: GradeName[] = [];
    if (session.phase === 'hunt' && remainingMs <= PRESSED_MS) g.push('pressed');
    if (streak >= BLOODMOON_STREAK) g.push('bloodmoon');
    return g.length === 0 ? ['calm'] : g;
  }, [session.phase, remainingMs, streak]);

  // Read by the heartbeat below, which is mounted once and would otherwise
  // close over the settings as they were at boot.
  const alertsRef = useRef<Alerts>(data.settings.alerts);
  alertsRef.current = data.settings.alerts;

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
          const next: Schema = {
            ...d,
            sessions: [...d.sessions, completed],
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
      ? titleFor(session.phase, formatClock(remainingMs), selectedName)
      : 'Night Watch';
  }, [data.settings.alerts.title, session.phase, remainingMs, selectedName]);

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
          const next: Schema = {
            ...d,
            sessions: [...d.sessions, completed],
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

  const actions = useMemo(() => ({
    start: () => dispatch({ type: 'start', at: Date.now() }),
    stop: () => dispatch({ type: 'stop', at: Date.now() }),
    skip: () => dispatch({ type: 'skip', at: Date.now() }),
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

    cycleMotion: () => setData((d) => {
      const next: Schema = {
        ...d,
        settings: { ...d.settings, motion: nextMotion(d.settings.motion) },
      };
      save(next);
      return next;
    }),
  }), [dispatch]);

  return {
    session, values, progress, motion, grades, data, remainingMs, streak, ledger, weather,
    recovered: boot.recovered, actions,
  };
}
