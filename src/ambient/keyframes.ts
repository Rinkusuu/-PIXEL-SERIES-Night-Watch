import type { Keyframe } from './types';

/**
 * Spec §4.2. Spacing is deliberately uneven — dense between 0.62 and 0.85
 * where the change matters most (DNA §3.3).
 *
 * Two values look like mistakes and are not:
 *  - glow BRIGHTENS at 0.62. Thick fog scatters gaslight yellower, not dimmer.
 *  - glow turns COLD at 1.00. Dawn puts the gas out. It is the only cold key
 *    light in the app, and it is the reward for finishing.
 */
export const NIGHT_KEYS: readonly Keyframe[] = [
  { at: 0.00, sky: ['#2b2233', '#4a3450', '#8a5a4e'],
    glow: '#ffb347', accent: '#6f8f9c', lum: 0.46,
    ink: '#ece4d8', inkSoft: '#b3a79c' },
  { at: 0.35, sky: ['#161c2a', '#26303f', '#4a4a52'],
    glow: '#ffb347', accent: '#6f8f9c', lum: 0.30,
    ink: '#ece4d8', inkSoft: '#a2a5a3' },
  { at: 0.62, sky: ['#0f141c', '#1a2430', '#2b3740'],
    glow: '#ffc46b', accent: '#6f8f9c', lum: 0.18,
    ink: '#ece4d8', inkSoft: '#9aa5a8' },
  { at: 0.85, sky: ['#080b11', '#0e1218', '#161e26'],
    glow: '#ffb347', accent: '#6f8f9c', lum: 0.08,
    ink: '#e6ded2', inkSoft: '#95a0a4' },
  { at: 1.00, sky: ['#1b2733', '#33465a', '#7d8a92'],
    glow: '#cfd8dc', accent: '#b08d57', lum: 0.52,
    ink: '#f2ece2', inkSoft: '#aab4b8' },
];
