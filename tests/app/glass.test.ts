import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { hexToRgb, mixRgb, resolve } from '../../src/ambient/interpolate';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';
import type { GradeName } from '../../src/ambient/types';

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (m: readonly number[]) =>
  0.2126 * channel(m[0]!) + 0.7152 * channel(m[1]!) + 0.0722 * channel(m[2]!);
const contrast = (a: readonly number[], b: readonly number[]) => {
  const hi = Math.max(lum(a), lum(b));
  const lo = Math.min(lum(a), lum(b));
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * The notched ring is what DNA §5.1 calls the single most important marker of
 * this visual language, and it was invisible for the entire life of the project
 * — 1.00 to 1.04 against the panel it outlines, at every keyframe, in every
 * grade. The derivation came from the parent project, whose palette is a
 * daytime blue where `mid` sits well above `deep`; this app's is a night where
 * they land on the same value.
 *
 * Nothing about that failure was visible in code review. It needs a number.
 */
describe('the notched frame ring', () => {
  const tokens = readFileSync('src/style/tokens.css', 'utf8');

  it('is derived from a role that is LIGHTER than the panel, not darker', () => {
    const rule = /--glass-edge:\s*([^;]+);/.exec(tokens)?.[1] ?? '';
    // Mixing the panel's own mid tone toward black is the shape of the bug.
    expect(rule).not.toMatch(/#000/);
    expect(rule).toMatch(/--amb-accent/);
  });

  it('stays visible at every keyframe and in every grade', () => {
    const grades: GradeName[][] = [['calm'], ['pressed'], ['bloodmoon']];
    let worst = Infinity;
    for (const g of grades) {
      for (const p of [0, 0.2, 0.35, 0.5, 0.62, 0.75, 0.85, 0.95, 1]) {
        const v = resolve(NIGHT_KEYS, p, gradesFor(g));
        // The derivation in tokens.css, in numbers.
        const edge = mixRgb(hexToRgb(v.mid), hexToRgb(v.accent), 0.70);
        const r = contrast(edge, hexToRgb(v.deep));
        worst = Math.min(worst, r);
        expect(r, `${g[0]} @ ${p}`).toBeGreaterThan(1.5);
      }
    }
    // A floor well clear of the 1.01 it used to sit at.
    expect(worst).toBeGreaterThan(1.5);
  });
});
