import { nightKey } from '../session/streak';
import {
  CORRUPT_PREFIX, RETENTION_DAYS, STORAGE_KEY,
  type Schema, type SessionRecord, emptySchema,
} from './schema';

const DAY = 86_400_000;

export function pruneSessions(
  sessions: readonly SessionRecord[],
  now: number,
  days: number = RETENTION_DAYS,
): SessionRecord[] {
  const floor = now - days * DAY;
  return sessions.filter((s) => s.startedAt > floor);
}

function isSchema(v: unknown): v is Schema {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return o.version === 1 && Array.isArray(o.quarry) && Array.isArray(o.sessions);
}

/**
 * Drop entries for nights that have fallen out of the window.
 *
 * Compared by KEY rather than by parsing each one into a date: the keys are
 * `YYYY-MM-DD` and sort lexicographically, so the floor's own key is the whole
 * comparison and there is no timezone in it to get wrong.
 */
export function pruneLog(
  log: Record<string, string>,
  now: number,
  days: number = RETENTION_DAYS,
): Record<string, string> {
  const floor = nightKey(now - days * DAY);
  return Object.fromEntries(Object.entries(log ?? {}).filter(([k]) => k >= floor));
}

export function load(storage: Storage = localStorage): { data: Schema; recovered: boolean } {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return { data: emptySchema(), recovered: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  if (!isSchema(parsed)) {
    // Never destroy what we could not read. The user may want it back.
    storage.setItem(`${CORRUPT_PREFIX}${Date.now()}`, raw);
    storage.removeItem(STORAGE_KEY);
    return { data: emptySchema(), recovered: true };
  }

  // A missing settings block is a shape we can repair, not a corruption. The
  // same goes one level deeper for `alerts`: a store written before alerts
  // existed has settings but no alerts, and spreading only the outer level
  // would leave it `undefined` for every reader.
  const base = emptySchema();
  const settings = { ...base.settings, ...(parsed.settings ?? {}) };
  settings.alerts = { ...base.settings.alerts, ...(settings.alerts ?? {}) };
  // Same repair for `notes`: a store written before they existed has none, and
  // every reader expects an array.
  const notes = Array.isArray(parsed.notes) ? parsed.notes : [];
  // And for `log`. A plain object check, not `typeof === 'object'`: an array
  // and a null both pass that, and either would reach the panel as a map with
  // numeric keys or as a crash.
  const rawLog = (parsed as { log?: unknown }).log;
  const log = rawLog !== null && typeof rawLog === 'object' && !Array.isArray(rawLog)
    ? Object.fromEntries(
      Object.entries(rawLog as Record<string, unknown>)
        .filter(([, v]) => typeof v === 'string' && v !== ''),
    ) as Record<string, string>
    : {};
  // A store written before watches were resumable has no `running`, and a
  // malformed one must not be handed to `resume()` as though it were a watch.
  const r = (parsed as { running?: unknown }).running;
  const running = r && typeof r === 'object'
    && typeof (r as { startedAt?: unknown }).startedAt === 'number'
    && ((r as { phase?: unknown }).phase === 'hunt' || (r as { phase?: unknown }).phase === 'respite')
    ? (r as Schema['running'])
    : null;
  return { data: { ...parsed, settings, notes, log, running }, recovered: false };
}

export function save(
  data: Schema,
  now: number = Date.now(),
  storage: Storage = localStorage,
): void {
  const trimmed: Schema = {
    ...data,
    sessions: pruneSessions(data.sessions, now),
    // The book is pruned on the same window as the sessions it annotates. A
    // note about a night whose minutes have already been dropped is a note
    // about nothing, and localStorage is not infinite.
    log: pruneLog(data.log, now),
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // A full disk is not worth a crash, and DNA §11 forbids a banner about it.
    // The session in memory continues; the next save may succeed after pruning.
  }
}
