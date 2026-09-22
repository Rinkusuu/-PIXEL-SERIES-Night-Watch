import type { Horizon } from './horizon';

/**
 * The near vignette — the thing the scene was missing.
 *
 * The reference frames its shot with near-black verticals: an ornate iron gas
 * standard, spear-topped railings, stone gate piers. That is what makes a
 * viewer feel they are STANDING somewhere rather than looking at a backdrop.
 * A stack of horizontal bands, however well drawn, never will.
 *
 * Everything here takes its ink as an argument and derives nothing from the
 * ambient palette. See `ladder.ts` for why the frame edge must stay fixed.
 *
 * Horizontal placement is expressed as fractions of WIDTH and owned here.
 * Vertical bounds are always fields of `Horizon` — never a new fraction, which
 * `tests/smoke.test.ts` enforces.
 */
export const GATE_X = { left: 0.038, right: 0.962 } as const;
export const STANDARD_X = 0.105;

/** How far the bracket arm reaches inward from the shaft, in shaft widths. */
const BRACKET_REACH = 3.2;
const SHAFT_W = 9;

const GATE_BARS = 7;
const GATE_PITCH = 11;
const PIER_W = 26;

/**
 * The ground each gate actually stands on, pier and open leaf together.
 *
 * `deck.ts` needs it to leave a hole in the balustrade — a run of stone posts
 * marching straight through a gateway says the ironwork is painted on. It has
 * to come from HERE, the module that draws the gate, or the hole drifts from
 * its own gate and reads as a missing post instead of as an opening.
 *
 * Asymmetric on purpose: the leaf is swung open INWARD against its pier, so
 * the ground it covers runs one way only. A clearance measured evenly either
 * side of the pier ate the frame edge and left the leaf's far end standing on
 * balusters.
 */
export function gateSpans(w: number): { x0: number; x1: number }[] {
  const reach = 20 + (GATE_BARS - 1) * GATE_PITCH + 6;
  const l = w * GATE_X.left;
  const r = w * GATE_X.right;
  return [
    { x0: l - PIER_W / 2 - 6, x1: l + reach },
    { x0: r - reach, x1: r + PIER_W / 2 + 6 },
  ];
}

/**
 * Where the flame hangs. `bloom.ts` reads this so the never-extinguished lamp
 * (addendum §D.1) lands inside its own glass housing instead of floating beside
 * it — the same one-source rule as `lampSpots()`.
 */
export function lanternAnchor(w: number, hz: Horizon): { x: number; y: number } {
  return {
    x: Math.round(w * STANDARD_X + SHAFT_W * BRACKET_REACH),
    y: Math.round(hz.bridgeTop + (hz.deckTop - hz.bridgeTop) * 0.22),
  };
}

/**
 * The nearest and hardest object in the picture, and until now a rectangle with
 * a ball on it.
 *
 * Everything in this module is painted in one flat `VIGNETTE_INK` and must stay
 * that way — it is the value anchor for the whole frame (`ladder.ts`). So none
 * of the detail below is a second value, a panel or a highlight; every piece of
 * it is a step in the OUTLINE. At this layer the silhouette is the only channel
 * there is, and a shape carries as much information as you cut into its edge.
 */
function gatePier(g: CanvasRenderingContext2D, cx: number, hz: Horizon): void {
  const pw = PIER_W;
  const x = cx - pw / 2;
  // Shaft, from the bottom of the frame to well above the parapet. A pier only
  // as tall as the railing disappears into the railing.
  g.fillRect(x, hz.waterTop, pw, hz.h - hz.waterTop);

  // Plinth, in two courses. One course is a thicker bottom; two is a base the
  // pier stands ON, and the difference is entirely in the extra step.
  g.fillRect(x - 5, hz.railBot, pw + 10, hz.deckTop - hz.railBot + 6);
  g.fillRect(x - 9, hz.railBot + 5, pw + 18, 5);

  // Cornice, also in two courses: a deep bed and a thinner fillet standing on
  // it. A single slab reads as a lid.
  g.fillRect(x - 4, hz.waterTop + 10, pw + 8, 7);
  g.fillRect(x - 7, hz.waterTop + 15, pw + 14, 4);

  // Necking — the narrow drum the ball sits on. Without it the ball grows
  // straight out of the cornice and the cap reads as a lump rather than as a
  // separate piece of stone.
  g.fillRect(cx - 6, hz.waterTop + 4, 12, 7);

  g.beginPath();
  g.arc(cx, hz.waterTop, 9, 0, Math.PI * 2);
  g.fill();
}

