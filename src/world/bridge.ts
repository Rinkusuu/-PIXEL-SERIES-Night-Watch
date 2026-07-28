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
const SPAN_TARGET = 120;

export type Pier = { x: number; w: number; top: number; bot: number };

export function piers(w: number, hz: Horizon): Pier[] {
  const count = Math.max(2, Math.round(w / SPAN_TARGET) + 1);
  const step = w / (count - 1);
  // Wide enough that the spandrel between two arches still reads as masonry.
  // Thin piers turn a bridge into a row of eggs.
  const pw = Math.max(10, Math.round(step * 0.22));
  const out: Pier[] = [];
  for (let i = 0; i < count; i++) {
    // x is deliberately NOT rounded: rounding makes neighbouring spans differ by
    // a pixel, and a bridge whose arches are not all the same width reads as a
    // mistake rather than as a bridge. Canvas takes fractional coordinates.
    out.push({ x: i * step - pw / 2, w: pw, top: hz.bridgeTop, bot: hz.bridgeBot });
  }
  return out;
}

export type BridgeStyle = {
  fill: string;
  ink: string;
  density: number;
  /** Haze seen THROUGH an arch: the sky's horizon stop at the crown… */
  hazeTop: string;
  /** …dropping to the river's own colour at the springing. */
  hazeBot: string;
};

/**
 * Traces one arch void. Shared by the haze fill, the roadway's punch-out, and
 * the intrados stroke — three copies of this curve is three chances for them to
 * disagree by a pixel and leave a seam.
 *
 * A quadratic's peak sits at the midpoint of its ends and its control point, so
 * the control goes at `crownY - rise` to put the actual crown ON `crownY`. Do
 * the naive thing and the crown overshoots the roadway it is cut into.
 */
function archCurve(x0: number, x1: number, crownY: number) {
  const span = x1 - x0;
  const rise = span * ARCH_RISE;
  return { span, rise, springY: crownY + rise, controlY: crownY - rise };
}

function archPath(
  g: CanvasRenderingContext2D,
  x0: number, x1: number, crownY: number, bot: number,
): void {
  const { span, springY, controlY } = archCurve(x0, x1, crownY);
  g.moveTo(x0, bot);
  g.lineTo(x0, springY);
  g.quadraticCurveTo(x0 + span / 2, controlY, x1, springY);
  g.lineTo(x1, bot);
  g.closePath();
}

export function drawBridge(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  s: BridgeStyle,
): void {
  const p = piers(w, hz);
  const deckTop = hz.bridgeTop;
  const deckH = Math.max(6, Math.round((hz.bridgeBot - hz.bridgeTop) * 0.16));
  // The arch is cut UP into the spandrel, so its crown sits just under the
  // roadway — not at some line partway down it.
  const crownY = deckTop + deckH;

  const spans: { x0: number; x1: number }[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const x0 = p[i]!.x + p[i]!.w;
    const x1 = p[i + 1]!.x;
    if (x1 - x0 > 2) spans.push({ x0, x1 });
  }

  // 1 — the haze BEHIND the arches. The bridge stands in front of the city's
  //     feet, so an unpainted void shows city through it and the arch vanishes
  //     into the same dark mass. What you actually see through an arch over a
  //     river at night is distance: pale at the crown, water at the springing.
  const haze = g.createLinearGradient(0, crownY, 0, hz.bridgeBot);
  haze.addColorStop(0, s.hazeTop);
  haze.addColorStop(1, s.hazeBot);
  g.save();
  g.beginPath();
  for (const sp of spans) archPath(g, sp.x0, sp.x1, crownY, hz.bridgeBot);
  g.fillStyle = haze;
  g.fill();
  g.restore();

  // 2 — the roadway, one solid band with the arch voids punched back out.
  g.save();
  g.beginPath();
  g.rect(0, deckTop, w, hz.bridgeBot - deckTop);
  for (const sp of spans) archPath(g, sp.x0, sp.x1, crownY, hz.bridgeBot);

  g.fillStyle = s.fill;
  g.fill('evenodd');
  g.save();
  g.clip('evenodd');
  hatch(g, 0, deckTop, w, hz.bridgeBot - deckTop, s.density, {
    angle: HATCH_ANGLES.mid, color: s.ink, maxGap: 10,
  });
  g.restore();
  g.restore();

  // 3 — the intrados, the curve's inner edge. One pale line is what tells the
  //     eye the opening is cut through something thick.
  g.save();
  g.strokeStyle = s.hazeTop;
  g.lineWidth = 1;
  g.globalAlpha = 0.45;
  for (const sp of spans) {
    const { span, springY, controlY } = archCurve(sp.x0, sp.x1, crownY);
    g.beginPath();
    g.moveTo(sp.x0, springY);
    g.quadraticCurveTo(sp.x0 + span / 2, controlY, sp.x1, springY);
    g.stroke();
  }
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
