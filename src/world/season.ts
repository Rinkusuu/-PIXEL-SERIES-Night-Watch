/**
 * The year, as the world sees it.
 *
 * Nothing in the app knew what month it was. The weather was drawn from one
 * fixed table for all time, so a night in January and a night in July were the
 * same coin toss — which is a defensible simplification right up until you use
 * the thing for a year and notice that nothing ever changes.
 *
 * Northern hemisphere, deliberately and without a setting. This is London: the
 * great fogs were an autumn and winter affair, the summer nights are short and
 * clear, and a January Thames that behaved like a July one would be a different
 * city. The theme picks the hemisphere, not the reader's location.
 */

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

/**
 * Read from the NIGHT KEY rather than from a `Date`.
 *
 * The key already carries the four-o'clock boundary that decides which night a
 * session belongs to, and asking a second source what day it is would let the
 * two disagree across midnight — the one moment where being wrong is visible.
 */
export function seasonOf(night: string): Season {
  const month = Number(night.split('-')[1]);
  if (!Number.isFinite(month) || month < 1 || month > 12) return 'autumn';
  if (month <= 2 || month === 12) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'autumn';
}
