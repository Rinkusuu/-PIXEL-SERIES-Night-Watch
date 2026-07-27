export type Rgb = readonly [number, number, number];

export type Keyframe = {
  at: number;
  /** zenith, mid-band, horizon — three stops, never two (DNA §3.3) */
  sky: readonly [string, string, string];
  glow: string;
  accent: string;
  lum: number;
  ink: string;
  inkSoft: string;
};

export type GradeName = 'calm' | 'pressed' | 'bloodmoon';

export type GradeDef = {
  /** 0..1, pulls sky colours toward their own grey */
  desat: number;
  /** multiplier on sky lightness and lum; 1 = unchanged */
  dark: number;
  /** hex mixed into the key light, or null */
  tint: string | null;
  /** 0..1 strength of tint */
  tintAmt: number;
};

export type AmbientValues = {
  deep: string;
  mid: string;
  lift: string;
  glow: string;
  accent: string;
  ink: string;
  inkSoft: string;
  lum: number;
  sky: readonly [string, string, string];
};
