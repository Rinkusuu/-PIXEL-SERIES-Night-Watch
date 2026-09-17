import type { Weather } from '../world/weather';

/**
 * Things the watch has seen.
 *
 * The reference project's achievements are a joke about effort — you get
 * "Certified Idle" for leaving the tab open, because that dashboard's thesis is
 * that being present is enough. This app's thesis is the opposite one, and its
 * voice is stated in `copy.ts`: a night watchman observes, and never
 * encourages. So these are not achievements and must never read like them.
 *
 * Three rules follow from that, and all three are load-bearing:
 *
 * 1. They are OBSERVATIONS. "it rained the whole watch", not "well done".
 *    Nothing here is addressed to you; it is a line in a logbook.
 * 2. They never interrupt. No toast, no fanfare, no badge that flies in — DNA
 *    §11 forbids a banner and the watch would not shout at you mid-sentence.
 *    They appear in the Ledger, where a record belongs, and you find them when
 *    you go looking.
 * 3. English, because this is the watch speaking and not a control you press.
 *    See the language note at the top of `copy.ts`.
 * 4. They are mostly about the NIGHT, not about you. Weather, the moon, the
 *    dawn. What you did is already counted in minutes; this is what it was like
 *    outside while you did it.
 */
export type Note = { id: string; text: string };

export const NOTES: readonly Note[] = [
  { id: 'first', text: 'the first night is on the book.' },
  { id: 'kept', text: 'a watch carried to dawn without breaking.' },
  { id: 'fog', text: 'the fog came up off the river and stayed.' },
  { id: 'rain', text: 'it rained the whole watch. the stone is wet.' },
  { id: 'fullmoon', text: 'full moon. the river held all of it.' },
  { id: 'clear', text: 'a clear sky. the stars were countable.' },
  { id: 'week', text: 'seven nights running. the lamps know the hour.' },
  { id: 'fortnight', text: 'fourteen nights. the street knows the step.' },
  { id: 'long', text: 'one watch ran past ninety minutes.' },
  { id: 'stone', text: 'a stone went five bounces across the water.' },
  { id: 'dark', text: 'the lamps were put out once. the night stayed.' },
];

const BY_ID = new Map(NOTES.map((n) => [n.id, n]));
export const noteText = (id: string): string | undefined => BY_ID.get(id)?.text;

/**
 * Which notes a finished watch earns.
 *
 * Pure, and returns the whole set rather than mutating anything — the caller
 * unions it with what is already recorded. Called with a completed session, so
 * there is no "in progress" state to reason about.
 */
export function notesForWatch(input: {
  minutes: number;
  /** True when the phase ran out on its own rather than being stopped. */
  completed: boolean;
  weather: Weather;
  streak: number;
  totalSessions: number;
}): string[] {
  const out: string[] = [];
  if (input.totalSessions <= 1) out.push('first');
  if (input.completed) out.push('kept');
  if (input.minutes >= 90) out.push('long');
  if (input.streak >= 7) out.push('week');
  if (input.streak >= 14) out.push('fortnight');

  // One per weather, and only `clear` has no other name — `fullmoon` is a clear
  // night with the moon up, so it would otherwise claim both.
  if (input.weather === 'fog') out.push('fog');
  if (input.weather === 'rain') out.push('rain');
  if (input.weather === 'fullmoon') out.push('fullmoon');
  if (input.weather === 'clear') out.push('clear');

  return out;
}

/** Union, order-preserving, no duplicates. */
export function record(have: readonly string[], add: readonly string[]): string[] {
  const seen = new Set(have);
  const out = [...have];
  for (const id of add) {
    if (seen.has(id) || !BY_ID.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
