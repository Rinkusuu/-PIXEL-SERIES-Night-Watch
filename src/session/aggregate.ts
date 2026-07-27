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

export function minutesByQuarry(sessions: readonly SessionRecord[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const s of sessions) {
    if (s.quarryId === null) continue;
    totals[s.quarryId] = (totals[s.quarryId] ?? 0) + s.minutes;
  }
  return totals;
}
