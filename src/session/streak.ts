import type { SessionRecord } from '../store/schema';

/**
 * Spec §10. Midnight is the wrong boundary for people who work at night: a
 * session finishing at 01:30 belongs to the night before, and the theme agrees.
 */
export const NIGHT_BOUNDARY_HOUR = 4;

const pad = (n: number) => String(n).padStart(2, '0');

export function nightKey(ts: number): string {
  const d = new Date(ts);
  // Shifting the local hour handles month, year and DST rollover for free.
  d.setHours(d.getHours() - NIGHT_BOUNDARY_HOUR);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function previousNightKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const prev = new Date(y, m - 1, d - 1, 12, 0, 0, 0);
  return `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`;
}

export function streakLength(sessions: readonly SessionRecord[], now: number): number {
  if (sessions.length === 0) return 0;
  const nights = new Set(sessions.map((s) => nightKey(s.startedAt)));

  const tonight = nightKey(now);
  const lastNight = previousNightKey(tonight);

  // A streak may end tonight or last night; anything older is already broken.
  let cursor = nights.has(tonight) ? tonight : nights.has(lastNight) ? lastNight : null;
  if (cursor === null) return 0;

  let count = 0;
  while (nights.has(cursor)) {
    count++;
    cursor = previousNightKey(cursor);
  }
  return count;
}
