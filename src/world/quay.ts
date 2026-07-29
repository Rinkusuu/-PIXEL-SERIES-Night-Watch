import type { Horizon } from './horizon';

/**
 * The canal walls.
 *
 * The river used to run the full width of the frame with the city as a distant
 * band across it, so the water was a wide empty expanse and nothing stood close
 * enough to the viewer to have a lit window in it. These are terraces rising
 * straight out of the water at both edges, and what they leave between them is
 * a channel rather than an estuary.
 *
 * They are drawn in the LIVE pass, after the river. The river fills its whole
 * band opaquely over the plate every frame, so a wall painted on the plate
 * would be washed out below the waterline — the same trap the vignette and the
 * moored lighters both fell into. Drawing them over the water is also what
 * narrows it: they occlude it rather than sitting behind it.
 */

/** Width of each wall, as a fraction of the frame. */
export const QUAY_W = 0.115;

/** How many storeys step down toward the channel. */
const STEPS = 3;

const WIN_W = 4;
const WIN_H = 6;
const STOREY = 12;
const COL_PITCH = 10;

export type QuayWindow = { x: number; y: number; w: number; h: number };

/**
 * The stepped top edge of one wall, from the frame edge inward. Buildings that
 * get shorter as they run away from you is the whole of the recession here —
 * there is no vanishing point, and there does not need to be one.
 */
export function quaySteps(
  w: number, hz: Horizon, side: 'left' | 'right',
): { x: number; w: number; top: number }[] {
  const wall = Math.round(w * QUAY_W);
  const stepW = Math.round(wall / STEPS);
  const out: { x: number; w: number; top: number }[] = [];
  for (let i = 0; i < STEPS; i++) {
    // Nearest step is tallest. `cityTop` is the highest roof in the far city,
    // so starting a touch above it puts these in front of everything.
    const top = Math.round(hz.cityTop * (0.72 + i * 0.34));
    const x = side === 'left'
      ? i * stepW
      : w - (i + 1) * stepW;
    out.push({ x, w: stepW, top });
  }
  return out;
}

/**
 * Every window on both walls. Exported so `bloom.ts` can light a few from the
 * same list the plate draws dark — the one-source rule that `openings()` and
 * `lanternAnchor()` already follow.
 */
export function quayWindows(w: number, hz: Horizon): QuayWindow[] {
  const out: QuayWindow[] = [];
  for (const side of ['left', 'right'] as const) {
    for (const step of quaySteps(w, hz, side)) {
      const cols = Math.floor((step.w - 8 + (COL_PITCH - WIN_W)) / COL_PITCH);
      if (cols < 1) continue;
      const gridW = cols * COL_PITCH - (COL_PITCH - WIN_W);
      const sx = Math.round(step.x + (step.w - gridW) / 2);
      for (let y = step.top + 8; y + WIN_H <= hz.deckTop - 6; y += STOREY) {
        for (let c = 0; c < cols; c++) {
          out.push({ x: sx + c * COL_PITCH, y: Math.round(y), w: WIN_W, h: WIN_H });
        }
      }
    }
  }
  return out;
}

export type QuayStyle = {
  wall: string;
  /** Unlit windows, and the shadowed reveal under each cornice. */
  dark: string;
};

export function drawQuay(
  g: CanvasRenderingContext2D, w: number, hz: Horizon, s: QuayStyle,
): void {
  g.save();
  for (const side of ['left', 'right'] as const) {
    for (const step of quaySteps(w, hz, side)) {
      g.fillStyle = s.wall;
      g.fillRect(step.x, step.top, step.w, hz.deckTop - step.top);
      // A cornice band at the head of each step. Without it the three masses
      // merge into one flat wall and the recession is lost.
      g.fillStyle = s.dark;
      g.fillRect(step.x, step.top, step.w, 3);
    }
  }

  // Windows, cut dark. `bloom.ts` lights a handful of these from the same list.
  g.fillStyle = s.dark;
  for (const win of quayWindows(w, hz)) {
    g.fillRect(win.x, win.y, win.w, win.h);
  }
  g.restore();
}
