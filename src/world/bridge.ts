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

/**
 * How far a pedestrian refuge lifts the parapet over its pier.
 *
 * Exported because the gas standard stands ON the refuge, and `bloom.ts` puts
 * the flame above the standard. Three modules, one number — rule A, and the
 * fourth time this file has had to export a line for it.
 */
export const REFUGE_H = 4;

export type BridgeStyle = {
  fill: string;
  ink: string;
  /** One rung lighter: coping, alternate voussoirs, the refuge's cap. */
  lit: string;
  /** One rung darker: the parapet's panels and the roadway's base course. */
  shade: string;
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

  // 2 — the roadway, one solid band with the arch voids punched back out, and
  //     the pedestrian refuges standing proud of it over each pier.
  //
  //     The refuges are the only thing in this module that changes the bridge's
  //     SILHOUETTE, and a broken silhouette is most of what separates a
  //     Victorian river crossing from a plank. Four pixels: past that the deck
  //     goes from articulated to serrated.
  g.save();
  g.beginPath();
  g.rect(0, deckTop, w, hz.bridgeBot - deckTop);
  for (const q of p) {
    const cx = Math.round(q.x + q.w / 2);
    const rw = Math.round(q.w * 1.6);
    g.moveTo(cx - rw / 2, deckTop);
    g.lineTo(cx - rw / 2, deckTop - REFUGE_H);
    g.lineTo(cx + rw / 2, deckTop - REFUGE_H);
    g.lineTo(cx + rw / 2, deckTop);
    g.closePath();
  }
  for (const sp of spans) archPath(g, sp.x0, sp.x1, crownY, hz.bridgeBot);

  g.fillStyle = s.fill;
  g.fill('evenodd');
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

  // 3b — voussoirs: the ring of wedge stones the arch is actually built from.
  //      Every arch had exactly one pale line on it, which says "hole" but
  //      never says "built".
  //
  //      Sampled off `archCurve`, the same function the void, the punch-out and
  //      the intrados already read — rule A, and this curve is not getting a
  //      fourth definition of itself.
  //
  //      The count is forced ODD so there is a stone AT t = 0.5, on the crown.
  //      The eye goes looking for a keystone on any arch it is shown, and an
  //      even ring puts a joint where the keystone should be.
  //
  //      Alternating `fill` and `lit`, never `fill` and `ink`: at full contrast
  //      the ring stops reading as masonry and starts reading as a cog.
  for (const sp of spans) {
    const { span, springY, controlY } = archCurve(sp.x0, sp.x1, crownY);
    let n = Math.round(span / 7);
    if (n % 2 === 0) n += 1;
    n = Math.max(5, n);
    const mid = sp.x0 + span / 2;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const u = 1 - t;
      const px = u * u * sp.x0 + 2 * u * t * mid + t * t * sp.x1;
      const py = u * u * springY + 2 * u * t * controlY + t * t * springY;

      // Offset along the curve's NORMAL, not straight up. A ring laid out by
      // dropping every stone upward works at the crown, where the curve is flat,
      // and falls apart at the springings, where it is nearly vertical — the
      // stones there ended up sitting beside the arch like bolts rather than
      // around it. Tangent of a quadratic is 2(1-t)(C-P0) + 2t(P1-C); the normal
      // is that turned a quarter, and it points out of the void on its own at
      // every t.
      const tx = 2 * u * (mid - sp.x0) + 2 * t * (sp.x1 - mid);
      const ty = 2 * u * (controlY - springY) + 2 * t * (springY - controlY);
      const len = Math.hypot(tx, ty) || 1;
      const nx = ty / len;
      const ny = -tx / len;

      const keystone = i === (n - 1) / 2;
      // Alternating `lit` and `shade`, never `lit` and `fill`. Half the ring
      // used to be painted in the roadway's own value on top of the roadway,
      // so every other stone was invisible and what survived read as a handful
      // of studs rather than as an arch ring. Both values step off the stone;
      // neither steps far, because a full-contrast ring is a cog wheel.
      g.fillStyle = keystone ? s.lit : i % 2 === 0 ? s.lit : s.shade;
      const vw = keystone ? 4 : 3;
      const vh = keystone ? 5 : 4;
      const cx = px + nx * (vh / 2);
      const cy = py + ny * (vh / 2);
      g.fillRect(Math.round(cx - vw / 2), Math.round(cy - vh / 2), vw, vh);
    }
  }

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
  //
  // Standing on the REFUGE, not on the roadway. The refuge lifts the parapet
  // four pixels over every pier and the standards are over the piers, so a post
  // measured from `deckTop` would start four pixels inside the stone it is
  // supposed to be bolted to.
  g.fillStyle = s.ink;
  for (const q of p) {
    const lx = Math.round(q.x + q.w / 2);
    const base = deckTop - REFUGE_H;
    g.fillRect(lx - 1, base - LAMP_H, 2, LAMP_H);
    // The lantern housing the flame sits inside. 4x4 is the whole lamp at this
    // distance; larger and it becomes a pillar box on a stick.
    g.fillRect(lx - 2, base - LAMP_H - 4, 4, 4);
  }

  // The parapet. It was two hairline strokes along a slab, and that was the
  // entire content of the largest object in the middle distance.
  //
  // Coping, panels, base course — the three things every parapet has, as filled
  // blocks rather than lines (rule C). The refuges get their own coping four
  // pixels higher, or they read as blocks stuck on rather than as part of the
  // same wall.
  g.fillStyle = s.lit;
  g.fillRect(0, deckTop, w, 1);
  for (const q of p) {
    const cx = Math.round(q.x + q.w / 2);
    const rw = Math.round(q.w * 1.6);
    g.fillRect(Math.round(cx - rw / 2), deckTop - REFUGE_H, rw, 1);
  }

  // Panels, pitched off the PIERS rather than off the frame. A pitch that does
  // not divide the span leaves a half-panel against every pier, and a dozen
  // half-panels all cut on the same side make the whole bridge read as leaning.
  const panelTop = deckTop + 2;
  const panelH = Math.max(2, deckH - 5);
  g.fillStyle = s.shade;
  for (const sp of spans) {
    const span = sp.x1 - sp.x0;
    const n = Math.max(2, Math.round(span / 26));
    const pitch = span / n;
    for (let i = 0; i < n; i++) {
      // Inset each side, so what survives between two panels is a pilaster.
      const px = sp.x0 + pitch * i + 3;
      const pw = pitch - 6;
      if (pw < 3) continue;
      g.fillRect(Math.round(px), panelTop, Math.round(pw), panelH);
    }
  }

  // The base course the whole roadway sits on, in shadow — the same plinth the
  // city's flat blocks get, for the same reason.
  g.fillStyle = s.shade;
  g.fillRect(0, deckTop + deckH - 2, w, 2);
}
