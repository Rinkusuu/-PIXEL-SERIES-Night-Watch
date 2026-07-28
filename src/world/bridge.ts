import type { Horizon } from './horizon';
import { HATCH_ANGLES, hatch } from './hatch';

/**
 * Rise of the arch as a fraction of its span. A semicircle rises by 0.5 and
 * reads as a Roman aqueduct; a Victorian Thames bridge is SEGMENTAL — a shallow
 * slice of a much larger circle. That flatness is most of what makes the
 * silhouette read as the right century.
 */
export const ARCH_RISE = 0.30;

/** Roughly how wide one span wants to be, before it is fitted to the frame. */
const SPAN_TARGET = 190;

export type Pier = { x: number; w: number; top: number; bot: number };

export function piers(w: number, hz: Horizon): Pier[] {
  const count = Math.max(2, Math.round(w / SPAN_TARGET) + 1);
  const step = w / (count - 1);
  const pw = Math.max(10, Math.round(step * 0.12));
  const out: Pier[] = [];
  for (let i = 0; i < count; i++) {
    // x is deliberately NOT rounded: rounding makes neighbouring spans differ by
    // a pixel, and a bridge whose arches are not all the same width reads as a
    // mistake rather than as a bridge. Canvas takes fractional coordinates.
    out.push({ x: i * step - pw / 2, w: pw, top: hz.bridgeTop, bot: hz.bridgeBot });
  }
  return out;
}

export type BridgeStyle = { fill: string; ink: string; density: number };

export function drawBridge(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  s: BridgeStyle,
): void {
  const p = piers(w, hz);
  const deckTop = hz.bridgeTop;
  const deckH = Math.max(8, Math.round((hz.bridgeBot - hz.bridgeTop) * 0.22));
  const springLine = deckTop + deckH;

  // The roadway, drawn as one solid band with the arch voids punched back out.
  // Punching is the trick: what reads as an arch is the SKY and the RIVER seen
  // through it, not any line we draw.
  g.save();
  g.beginPath();
  g.rect(0, deckTop, w, hz.bridgeBot - deckTop);

  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i]!;
    const b = p[i + 1]!;
    const x0 = a.x + a.w;
    const x1 = b.x;
    const span = x1 - x0;
    if (span <= 2) continue;
    const rise = span * ARCH_RISE;
    // Its own sub-path, so 'evenodd' subtracts it from the roadway band.
    g.moveTo(x0, hz.bridgeBot);
    g.lineTo(x0, springLine);
    g.quadraticCurveTo(x0 + span / 2, springLine - rise * 2, x1, springLine);
    g.lineTo(x1, hz.bridgeBot);
    g.closePath();
  }

  g.fillStyle = s.fill;
  g.fill('evenodd');
  g.save();
  g.clip('evenodd');
  hatch(g, 0, deckTop, w, hz.bridgeBot - deckTop, s.density, {
    angle: HATCH_ANGLES.mid, color: s.ink, maxGap: 10,
  });
  g.restore();
  g.restore();

  // Cutwaters — the pointed noses that split the current. Cheap, and they are
  // the difference between piers and posts.
  g.fillStyle = s.fill;
  for (const q of p) {
    const noseY = hz.bridgeBot;
    g.beginPath();
    g.moveTo(q.x, noseY - q.w * 1.4);
    g.lineTo(q.x + q.w / 2, noseY);
    g.lineTo(q.x + q.w, noseY - q.w * 1.4);
    g.closePath();
    g.fill();
  }

  // String course: two thin parallel lines along the roadway. Without them the
  // deck is a slab.
  g.strokeStyle = s.ink;
  g.lineWidth = 1;
  g.globalAlpha = 0.7;
  for (const y of [deckTop + 2, deckTop + deckH - 2]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  g.globalAlpha = 1;
}
