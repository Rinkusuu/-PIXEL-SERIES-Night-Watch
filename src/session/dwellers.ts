import { rand } from '../world/rng';

/**
 * Who is still awake behind a lit window.
 *
 * The city already had hundreds of burning windows and every one of them was
 * scenery. This is the cheapest possible thing that makes them not scenery: no
 * state, no store, no record kept. You look at a window, and the watch tells
 * you what it can see from the embankment, which is very little and entirely
 * guesswork — which is exactly right for a man across a river at two in the
 * morning.
 *
 * English, like everything else the watch says. The controls speak Indonesian;
 * the world does not.
 */
const LINES: readonly string[] = [
  'a clerk, still at his ledgers. the column will not come right.',
  'someone is reading. the same page, by the look of it.',
  'a child will not settle, and neither will the house.',
  'they are arguing. no voices carry this far, only the pacing.',
  'a lamp left burning for somebody who has not come home.',
  'a woman sewing. she has been at it since the lamps were lit.',
  'the shutters are open. whoever lives there likes the cold.',
  'a man shaving at midnight. he keeps early trains.',
  'a printer, by the rhythm of it. tomorrow is already being set.',
  'cards. four of them, and the game has gone on too long.',
  'somebody moves the curtain, sees the river, and lets it fall.',
  'a doctor, dressing. the knock came a minute ago.',
  'a kettle. that is all — a kettle, and the wait for it.',
  'nobody. the room is lit and the room is empty.',
  'a violin, badly. the same eight bars since the fog came down.',
  'a ledger closed and a coat taken down. the watch ends there too.',
  'letters, sorted into two piles. one is much larger.',
  'someone painting the ceiling at this hour, for reasons of their own.',
  'a bird cage, covered. the lamp is for the room, not the bird.',
  'they are packing. a trunk, not a bag.',
];

/**
 * The same window always says the same thing, because the line is drawn from
 * WHERE the window is rather than from when you clicked it. A window that
 * offered a fresh stranger on every press would be a slot machine, and the
 * scene would stop being a place.
 *
 * Coordinates are rounded first. They come from the renderer, which recomputes
 * them on every resize, and a window that changed its occupant when you
 * stretched the browser is the same failure by another route.
 */
export function dwellerAt(x: number, y: number): string {
  const key = Math.round(x / 2) * 7919 + Math.round(y / 2) * 104729;
  return LINES[Math.floor(rand(key) * LINES.length) % LINES.length]!;
}

/** For the tests, and for anyone counting. */
export const DWELLER_COUNT = LINES.length;
export const DWELLER_LINES = LINES;
