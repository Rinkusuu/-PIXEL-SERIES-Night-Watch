import { describe, expect, it } from 'vitest';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { GRADES, gradesFor } from '../../src/ambient/grade';
import { hexToRgb, luminance, resolve } from '../../src/ambient/interpolate';

describe('NIGHT_KEYS', () => {
  it('runs from 0 to 1 in ascending order', () => {
    expect(NIGHT_KEYS[0]!.at).toBe(0);
    expect(NIGHT_KEYS[NIGHT_KEYS.length - 1]!.at).toBe(1);
    for (let i = 1; i < NIGHT_KEYS.length; i++) {
      expect(NIGHT_KEYS[i]!.at).toBeGreaterThan(NIGHT_KEYS[i - 1]!.at);
    }
  });

  it('is unevenly spaced', () => {
    const gaps = NIGHT_KEYS.slice(1).map((k, i) => k.at - NIGHT_KEYS[i]!.at);
    const min = Math.min(...gaps);
    const max = Math.max(...gaps);
    expect(max - min).toBeGreaterThan(0.05);
  });

  it('brightens the key light in the thickest fog', () => {
    const fog = NIGHT_KEYS.find((k) => k.at === 0.62)!;
    const before = NIGHT_KEYS.find((k) => k.at === 0.35)!;
    expect(luminance(hexToRgb(fog.glow))).toBeGreaterThan(luminance(hexToRgb(before.glow)));
  });

  it('turns the key light cold only at dawn', () => {
    const cold = (hex: string) => hexToRgb(hex)[2] > hexToRgb(hex)[0];
    expect(cold(NIGHT_KEYS[NIGHT_KEYS.length - 1]!.glow)).toBe(true);
    for (const k of NIGHT_KEYS.slice(0, -1)) expect(cold(k.glow)).toBe(false);
  });

  it('uses no fully saturated colour', () => {
    for (const k of NIGHT_KEYS) {
      for (const hex of [...k.sky, k.glow, k.accent, k.ink, k.inkSoft]) {
        const [r, g, b] = hexToRgb(hex);
        const spread = Math.max(r, g, b) - Math.min(r, g, b);
        expect(spread).toBeLessThan(230);
      }
    }
  });
});

describe('the darkest reachable state', () => {
  it('never collapses to black', () => {
    // witching hour + bloodmoon + pressed is the worst combination that exists
    const v = resolve(NIGHT_KEYS, 0.85, gradesFor(['pressed', 'bloodmoon']));
    expect(luminance(hexToRgb(v.deep))).toBeGreaterThan(4);
    // and the lantern stays fully lit — addendum §D.1
    expect(luminance(hexToRgb(v.glow))).toBeGreaterThan(120);
  });

  it('keeps body text legible against the panel at every point', () => {
    for (const grades of [['calm'], ['pressed'], ['bloodmoon'], ['pressed', 'bloodmoon']] as const) {
      for (let at = 0; at <= 1.0001; at += 0.05) {
        const v = resolve(NIGHT_KEYS, at, gradesFor(grades));
        const contrast = luminance(hexToRgb(v.ink)) - luminance(hexToRgb(v.deep));
        expect(contrast).toBeGreaterThan(120);
      }
    }
  });
});

describe('gradesFor', () => {
  it('falls back to calm when nothing is active', () => {
    expect(gradesFor([])).toEqual([GRADES.calm]);
  });
  it('preserves order for stacking', () => {
    expect(gradesFor(['pressed', 'bloodmoon'])).toEqual([GRADES.pressed, GRADES.bloodmoon]);
  });
});
