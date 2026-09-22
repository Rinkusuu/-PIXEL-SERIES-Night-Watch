import { STORAGE_KEY, type Schema, emptySchema } from './schema';

/**
 * Getting a ledger out of one browser and into another.
 *
 * Ninety nights lived in one origin's localStorage with no way out. Change
 * laptop, or let a browser tidy away a site you had not opened in a while, and
 * the streak is zero and the record of a season's work is gone. A store with no
 * export is a store you are one cleared-cookies dialog away from losing.
 */

/** What a file carries. Versioned separately from the schema it wraps. */
export const TRANSFER_VERSION = 1;
export type Transfer = {
  kind: 'nightwatch-ledger';
  version: number;
  exportedAt: number;
  data: Schema;
};

export function toTransfer(data: Schema, now = Date.now()): Transfer {
  // `running` is deliberately dropped. A watch that was in progress on another
  // machine is not in progress here, and importing one would start a clock the
  // reader never began — possibly hours ago, which would then be recorded.
  return {
    kind: 'nightwatch-ledger',
    version: TRANSFER_VERSION,
    exportedAt: now,
    data: { ...data, running: null },
  };
}

export function fileName(now = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `night-watch-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export type ImportResult =
  | { ok: true; data: Schema; added: number }
  | { ok: false; reason: 'unreadable' | 'foreign' | 'newer' };

/**
 * Read a file back, MERGING rather than replacing.
 *
 * Replacing is the obvious behaviour and the wrong one: a reader almost always
 * has some history of their own, and an import that silently discards it is a
 * data loss disguised as a feature. Sessions are keyed by `startedAt`, which is
 * a millisecond timestamp — two watches cannot begin in the same millisecond on
 * the same machine, so it identifies a session without needing an id.
 */
export function fromTransfer(raw: string, mine: Schema): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (typeof parsed !== 'object' || parsed === null) return { ok: false, reason: 'unreadable' };
  const t = parsed as Partial<Transfer>;
  if (t.kind !== 'nightwatch-ledger') return { ok: false, reason: 'foreign' };
  if (typeof t.version !== 'number' || t.version > TRANSFER_VERSION) {
    // Written by a later build than this one. Refusing is the honest answer;
    // guessing at a shape we do not know is how an import corrupts a ledger.
    return { ok: false, reason: 'newer' };
  }
  const incoming = t.data;
  if (typeof incoming !== 'object' || incoming === null) return { ok: false, reason: 'unreadable' };

  const base = emptySchema();
  const seen = new Set(mine.sessions.map((s) => s.startedAt));
  const add = (Array.isArray(incoming.sessions) ? incoming.sessions : [])
    .filter((s) => s && typeof s.startedAt === 'number' && !seen.has(s.startedAt));

  const quarryById = new Map(mine.quarry.map((q) => [q.id, q]));
  for (const q of Array.isArray(incoming.quarry) ? incoming.quarry : []) {
    if (!q || typeof q.id !== 'string') continue;
    // A quarry known to both keeps the LARGER total: the two machines each
    // counted part of the same work, and the sum would double whatever was
    // already synced once before.
    const have = quarryById.get(q.id);
    if (!have) quarryById.set(q.id, q);
    else if (q.minutes > have.minutes) quarryById.set(q.id, { ...have, minutes: q.minutes });
  }

  const notes = new Set([...mine.notes, ...(Array.isArray(incoming.notes) ? incoming.notes : [])]);

  /*
   * The night book. A night the reader has nothing for takes theirs; a night
   * both wrote keeps the LONGER entry.
   *
   * Free text is the one thing here that cannot be merged honestly — there is
   * no `startedAt` to match on and no total to take the larger of. Every
   * automatic rule can lose something. This one was chosen because it is
   * idempotent: importing the same file twice, or importing back and forth
   * between two machines, settles instead of growing. Concatenating would
   * duplicate on the second import, and taking the reader's would silently
   * drop the other machine's whole book.
   */
  const log: Record<string, string> = { ...mine.log };
  const theirs = incoming.log;
  if (theirs !== null && typeof theirs === 'object' && !Array.isArray(theirs)) {
    for (const [night, text] of Object.entries(theirs)) {
      if (typeof text !== 'string' || text === '') continue;
      const have = log[night];
      if (have === undefined || text.length > have.length) log[night] = text;
    }
  }

  return {
    ok: true,
    added: add.length,
    data: {
      ...base,
      ...mine,
      sessions: [...mine.sessions, ...add].sort((a, b) => a.startedAt - b.startedAt),
      quarry: [...quarryById.values()],
      notes: [...notes],
      log,
      // Settings stay the reader's. They describe this machine — how long you
      // like to work, whether this browser may notify you — not the ledger.
      settings: mine.settings,
      running: mine.running,
    },
  };
}

/** Hand the browser a file. Separate from `toTransfer` so that stays pure. */
export function downloadTransfer(data: Schema, now = Date.now()): void {
  const blob = new Blob([JSON.stringify(toTransfer(data, now), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(now);
  a.click();
  // Revoked on the next turn of the loop: revoking immediately races the click
  // in some browsers and the file comes down empty.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The key another tab's write shows up under. */
export const SHARED_KEY = STORAGE_KEY;
