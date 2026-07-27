import type { Phase } from '../session/machine';

/**
 * Spec §7. Every state has a hand-written sentence; none are defaults.
 * The voice is a night watchman: it observes, it never encourages.
 */
export const COPY = {
  idleWithQuarry: 'the lamps are unlit.',
  idleNoQuarry: 'no quarry named. the street is quiet.',
  dusk: 'the lamps are lit.',
  fog: 'the fog comes up off the river.',
  deep: 'nothing moves but the fog.',
  late: 'the hour holds.',
  done: 'dawn. the watch is kept.',
  respite: 'the watch rests. the fog does not.',
  bloodmoon: 'the moon has turned.',
  quarryEmpty: 'no quarry named.',
  ledgerEmpty: 'the ledger is blank. nothing kept yet.',
  storeRecovered: 'the ledger was water-damaged. starting a clean page.',
  labels: {
    start: 'MULAI',
    stop: 'HENTI',
    skip: 'LEWATI',
    add: 'TAMBAH',
  },
} as const;

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ambientLine(input: {
  phase: Phase;
  progress: number;
  hasQuarry: boolean;
  bloodmoon: boolean;
}): string {
  if (input.phase === 'idle') {
    return input.hasQuarry ? COPY.idleWithQuarry : COPY.idleNoQuarry;
  }
  if (input.phase === 'respite') return COPY.respite;
  if (input.bloodmoon) return COPY.bloodmoon;
  if (input.progress >= 1) return COPY.done;
  if (input.progress >= 0.85) return COPY.late;
  if (input.progress >= 0.62) return COPY.deep;
  if (input.progress >= 0.35) return COPY.fog;
  return COPY.dusk;
}
