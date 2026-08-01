import type { Horizon } from './horizon';

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

/**
 * Thickness of the roadway slab, and so the line the arches are cut up TO.
 *
 * Exported because `bank.ts` has to build its quay to exactly this line. A
 * second copy of the number is a second chance for a strip of city storeys to
 * survive between the wall's coping and the arch crown — and a strip of
 * full-scale windows below the roadway is precisely what made the city read as
 * standing in the river. Same rule as `horizon()`, `setbackOf`, `eaveOf`.
 */
export function roadwayDepth(hz: Horizon): number {
  return Math.max(6, Math.round((hz.bridgeBot - hz.bridgeTop) * 0.16));
}

/** The highest point of an arch void — the underside of the roadway. */
export function archCrown(hz: Horizon): number {
  return hz.bridgeTop + roadwayDepth(hz);
}

/**
 * Height of a gas standard on the bridge, from the parapet to the flame.
 *
 * `bloom.ts` puts its `bridge` lamp spots at `bridgeTop - LAMP_H`, and this
 * module draws the post under them. One number, two readers — so it is exported
 * rather than written twice. `lanternAnchor()` exists for exactly this reason on
 * the near lantern; this is the same fact one depth further away.
 */
export const LAMP_H = 9;

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
  /** Haze seen THROUGH an arch, at the crown. */
  hazeTop: string;
  /**
   * …and at the springing, where it must be PALER than `hazeTop`, never darker.
   *
   * The bottom of an arch void is the waterline on the far bank — the furthest
   * point in the whole picture, and the height at which fog pools. Aerial
   * perspective takes it toward the fog. This stop used to be handed the
   * `deck` rung, the NEAREST value on the ladder, which made the bottom of
   * every arch darker than the stone around it: each opening read as a hole
   * into a cellar rather than a window onto distance.
   */
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
  const deckH = roadwayDepth(hz);
  // The arch is cut UP into the spandrel, so its crown sits just under the
  // roadway — not at some line partway down it.
  const crownY = archCrown(hz);

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
  //     It is a WASH now, not an opaque fill. The far bank is drawn behind these
  //     arches and an opaque haze painted it straight back out; distance is
  //     supposed to veil what is through an opening, not replace it.
  const haze = g.createLinearGradient(0, crownY, 0, hz.bridgeBot);
  haze.addColorStop(0, s.hazeTop);
  haze.addColorStop(1, s.hazeBot);
  //     Light: the quay behind these arches is dressed stone with a coping, a
  //     wet foot and water stairs on it, and at 0.42 the wash flattened all
  //     three into one bar of colour. Haze is supposed to veil an opening, not
  //     erase what is in it.
  g.save();
  g.globalAlpha = 0.24;
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

  // Gas standards, one over each pier. `bloom.ts` has been putting a flame at
  // `bridgeTop - LAMP_H` since the bridge was built and nothing was ever drawn
  // underneath it — so a dozen lights hung nine pixels above the parapet with
  // no object holding them up. It is the same fault that was fixed for the near
  // lantern in `7b5296b`, recurring one layer further back.
  //
  // Two pixels wide, and no wider: at three this reads as a chimney, and a row
  // of chimneys along a bridge parapet is worse than a row of floating flames.
  g.fillStyle = s.ink;
  for (const q of p) {
    const lx = Math.round(q.x + q.w / 2);
    g.fillRect(lx - 1, deckTop - LAMP_H, 2, LAMP_H);
    // The lantern housing the flame sits inside. 4x4 is the whole lamp at this
    // distance; larger and it becomes a pillar box on a stick.
    g.fillRect(lx - 2, deckTop - LAMP_H - 4, 4, 4);
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
