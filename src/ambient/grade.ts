import type { GradeDef, GradeName } from './types';

/** Spec §4.3. `pressed` and `bloodmoon` stack; their effects compound. */
export const GRADES: Record<GradeName, GradeDef> = {
  calm:      { desat: 0,    dark: 1,    tint: null,      tintAmt: 0    },
  pressed:   { desat: 0.18, dark: 0.92, tint: null,      tintAmt: 0    },
  bloodmoon: { desat: 0.10, dark: 0.88, tint: '#8c2f3a', tintAmt: 0.16 },
};

export function gradesFor(names: readonly GradeName[]): GradeDef[] {
  return names.length === 0 ? [GRADES.calm] : names.map((n) => GRADES[n]);
}
