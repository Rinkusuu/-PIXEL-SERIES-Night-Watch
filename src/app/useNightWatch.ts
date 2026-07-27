import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startAmbientDriver } from '../ambient/driver';
import { gradesFor } from '../ambient/grade';
import { resolve } from '../ambient/interpolate';
import { NIGHT_KEYS } from '../ambient/keyframes';
import type { AmbientValues, GradeName } from '../ambient/types';
import { initialState, progressOf, reduce, type SessionEvent, type SessionState } from '../session/machine';
import { minutesByNight } from '../session/aggregate';
import { streakLength } from '../session/streak';
import { load, save } from '../store/persist';
import type { Schema } from '../store/schema';
import { motionValue, nextMotion } from './motion';

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

  const progress = progressOf(session, now);
  const remainingMs = session.phase === 'idle'
    ? session.huntMs
    : Math.max(0, session.huntMs - (now - (session.startedAt ?? now)));

  const grades = useMemo<GradeName[]>(() => {
    const g: GradeName[] = [];
    if (session.phase === 'hunt' && remainingMs <= PRESSED_MS) g.push('pressed');
    if (streak >= BLOODMOON_STREAK) g.push('bloodmoon');
    return g.length === 0 ? ['calm'] : g;
  }, [session.phase, remainingMs, streak]);

  // The rAF-free heartbeat: one tick a second is enough for a clock, and the
  // machine reads wall-clock time anyway.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  useEffect(() => {
    const id = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      const { state, completed } = reduce(sessionRef.current, { type: 'tick', at });
      if (state !== sessionRef.current) setSession(state);
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
    session, values, progress, motion, grades, data, remainingMs, streak, ledger,
    recovered: boot.recovered, actions,
  };
}
