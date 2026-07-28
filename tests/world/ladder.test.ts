import { describe, expect, it } from 'vitest';
import { VIGNETTE_INK, valueLadder } from '../../src/world/ladder';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';
import { hexToRgb, luminance, resolve } from '../../src/ambient/interpolate';
import type { GradeName } from '../../src/ambient/types';

const COMBOS: readonly (readonly GradeName[])[] = [
  ['calm'], ['pressed'], ['bloodmoon'], ['pressed', 'bloodmoon'],
];

describe('valueLadder', () => {
  it('steps strictly darker from the far city to the frame edge', () => {
    // This is the whole point: Bloodborne is CONTRAST, not darkness. If any two
    // rungs ever swap, the picture loses its depth at that moment.
    for (const key of NIGHT_KEYS) {
      for (const grades of COMBOS) {
        const v = resolve(NIGHT_KEYS, key.at, gradesFor(grades));
        const l = valueLadder(v);
        const lum = (hex: string) => luminance(hexToRgb(hex));
        const where = `at=${key.at} grades=${grades.join('+')}`;
        expect(lum(l.cityFar), where).toBeGreaterThan(lum(l.city));
        expect(lum(l.city), where).toBeGreaterThan(lum(l.bridge));
        expect(lum(l.bridge), where).toBeGreaterThan(lum(l.deck));
        expect(lum(l.deck), where).toBeGreaterThan(lum(l.rail));
        expect(lum(l.rail), where).toBeGreaterThan(lum(l.vignette));
      }
    }
  });

  it('anchors the frame edge to a fixed ink, never to the ambient palette', () => {
    // If the vignette followed ambient it would brighten along WITH the fog,
    // and the contrast would collapse exactly when the picture should be at its
    // most dramatic.
    const seen = new Set<string>();
    for (const key of NIGHT_KEYS) {
      for (const grades of COMBOS) {
        seen.add(valueLadder(resolve(NIGHT_KEYS, key.at, gradesFor(grades))).vignette);
      }
    }
    expect([...seen]).toEqual([VIGNETTE_INK]);
  });

  it('measures every rung against the fog, not against the deep', () => {
    // sky[2] is the brightest thing on screen and the mass everything is cut
    // into, so it is the only sensible anchor for the ladder.
    const bright = resolve(NIGHT_KEYS, 0.62, gradesFor(['calm']));
    const dark = resolve(NIGHT_KEYS, 0.85, gradesFor(['calm']));
    const lum = (hex: string) => luminance(hexToRgb(hex));
    expect(lum(valueLadder(bright).city)).toBeGreaterThan(lum(valueLadder(dark).city));
  });

  it('darkens the stone when it rains, without breaking the ladder', () => {
    const v = resolve(NIGHT_KEYS, 0.35, gradesFor(['calm']));
    const lum = (hex: string) => luminance(hexToRgb(hex));
    expect(lum(valueLadder(v, 0.18).deck)).toBeLessThan(lum(valueLadder(v, 0).deck));
    expect(lum(valueLadder(v, 0.18).deck)).toBeGreaterThan(lum(valueLadder(v, 0.18).rail));
  });
});
