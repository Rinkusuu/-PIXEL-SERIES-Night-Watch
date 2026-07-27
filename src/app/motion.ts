import type { Settings } from '../store/schema';

type Motion = Settings['motion'];

const ORDER: readonly Motion[] = ['auto', 'on', 'off'];

export function nextMotion(current: Motion): Motion {
  const i = ORDER.indexOf(current);
  return ORDER[(i + 1) % ORDER.length]!;
}

/**
 * The OS preference is the DEFAULT, not a lock. A bare media query cannot be
 * cancelled by the user, so the setting must be able to win both ways. DNA §4.
 */
export function motionValue(setting: Motion, prefersReduced: boolean): 0 | 1 {
  if (setting === 'on') return 1;
  if (setting === 'off') return 0;
  return prefersReduced ? 0 : 1;
}

export function motionLabel(setting: Motion): string {
  return { auto: 'GERAK: AUTO', on: 'GERAK: HIDUP', off: 'GERAK: MATI' }[setting];
}
