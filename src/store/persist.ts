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

  // A missing settings block is a shape we can repair, not a corruption.
  const base = emptySchema();
  return {
    data: { ...parsed, settings: { ...base.settings, ...(parsed.settings ?? {}) } },
    recovered: false,
  };
}

export function save(
  data: Schema,
  now: number = Date.now(),
  storage: Storage = localStorage,
): void {
  const trimmed: Schema = { ...data, sessions: pruneSessions(data.sessions, now) };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // A full disk is not worth a crash, and DNA §11 forbids a banner about it.
    // The session in memory continues; the next save may succeed after pruning.
  }
}
