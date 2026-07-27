import { gradesFor } from './grade';
import { resolve } from './interpolate';
import { NIGHT_KEYS } from './keyframes';
import type { AmbientValues, GradeName } from './types';

/**
 * Writing a custom property invalidates style for the whole subtree, and no eye
 * can follow colour faster than this. DNA §3.4 — 4 Hz, not per frame.
 */
const TICK_MS = 250;

export function writeAmbient(root: HTMLElement, v: AmbientValues): void {
  const s = root.style;
  s.setProperty('--amb-deep', v.deep);
  s.setProperty('--amb-mid', v.mid);
  s.setProperty('--amb-lift', v.lift);
  s.setProperty('--amb-glow', v.glow);
  s.setProperty('--amb-accent', v.accent);
  s.setProperty('--amb-ink', v.ink);
  s.setProperty('--amb-ink-soft', v.inkSoft);
  s.setProperty('--amb-lum', v.lum.toFixed(3));
}

export function startAmbientDriver(opts: {
  read: () => { progress: number; grades: readonly GradeName[] };
  onValues?: (v: AmbientValues) => void;
  root?: HTMLElement;
  intervalMs?: number;
}): () => void {
  const root = opts.root ?? document.documentElement;
  const every = opts.intervalMs ?? TICK_MS;

  const tick = () => {
    const { progress, grades } = opts.read();
    const v = resolve(NIGHT_KEYS, progress, gradesFor(grades));
    writeAmbient(root, v);
    opts.onValues?.(v);
  };

  tick();
  const id = setInterval(tick, every);
  return () => clearInterval(id);
}
