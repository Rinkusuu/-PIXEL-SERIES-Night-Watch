import type { AmbientValues } from '../ambient/types';
import { hexToRgb, mixRgb, rgbToHex } from '../ambient/interpolate';

/**
 * The frame edge. Fixed, and deliberately NOT derived from the ambient palette.
 *
 * This is the picture's value anchor: as long as the edge of the frame is dead
 * black, the eye reads everything else as having full range. Let it follow
 * ambient and it brightens along WITH the fog — so the contrast collapses at
 * exactly the moment the picture should be at its most dramatic.
 */
export const VIGNETTE_INK = '#05080a';

/**
 * How far each depth is dragged from the fog toward the ink.
 *
 * Every rung measures against `sky[2]`, the fog — the brightest thing on screen
 * and the mass everything else is cut into. Modules used to mix their own way
 * from their own anchors, which guaranteed nothing about the order.
 */
export const LADDER_STOPS = {
  /** The band standing BEHIND the main skyline. Barely pulled from the fog at
   *  all — atmospheric perspective is what tells the eye it is further away. */
  cityFar: 0.24,
  /**
   * The band between. `cityFar` to `city` was a single 0.21 step with nothing
   * in it, so the two bands read as two groups of stickers at two distances
   * rather than as a city receding. Depth is not two planes; it is a series,
   * and the eye needs at least three terms to read one.
   */
  cityMid: 0.34,
  city: 0.45,
  bridge: 0.70,
  deck: 0.88,
  rail: 0.93,
} as const;

export type Ladder = {
  cityFar: string;
  cityMid: string;
  city: string;
  bridge: string;
  deck: string;
  rail: string;
  vignette: string;
};

/** `wet` darkens the near stone on a rainy night. Spec §7 of the river scene. */
export function valueLadder(v: AmbientValues, wet = 0): Ladder {
  const fog = hexToRgb(v.sky[2]);
  const ink = hexToRgb(VIGNETTE_INK);
  const at = (t: number) => rgbToHex(mixRgb(fog, ink, Math.min(0.97, t)));

  return {
    cityFar: at(LADDER_STOPS.cityFar),
    cityMid: at(LADDER_STOPS.cityMid),
    city: at(LADDER_STOPS.city),
    bridge: at(LADDER_STOPS.bridge),
    deck: at(LADDER_STOPS.deck + wet * 0.25),
    rail: at(LADDER_STOPS.rail + wet * 0.2),
    vignette: VIGNETTE_INK,
  };
}