function gateLeaf(
  g: CanvasRenderingContext2D, fromX: number, dir: 1 | -1, hz: Horizon,
): void {
  // Swung OPEN, flat against the pier. An arched gate would fight the bridge's
  // arches, and two curved framings in one picture weaken each other.
  const bars = GATE_BARS;
  const pitch = GATE_PITCH;
  const top = hz.railTop;
  const bot = hz.deckTop;
  for (let i = 0; i < bars; i++) {
    const x = fromX + dir * i * pitch;
    g.fillRect(x - 1.5, top, 3, bot - top);
    // Spear head.
    g.beginPath();
    g.moveTo(x - 4, top);
    g.lineTo(x, top - 11);
    g.lineTo(x + 4, top);
    g.closePath();
    g.fill();
  }
  // Two rails, not one. A wrought gate is always framed top AND bottom — the
  // bars are threaded through both, and with only the upper one the leaf reads
  // as a row of loose spears leaning on a pier rather than as one object. The
  // lower rail sits well up from the foot, where a gate's actually is.
  const railX = fromX + Math.min(0, dir * bars * pitch);
  const railW = bars * pitch;
  g.fillRect(railX, top + 6, railW, 3);
  g.fillRect(railX, bot - 14, railW, 3);
}

/**
 * A tapered ribbon laid along a cubic Bézier, offset along the curve's NORMAL.
 *
 * The naive way to give a curve thickness is to draw it twice with the second
 * copy nudged down a few pixels. That is only correct where the curve runs
 * horizontally; everywhere else the nudge is measured in the wrong direction
 * and the ribbon swells and pinches with the slope. Offsetting along the normal
 * is measured perpendicular to the curve everywhere, so the width you ask for
 * is the width you see.
 *
 * `steps` is 24 because the arm is about a hundred pixels long and this layer
 * is a silhouette — the outline is the only channel it has, so a facet the eye
 * can catch is a real defect here in a way it would not be on the plate.
 */
