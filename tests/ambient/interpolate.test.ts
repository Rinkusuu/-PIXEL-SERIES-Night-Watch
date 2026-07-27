import { describe, expect, it } from 'vitest';
import type { Keyframe, GradeDef } from '../../src/ambient/types';
import {
  smoothstep, hexToRgb, rgbToHex, mixRgb, desaturateRgb, scaleRgb,
  luminance, lerpKeyframe, resolve,
} from '../../src/ambient/interpolate';

const KEYS: Keyframe[] = [
  { at: 0,   sky: ['#000000', '#404040', '#808080'], glow: '#ff0000',
    accent: '#00ff00', lum: 0, ink: '#ffffff', inkSoft: '#cccccc' },
  { at: 0.5, sky: ['#101010', '#505050', '#909090'], glow: '#ee1111',
    accent: '#11ee11', lum: 0.5, ink: '#eeeeee', inkSoft: '#bbbbbb' },
  { at: 1,   sky: ['#202020', '#606060', '#a0a0a0'], glow: '#dd2222',
    accent: '#22dd22', lum: 1, ink: '#dddddd', inkSoft: '#aaaaaa' },
];

const CALM: GradeDef = { desat: 0, dark: 1, tint: null, tintAmt: 0 };

describe('smoothstep', () => {
  it('pins the ends and eases the middle', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(0.25)).toBeLessThan(0.25);
    expect(smoothstep(0.75)).toBeGreaterThan(0.75);
  });
});

describe('hex round trip', () => {
  it('parses and re-emits', () => {
    expect(hexToRgb('#ffb347')).toEqual([255, 179, 71]);
    expect(rgbToHex([255, 179, 71])).toBe('#ffb347');
    expect(rgbToHex(hexToRgb('#0e1218'))).toBe('#0e1218');
  });

  it('clamps out-of-range channels', () => {
    expect(rgbToHex([-20, 300, 128])).toBe('#00ff80');
  });
});

describe('mixRgb', () => {
  it('returns a at t=0 and b at t=1', () => {
    expect(mixRgb([0, 0, 0], [255, 255, 255], 0)).toEqual([0, 0, 0]);
    expect(mixRgb([0, 0, 0], [255, 255, 255], 1)).toEqual([255, 255, 255]);
  });
  it('interpolates linearly', () => {
    expect(mixRgb([0, 0, 0], [200, 100, 50], 0.5)).toEqual([100, 50, 25]);
  });
});

describe('desaturateRgb', () => {
  it('leaves colour untouched at 0 and greys it at 1', () => {
    expect(desaturateRgb([200, 100, 50], 0)).toEqual([200, 100, 50]);
    const grey = desaturateRgb([200, 100, 50], 1);
    expect(grey[0]).toBe(grey[1]);
    expect(grey[1]).toBe(grey[2]);
  });
});

describe('scaleRgb', () => {
  it('multiplies and clamps', () => {
    expect(scaleRgb([100, 100, 100], 0.5)).toEqual([50, 50, 50]);
    expect(scaleRgb([200, 200, 200], 2)).toEqual([255, 255, 255]);
  });
});

describe('lerpKeyframe', () => {
  it('returns the exact keyframe at a keyframe boundary', () => {
    expect(lerpKeyframe(KEYS, 0).sky[1]).toBe('#404040');
    expect(lerpKeyframe(KEYS, 1).sky[1]).toBe('#606060');
  });

  it('clamps outside the range instead of extrapolating', () => {
    expect(lerpKeyframe(KEYS, -3).sky[1]).toBe('#404040');
    expect(lerpKeyframe(KEYS, 9).sky[1]).toBe('#606060');
  });

  it('eases between keyframes rather than moving linearly', () => {
    // smoothstep(0.5) === 0.5, so the midpoint of a segment is the linear midpoint
    expect(lerpKeyframe(KEYS, 0.25).sky[1]).toBe('#484848');
    // a quarter into the segment must be nearer the start than linear would be
    const quarter = hexToRgb(lerpKeyframe(KEYS, 0.125).sky[1])[0];
    expect(quarter).toBeLessThan(0x40 + (0x50 - 0x40) * 0.25);
  });
});

describe('resolve', () => {
  it('keeps every surface dark at every point in the night', () => {
    for (let at = 0; at <= 1.0001; at += 0.05) {
      const v = resolve(KEYS, at, [CALM]);
      expect(luminance(hexToRgb(v.deep))).toBeLessThan(60);
      expect(luminance(hexToRgb(v.mid))).toBeLessThan(110);
    }
  });

  it('derives deep from the sky mid-band, not the zenith', () => {
    // zenith is pure black in KEYS; if deep came from it, the glow tint would
    // be the only colour present and the two would be identical
    const v = resolve(KEYS, 1, [CALM]);
    expect(v.deep).not.toBe(rgbToHex(mixRgb([0x20, 0x20, 0x20], [8, 8, 16], 0.72)));
  });

  it('leaves ink untouched by grade so contrast survives', () => {
    const calm = resolve(KEYS, 0.5, [CALM]);
    const dark = resolve(KEYS, 0.5, [{ desat: 0.5, dark: 0.5, tint: null, tintAmt: 0 }]);
    expect(dark.ink).toBe(calm.ink);
    expect(dark.inkSoft).toBe(calm.inkSoft);
  });

  it('stacks grades instead of replacing them', () => {
    const a: GradeDef = { desat: 0.2, dark: 0.9, tint: null, tintAmt: 0 };
    const b: GradeDef = { desat: 0.1, dark: 0.8, tint: null, tintAmt: 0 };
    const both = resolve(KEYS, 0.5, [a, b]);
    const onlyA = resolve(KEYS, 0.5, [a]);
    expect(luminance(hexToRgb(both.mid))).toBeLessThan(luminance(hexToRgb(onlyA.mid)));
  });

  it('tints only the key light', () => {
    const tinted = resolve(KEYS, 0.5, [
      { desat: 0, dark: 1, tint: '#0000ff', tintAmt: 0.5 },
    ]);
    const plain = resolve(KEYS, 0.5, [CALM]);
    expect(tinted.glow).not.toBe(plain.glow);
    expect(hexToRgb(tinted.glow)[2]).toBeGreaterThan(hexToRgb(plain.glow)[2]);
    expect(tinted.accent).toBe(plain.accent);
  });

  it('scales lum by the stacked dark factor', () => {
    const v = resolve(KEYS, 1, [{ desat: 0, dark: 0.5, tint: null, tintAmt: 0 }]);
    expect(v.lum).toBeCloseTo(0.5, 5);
  });
});
