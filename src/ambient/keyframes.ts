import type { Keyframe } from './types';

/**
 * Spec §3.1. Spacing is deliberately uneven — dense between 0.62 and 0.85
 * where the change matters most (DNA §3.3).
 *
 * DUSK IS GONE. The watch begins at night: you are a night watchman, not a
 * sunset watchman. The app sits at 0.00 whenever it is idle, so the first
 * keyframe is the one people actually look at, and it has to be the night.
 *
 * Values that look like mistakes and are not:
 *  - glow BRIGHTENS at 0.62. Thick fog scatters gaslight yellower, not dimmer.
 *  - glow turns COLD at 1.00. Dawn puts the gas out. It is the only cold key
 *    light in the app, and it is the reward for finishing.
 *  - `accent` equals `sky[2]` at every night key. The fog is no longer a dark
 *    veil laid over the world; it is the BRIGHTEST mass in the picture, and the
 *    thing everything else is cut into.
 *  - PALEST fog and THICKEST fog are different moments. `fog.ts` computes
 *    thickness as (1 - lum), so lum still falls monotonically; what peaks at
 *    0.62 is `accent`. 0.62 is the glowing fog, 0.85 is the swallowing fog.
 */
export const NIGHT_KEYS: readonly Keyframe[] = [
  { at: 0.00, sky: ['#16232a', '#2c4348', '#4a6b6b'],
    glow: '#ffb347', accent: '#4a6b6b', lum: 0.30,
    ink: '#ece4d8', inkSoft: '#b3a79c' },
  { at: 0.35, sky: ['#131f26', '#2a4247', '#587a78'],
    glow: '#ffb347', accent: '#587a78', lum: 0.22,
    ink: '#ece4d8', inkSoft: '#a2a5a3' },
  { at: 0.62, sky: ['#101a20', '#2f4a4c', '#6d8f89'],
    glow: '#ffc46b', accent: '#6d8f89', lum: 0.16,
    ink: '#ece4d8', inkSoft: '#9aa5a8' },
  { at: 0.85, sky: ['#0b1216', '#1e3034', '#40595c'],
    glow: '#ffb347', accent: '#40595c', lum: 0.10,
    ink: '#e6ded2', inkSoft: '#95a0a4' },
  { at: 1.00, sky: ['#1b2733', '#33465a', '#7d8a92'],
    glow: '#cfd8dc', accent: '#b08d57', lum: 0.52,
    ink: '#f2ece2', inkSoft: '#aab4b8' },
];
