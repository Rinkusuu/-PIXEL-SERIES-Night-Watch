/**
 * Where the world's stone meets its water.
 *
 * These numbers used to live as magic fractions inside two different modules —
 * `layers.ts` drew the near band at 0.86 and `bloom.ts` independently believed
 * the street lamps stood at 0.855. Two copies of one fact, already disagreeing.
 *
 * So: ONE function. Everything that needs a composition line asks here, and
 * because the rounding happens once, the modules agree to the pixel. Two
 * modules rounding the same fraction independently is how you get a 1px seam of
 * sky glowing between the river and the deck.
 */
export type Horizon = {
  h: number;
  /** highest spire in the far city */
  cityTop: number;
  /** below this the city's roofs begin; above it the sky is clean */
  skyBot: number;
  /** the far city's feet — the same line as the waterline */
  cityBot: number;
  /** top rail of the upstream bridge */
  bridgeTop: number;
  /** foot of the piers, sunk into the river */
  bridgeBot: number;
  waterTop: number;
  waterBot: number;
  railTop: number;
  railBot: number;
  deckTop: number;
};

/** The deck may not eat more than this much frame, nor less. */
export const DECK_MIN = 0.54;
export const DECK_MAX = 0.80;

/** Balustrade height, as a fraction of the frame. */
export const RAIL_H = 0.06;

/**
 * The river's floor. Bands ABOVE the water are proportional and compressible;
 * the water is not. A river squeezed to a thin strip kills the reflection, and
 * the reflection is the single largest source of detail in the scene.
 */
export const WATER_MIN = 0.14;

/** Where the waterline sits when there is room for it. */
export const WATER_TOP_PREF = 0.40;

/**
 * Where the deck goes before the panel row has been measured — one frame at
 * boot, and any frame where the measurement is not available. It lives here
 * rather than in the canvas because it is a composition line like any other.
 */
export const DECK_DEFAULT = 0.66;

export function defaultDeckTop(h: number): number {
  return h * DECK_DEFAULT;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function horizon(h: number, deckTopPx: number): Horizon {
  const deckTop = Math.round(clamp(deckTopPx, h * DECK_MIN, h * DECK_MAX));
  const railTop = Math.round(deckTop - h * RAIL_H);
  const waterBot = railTop;
  const waterTop = Math.round(Math.min(h * WATER_TOP_PREF, railTop - h * WATER_MIN));

  // Everything above the waterline shares what is left, proportionally. On a
  // short viewport the sky gives way first — a cramped sky still reads as sky,
  // a cramped river reads as a shelf.
  const above = waterTop;

  return {
    h,
    // Headroom for the tallest towers, not the height of the average roof.
    // It was 0.40, and with a height curve that pushed every block toward the
    // top of its band that WAS the roofline — a hedge with nothing rising out
    // of it. The curve now leaves most blocks low (see `skyline`), so this line
    // is reached by a handful of towers and the rest of the band sits well
    // under it. Grandeur is the gap between the two, and the gap needs room.
    cityTop: Math.round(above * 0.30),
    skyBot: Math.round(above * 0.55),
    cityBot: waterTop,
    // Close to the waterline on purpose. A distant bridge is a THIN band; give
    // it a quarter of the sky and it stops being a bridge across a river and
    // becomes a viaduct you are standing under.
    bridgeTop: Math.round(above * 0.86),
    bridgeBot: waterTop + Math.round(h * 0.03),
    waterTop,
    waterBot,
    railTop,
    railBot: deckTop,
    deckTop,
  };
}
