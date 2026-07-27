import type { AmbientValues, GradeDef, Keyframe, Rgb } from './types';

/** DNA §3.3 — linear interpolation reads as a wipe. */
export const smoothstep = (t: number): number => t * t * (3 - 2 * t);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp255 = (v: number) => clamp(Math.round(v), 0, 255);

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function rgbToHex(rgb: Rgb): string {
  return '#' + rgb.map((c) => clamp255(c).toString(16).padStart(2, '0')).join('');
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** Rec. 601 weights — close enough to perceived brightness for a dark-floor check. */
export function luminance(rgb: Rgb): number {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
}

export function desaturateRgb(rgb: Rgb, amount: number): Rgb {
  const g = luminance(rgb);
  return mixRgb(rgb, [g, g, g], clamp(amount, 0, 1));
}

export function scaleRgb(rgb: Rgb, factor: number): Rgb {
  return [clamp255(rgb[0] * factor), clamp255(rgb[1] * factor), clamp255(rgb[2] * factor)];
}

/** The ink the chrome sinks toward. DNA §3.4. */
const INK_BLACK: Rgb = [8, 8, 16];

function mixHex(a: string, b: string, t: number): string {
  return rgbToHex(mixRgb(hexToRgb(a), hexToRgb(b), t));
}

export function lerpKeyframe(keys: readonly Keyframe[], at: number): Keyframe {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) throw new Error('lerpKeyframe: keys must not be empty');
  if (at <= first.at) return first;
  if (at >= last.at) return last;

  let i = 0;
  while (i < keys.length - 2 && at > keys[i + 1]!.at) i++;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const span = b.at - a.at || 1;
  const t = smoothstep(clamp((at - a.at) / span, 0, 1));

  return {
    at,
    sky: [
      mixHex(a.sky[0], b.sky[0], t),
      mixHex(a.sky[1], b.sky[1], t),
      mixHex(a.sky[2], b.sky[2], t),
    ],
    glow: mixHex(a.glow, b.glow, t),
    accent: mixHex(a.accent, b.accent, t),
    lum: a.lum + (b.lum - a.lum) * t,
    ink: mixHex(a.ink, b.ink, t),
    inkSoft: mixHex(a.inkSoft, b.inkSoft, t),
  };
}

export function resolve(
  keys: readonly Keyframe[],
  at: number,
  grades: readonly GradeDef[],
): AmbientValues {
  const k = lerpKeyframe(keys, at);

  // Grades stack: desaturation sums (clamped), darkening multiplies, tints apply
  // in order. Ink is deliberately excluded — dimming text is how this system
  // would fail its contrast checks.
  let desat = 0;
  let dark = 1;
  for (const g of grades) {
    desat += g.desat;
    dark *= g.dark;
  }
  desat = clamp(desat, 0, 1);

  const gradeSky = [
    rgbToHex(scaleRgb(desaturateRgb(hexToRgb(k.sky[0]), desat), dark)),
    rgbToHex(scaleRgb(desaturateRgb(hexToRgb(k.sky[1]), desat), dark)),
    rgbToHex(scaleRgb(desaturateRgb(hexToRgb(k.sky[2]), desat), dark)),
  ] as const;

  let glow = hexToRgb(k.glow);
  for (const g of grades) {
    if (g.tint) glow = mixRgb(glow, hexToRgb(g.tint), clamp(g.tintAmt, 0, 1));
  }
  const glowHex = rgbToHex(glow);

  // The mid band, not the zenith: at night the zenith is nearly achromatic and
  // its tint vanishes completely from the chrome. DNA §3.4.
  const base = hexToRgb(gradeSky[1]);
  const deep = mixRgb(base, INK_BLACK, 0.72);
  const deepTinted = mixRgb(deep, glow, 0.06);

  return {
    deep: rgbToHex(deepTinted),
    mid: rgbToHex(mixRgb(base, INK_BLACK, 0.42)),
    lift: rgbToHex(mixRgb(mixRgb(base, INK_BLACK, 0.3), glow, 0.22)),
    glow: glowHex,
    accent: k.accent,
    ink: k.ink,
    inkSoft: k.inkSoft,
    lum: clamp(k.lum * dark, 0, 1),
    sky: gradeSky,
  };
}
