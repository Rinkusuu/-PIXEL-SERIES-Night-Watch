import type { SessionRecord } from '../store/schema';
import { nightKey } from './streak';

const DAY = 86_400_000;

export function minutesByNight(
  sessions: readonly SessionRecord[],
  now: number,
  days = 7,
): { key: string; minutes: number }[] {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    const k = nightKey(s.startedAt);
    totals.set(k, (totals.get(k) ?? 0) + s.minutes);
  }

  const rows: { key: string; minutes: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = nightKey(now - i * DAY);
    rows.push({ key, minutes: totals.get(key) ?? 0 });
  }
  return rows;
}

/**
 * Every night in the retained window, oldest first, as a flat run of cells.
 *
 * The store keeps ninety days (`RETENTION_DAYS`) and the Ledger was showing
 * seven. Eighty-three nights were written to localStorage every evening and
 * never looked at by anybody — the most expensive thing in the app to collect
 * and the least used.
 *
 * Returned as a flat array rather than laid out in weeks: the layout is the
 * view's business, and a grid built here would bake a column count into the
 * data model that the panel's own width is the only thing entitled to decide.
 */
export function nightGrid(
  sessions: readonly SessionRecord[],
  now: number,
  days: number,
): { key: string; minutes: number }[] {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    const k = nightKey(s.startedAt);
    totals.set(k, (totals.get(k) ?? 0) + s.minutes);
  }
  const out: { key: string; minutes: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = nightKey(now - i * DAY);
    out.push({ key, minutes: totals.get(key) ?? 0 });
  }
  return out;
}

/**
 * Longest run of consecutive kept nights anywhere in the window — not the run
 * ending today, which is what `streakLength` reports. A current streak of two
 * says nothing about whether this is a good month or a bad one; the best run
 * is the thing worth beating, and it is the only number here that does not
 * quietly reset to zero the first night you miss.
 */
export function bestStreak(
  sessions: readonly SessionRecord[],
  now: number,
  days: number,
): number {
  let best = 0;
  let run = 0;
  for (const n of nightGrid(sessions, now, days)) {
    run = n.minutes > 0 ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/** Total minutes across the window, and how many nights were kept at all. */
export function windowTotals(
  sessions: readonly SessionRecord[],
  now: number,
  days: number,
): { minutes: number; nights: number } {
  let minutes = 0;
  let nights = 0;
  for (const n of nightGrid(sessions, now, days)) {
    minutes += n.minutes;
    if (n.minutes > 0) nights++;
  }
  return { minutes, nights };
}

export function minutesByQuarry(sessions: readonly SessionRecord[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const s of sessions) {
    if (s.quarryId === null) continue;
    totals[s.quarryId] = (totals[s.quarryId] ?? 0) + s.minutes;
  }
  return totals;
}
