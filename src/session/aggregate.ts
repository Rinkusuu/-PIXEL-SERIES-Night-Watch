import type { SessionRecord } from '../store/schema';
import { NIGHT_BOUNDARY_HOUR, nightKey } from './streak';

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

/**
 * Which hours of the night your watches actually happen in.
 *
 * The heat grid answers "which nights did I keep"; nothing answered "when".
 * Ninety days of start times were already in the store and nobody had ever
 * read the time-of-day out of them.
 *
 * A watch is spread across the hours it OCCUPIED, not filed under the hour it
 * began. At fifty minutes a watch crosses an hour boundary more often than not,
 * and counting the whole thing against 20:00 because that is when you pressed
 * start would put an hour of work in a clock position you were not working in.
 * The cheap version of this chart is the version that lies.
 *
 * Returned starting at `NIGHT_BOUNDARY_HOUR`, so the row reads as one night
 * from end to end instead of splitting yours in half at midnight — the same
 * boundary `nightKey` uses, for the same reason.
 */
export function minutesByHour(
  sessions: readonly SessionRecord[],
): { hour: number; minutes: number }[] {
  const bucket = new Array<number>(24).fill(0);

  for (const s of sessions) {
    if (!Number.isFinite(s.minutes) || s.minutes <= 0) continue;
    // A day and a half. Nothing legitimate reaches it — `HUNT_RANGE` caps a
    // watch at two hours — so this is only here to stop one corrupt record
    // from spinning the loop forever.
    let left = Math.min(s.minutes, 2160);
    let cursor = s.startedAt;

    while (left > 0) {
      const at = new Date(cursor);
      // Local hours throughout, walked forward rather than computed: an hour
      // that repeats or vanishes at a DST change then simply gets the minutes
      // the clock says it got.
      const room = 60 - at.getMinutes();
      const take = Math.min(left, room);
      bucket[at.getHours()] = bucket[at.getHours()]! + take;
      left -= take;
      cursor += take * 60_000;
    }
  }

  return Array.from({ length: 24 }, (_, i) => {
    const hour = (NIGHT_BOUNDARY_HOUR + i) % 24;
    return { hour, minutes: bucket[hour]! };
  });
}

/**
 * The hour with the most minutes in it, or null when there is nothing to rank.
 *
 * Ties go to the EARLIER hour in the night's order, which is the order the row
 * above is in — so the number under the chart always names a bar you can see
 * without counting from the wrong end.
 */
export function bestHour(
  byHour: readonly { hour: number; minutes: number }[],
): { hour: number; minutes: number } | null {
  let best: { hour: number; minutes: number } | null = null;
  for (const h of byHour) {
    if (h.minutes > 0 && (best === null || h.minutes > best.minutes)) best = h;
  }
  return best;
}