function scroll(
  g: CanvasRenderingContext2D,
  p0: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  p3: { x: number; y: number },
  w0: number,
  w1: number,
  steps = 24,
): void {
  const near: { x: number; y: number }[] = [];
  const far: { x: number; y: number }[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x;
    const y = u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y;
    // The derivative, for the tangent. Both ends of this curve have their
    // control point directly above them, so the tangent there is vertical and
    // the normal is horizontal — which is what makes the arm meet the shaft and
    // the lantern squarely instead of at a slice.
    const dx = 3 * u * u * (c1.x - p0.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (p3.x - c2.x);
    const dy = 3 * u * u * (c1.y - p0.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (p3.y - c2.y);
    const len = Math.hypot(dx, dy) || 1;
    const half = (w0 + (w1 - w0) * t) / 2;
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;
    near.push({ x: x + nx, y: y + ny });
    far.push({ x: x - nx, y: y - ny });
  }

  g.beginPath();
  g.moveTo(near[0]!.x, near[0]!.y);
  for (const p of near.slice(1)) g.lineTo(p.x, p.y);
  for (const p of far.reverse()) g.lineTo(p.x, p.y);
  g.closePath();
  g.fill();
}

function gasStandard(g: CanvasRenderingContext2D, w: number, hz: Horizon): void {
  const cx = w * STANDARD_X;
  const top = hz.bridgeTop;

  // Fluted shaft, tapering.
  g.beginPath();
  g.moveTo(cx - SHAFT_W / 2, top);
  g.lineTo(cx + SHAFT_W / 2, top);
  g.lineTo(cx + SHAFT_W, hz.deckTop);
  g.lineTo(cx - SHAFT_W, hz.deckTop);
  g.closePath();
  g.fill();

  // Base: stepped plinth.
  g.fillRect(cx - SHAFT_W * 1.9, hz.deckTop - 14, SHAFT_W * 3.8, 14);
  g.fillRect(cx - SHAFT_W * 2.4, hz.deckTop - 5, SHAFT_W * 4.8, 9);

  // The lamplighter's ladder rest: a crossbar through the shaft, projecting
  // both sides, a little below the crown. It is the one piece of a gas standard
  // that exists purely because a person has to climb it every evening and every
  // morning, and that is exactly why it belongs — the rest of this object could
  // have been cast for decoration, but nobody bolts a rest bar to an ornament.
  const restY = top + 30;
  g.fillRect(cx - SHAFT_W * 1.7, restY, SHAFT_W * 3.4, 3);
  // Two short stops turned up at the ends, so a ladder set against it cannot
  // slide off sideways. Three pixels each, and they are what stop the bar
  // reading as a stray horizontal line across the shaft.
  for (const s of [-1, 1]) {
    g.fillRect(cx + s * SHAFT_W * 1.7 - (s > 0 ? 3 : 0), restY - 4, 3, 5);
  }

  // The capital the neck springs from.
  //
  // This was an acanthus: two leaves curling outward, each a pair of quadratics
  // sixteen pixels across. Acanthus is a foliage carved in a dozen overlapping
  // lobes, and none of that survives at a scale where the whole shaft is nine
  // pixels wide — it came out as two sharp blades crossing the post, and it was
  // the actual thing that looked wrong at the top of this lamp, not the arm.
  //
  // At this size a capital has exactly one legible property: it is WIDER than
  // what it caps, and it steps. So it is drawn as what it reads as — an
  // abacus, an echinus, a neck band — and nothing is attempted that the pixels
  // cannot hold. See the halo-dither note in `dither.ts`: the same lesson.
  for (const [dy, hgt, wide] of [[-3, 4, 0.75], [1, 4, 1.15], [5, 5, 0.85]] as const) {
    g.fillRect(cx - SHAFT_W * wide, top + dy, SHAFT_W * wide * 2, hgt);
  }

  // The swan neck.
  //
  // This was two quadratics sharing endpoints and control points six pixels
  // apart, which is not an outline of anything — it is the same curve drawn
  // twice at slightly different heights. Thickness in a shape like that is
  // whatever falls out of the geometry: measured PERPENDICULAR to the curve it
  // came out fat where the arm ran steeply and pinched to nothing across the
  // top, so the arm read as a lump over the post rather than as iron.
  //
  // It was also a single arc. A swan neck is an OGEE — it leaves the shaft
  // going straight up and arrives over the lantern going straight down, and the
  // two quarter-turns between are the whole character of the thing. One arc
  // leaves the post sideways and meets the lantern sideways, and that is the
  // reason it looked like a handle bolted on rather than a neck grown out.
  //
  // So: a real offset ribbon along a cubic, the same technique bridge.ts uses
  // for the voussoir ring. The control points sit directly above the two ends,
  // which is what forces both tangents vertical.
  const anchor = lanternAnchor(w, hz);
  const armEndY = anchor.y - 22;
  const apexY = top - 18;
  scroll(
    g,
    { x: cx, y: top - 2 },
    { x: cx, y: apexY - 4 },
    { x: anchor.x, y: apexY },
    { x: anchor.x, y: armEndY },
    // Tapered, because cast iron is: the root carries the whole overhang and
    // the tip carries a lantern. An even ribbon reads as bent pipe.
    7, 4,
  );

  /* ── The lantern ───────────────────────────────────────────────────────────
     A FRAME, not a box.

     This was a solid tapered slab, and the vignette is drawn last — after the
     bloom pass — so the slab painted straight over its own flame. The light was
     never visible; all you ever saw was the halo leaking past the outline,
     which is why it read as a bucket on a stick with a spotlight under it.

     The addendum's rule is that an emissive thing is a HOLE in the layer in
     front of it. So the glass is left open and only the ironwork is drawn: four
     corner posts, a rail top and bottom, and one astragal across the middle.
     The flame `bloom.ts` already put at `lanternAnchor` now shows through the
     panes it is supposed to be behind. */
  const lx = anchor.x;
  const gTop = anchor.y - 15;
  const gBot = anchor.y + 12;
  const halfTop = 9;
  const halfBot = 7;

  // Corner posts, splayed with the taper so the cage reads as a truncated
  // pyramid rather than as a rectangle with a lid.
  for (const sgn of [-1, 1]) {
    for (let y = gTop; y < gBot; y++) {
      const t = (y - gTop) / (gBot - gTop);
      const half = halfTop + (halfBot - halfTop) * t;
      g.fillRect(Math.round(lx + sgn * half) - (sgn < 0 ? 0 : 2), y, 2, 1);
    }
  }
  // Rails and the one astragal. Three horizontals is a glazed lantern; two is
  // a crate.
  g.fillRect(lx - halfTop, gTop, halfTop * 2, 2);
  g.fillRect(lx - halfBot - 1, gBot - 2, (halfBot + 1) * 2, 3);
  const midY = Math.round(gTop + (gBot - gTop) * 0.55);
  g.fillRect(lx - 8, midY, 16, 1);

  // The cap: a vented crown with a finial. A gas lantern has to breathe or the
  // flame smothers, and the vent is the detail that says the thing burns.
  g.beginPath();
  g.moveTo(lx - 11, gTop);
  g.lineTo(lx, gTop - 9);
  g.lineTo(lx + 11, gTop);
  g.closePath();
  g.fill();
  g.fillRect(lx - 13, gTop - 2, 26, 3);
  g.fillRect(lx - 1, gTop - 14, 2, 6);

  // The drip pan under the glass, where the arm's bracket bolts on.
  g.fillRect(lx - halfBot - 3, gBot + 1, (halfBot + 3) * 2, 2);
}

function railFinials(g: CanvasRenderingContext2D, w: number, hz: Horizon): void {
  // The parapet runs smooth from edge to edge; this puts a vertical rhythm back
  // into the one line in the picture that has none. It sits exactly where the
  // glass panels rest, so it is always visible.
  const pitch = 84;
  for (let x = pitch / 2; x < w; x += pitch) {
    g.fillRect(x - 2, hz.railTop - 15, 4, 17);
    g.beginPath();
    g.moveTo(x - 5, hz.railTop - 14);
    g.lineTo(x, hz.railTop - 27);
    g.lineTo(x + 5, hz.railTop - 14);
    g.closePath();
    g.fill();
  }
}

/*
 * Overhanging branches used to live here and have been removed.
 *
 * They were the only part of the vignette drawn as STROKES rather than filled
 * blocks, and the only part that was not a near-black vertical — the addendum's
 * frame is a gas standard, spear-topped railings and stone gate piers, all of
 * them uprights. Thin diagonal lines with short diagonal twigs, at 45% alpha
 * over the one clean surface in the picture, did not read as boughs. They read
 * as a cobweb in the corner of the screen, or as scratches on the glass, and
 * they crossed a third of the sky to do it.
 *
 * The frame does not need them: three uprights already close all four edges.
 * Kept as a note rather than as dead code, because "add branches" is the kind
 * of idea that comes back.
 */

export function drawForeground(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  ink: string,
): void {
  g.save();
  g.fillStyle = ink;
  g.strokeStyle = ink;

  // Four framing objects would fight if they were stacked flat. Each gets its
  // own weight, nearest and hardest first — that layering IS the vignette.
  g.globalAlpha = 1;
  gatePier(g, w * GATE_X.left, hz);
  gatePier(g, w * GATE_X.right, hz);
  gateLeaf(g, w * GATE_X.left + 20, 1, hz);
  gateLeaf(g, w * GATE_X.right - 20, -1, hz);
  gasStandard(g, w, hz);

  g.globalAlpha = 0.92;
  railFinials(g, w, hz);

  g.restore();
}
