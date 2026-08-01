import type { Horizon } from './horizon';
import { gateSpans } from './foreground';

const BALUSTER_W = 8;
const BALUSTER_GAP = 6;

/**
 * Joint lines across the paving. They crowd together toward the parapet and
 * open out toward your feet — that spacing IS the perspective. Evenly spaced
 * rows read as a tiled floor seen from directly above.
 */
export function settRows(hz: Horizon): number[] {
  const top = hz.deckTop;
  const depth = hz.h - top;
  const rows: number[] = [];
  for (let i = 0; ; i++) {
    const f = Math.pow(i / 9, 1.7);
    const y = Math.round(top + depth * f);
    if (y > hz.h) break;
    rows.push(y);
    if (i > 40) break;
  }
  return rows;
}

/** One newel for every this many plain balusters. */
const NEWEL_EVERY = 7;
/** How much wider a newel is than the vases either side of it. */
const NEWEL_W = 13;

export type Baluster = { x: number; w: number; newel: boolean };

/**
 * The balustrade, edge to edge — except where the gate stands.
 *
 * Every post used to be identical, at one pitch, running clean through the two
 * gate openings as though the ironwork were painted onto the stone. Two things
 * fix that and both are structural rather than decorative:
 *
 * - **Newels.** A run of stone balusters is carried by a heavier post every few
 *   feet; without them the run has no rhythm and, more to the point, nothing
 *   holding it up. It is the same fault the skyline had before it got setbacks.
 * - **The gate opening.** Where the gate is, there is no balustrade — that is
 *   what a gate IS. The x's come from `foreground.ts`, which draws the gate,
 *   rather than from a second guess here (rule A): a gap that drifts from its
 *   own gate is worse than no gap, because it reads as a missing post.
 */
export function balusters(w: number): Baluster[] {
  const pitch = BALUSTER_W + BALUSTER_GAP;
  const out: Baluster[] = [];
  const gates = gateSpans(w);
  let i = 0;
  for (let x = 0; x < w + pitch; x += pitch, i++) {
    const newel = i % NEWEL_EVERY === 0;
    const bw = newel ? NEWEL_W : BALUSTER_W;
    if (gates.some((gt) => x + bw > gt.x0 && x < gt.x1)) continue;
    out.push({ x: Math.round(x), w: bw, newel });
  }
  return out;
}

export type DeckStyle = { fill: string; ink: string; rail: string };

export function drawDeck(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  s: DeckStyle,
): void {
  // 1 — the balustrade. This is the shelf the glass panels sit on, so it has to
  //     survive an 18px backdrop blur eating half its detail.
  const railH = hz.railBot - hz.railTop;
  const capH = Math.max(3, Math.round(railH * 0.18));
  const plinthH = Math.max(3, Math.round(railH * 0.16));

  g.fillStyle = s.rail;
  g.fillRect(0, hz.railTop, w, capH);
  g.fillRect(0, hz.railBot - plinthH, w, plinthH);

  const bodyTop = hz.railTop + capH;
  const bodyH = railH - capH - plinthH;
  for (const b of balusters(w)) {
    // A newel is a square pier, not a vase — that difference IS the rhythm.
    // Giving it the same profile at a larger size just reads as one baluster
    // that came out wrong.
    if (b.newel) {
      g.fillStyle = s.rail;
      g.fillRect(b.x, bodyTop - 2, b.w, bodyH + 4);
      g.fillRect(b.x - 2, bodyTop - 2, b.w + 4, 3);
      g.fillRect(b.x - 2, bodyTop + bodyH - 1, b.w + 4, 3);
      continue;
    }
    // A vase, not a post: narrow at the neck, swelling low. Two trapezoids are
    // enough at this size, and they survive the blur where a curve would not.
    const neck = b.w * 0.45;
    g.beginPath();
    g.moveTo(b.x + (b.w - neck) / 2, bodyTop);
    g.lineTo(b.x + (b.w + neck) / 2, bodyTop);
    g.lineTo(b.x + b.w, bodyTop + bodyH * 0.62);
    g.lineTo(b.x + b.w, bodyTop + bodyH);
    g.lineTo(b.x, bodyTop + bodyH);
    g.lineTo(b.x, bodyTop + bodyH * 0.62);
    g.closePath();
    g.fillStyle = s.rail;
    g.fill();
  }

  // 2 — the paving under your feet.
  g.fillStyle = s.fill;
  g.fillRect(0, hz.deckTop, w, hz.h - hz.deckTop);

  const rows = settRows(hz);
  g.strokeStyle = s.ink;
  g.lineWidth = 1;
  g.globalAlpha = 0.55;
  for (const y of rows) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }

  // Vertical joints, staggered every other row so the setts bond like brickwork.
  for (let i = 0; i < rows.length - 1; i++) {
    const y0 = rows[i]!;
    const y1 = rows[i + 1]!;
    const pitch = 26 + (y1 - y0) * 1.6;
    const offset = i % 2 === 0 ? 0 : pitch / 2;
    for (let x = offset; x < w; x += pitch) {
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x, y1);
      g.stroke();
    }
  }
  g.globalAlpha = 1;


  // 4 — furniture. A mooring ring and the bollard the never-extinguished
  //     lantern stands on (addendum §D.1).
  g.fillStyle = s.rail;
  const bollardX = Math.round(w * 0.08);
  const bollardH = Math.round(railH * 1.1);
  g.fillRect(bollardX - 7, hz.deckTop - bollardH, 14, bollardH);
  g.strokeStyle = s.ink;
  g.globalAlpha = 0.8;
  g.beginPath();
  g.arc(Math.round(w * 0.72), hz.railBot - plinthH / 2, 6, 0, Math.PI);
  g.stroke();
  g.globalAlpha = 1;
}
