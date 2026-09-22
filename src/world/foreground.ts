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

/**
 * The standards along the near rail.
 *
 * `bloom.ts` was lighting five lamps here that nothing drew. Five flames hung
 * in the air over the balustrade with no post under any of them — the same
 * fault as the lantern painting over its own flame, in the other direction:
 * there, ironwork with no light; here, light with no ironwork.
 *
 * So the positions live HERE, in the module that draws the posts, and bloom
 * reads them. Two copies of these numbers is a flame beside its own lamp, and
 * the river reflects whatever this list says, so a drift would put the
 * reflection under a lamp that is not there.
 *
 * Spacing clears both gates. At `0.18 + k * 0.19` the last one landed at 0.94,
 * two per cent from the right gate pier, and the two read as one object.
 */
export function railStandards(
  w: number, hz: Horizon,
): { x: number; y: number; arc: boolean }[] {
  return Array.from({ length: 5 }, (_, k) => {
    // The two at the FAR end are electric: the new lamps went up from one end
    // of the Embankment, so a mixed row is a row caught mid-replacement.
    const arc = k >= 3;
    return {
      x: Math.round(w * (0.20 + k * 0.165)),
      // The head, which is where the light goes — not the base. An arc lamp
      // stood taller than the gas it replaced, and it is the only difference
      // the two can show at this size beyond the colour.
      y: hz.railTop - (arc ? RAIL_ARC_H : RAIL_GAS_H),
      arc,
    };
  });
}

/** Head heights above the parapet coping. Clear of the spear finials at 27. */
const RAIL_GAS_H = 36;
const RAIL_ARC_H = 46;

/** How far the bracket arm reaches inward from the shaft, in shaft widths. */
const BRACKET_REACH = 3.4;
/**
 * Nine, before the ironwork arrived.
 *
 * The scroll and the crowned lantern below are not decoration that can be
 * scaled down with the object: a volute needs enough pixels to turn in or it is
 * a blob, and a three-tier cap needs three steps that can be told apart. This
 * is the nearest object in the frame and the one the eye lands on first, so the
 * room it takes is room well spent. The acanthus failed for exactly the
 * opposite reason — detail asked of pixels that were not there.
 */
const SHAFT_W = 11;

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

type Pt = { x: number; y: number };

/**
 * A tapered ribbon laid along a centreline, offset along the curve's NORMAL.
 *
 * The naive way to give a curve thickness is to draw it twice with the second
 * copy nudged down a few pixels. That is only correct where the curve runs
 * horizontally; everywhere else the nudge is measured in the wrong direction
 * and the ribbon swells and pinches with the slope. Offsetting along the normal
 * is measured perpendicular to the curve everywhere, so the width you ask for
 * is the width you see.
 *
 * The direction at each point comes from its NEIGHBOURS rather than from an
 * analytic derivative, which is what lets one function serve both the neck's
 * Bézier and the volute's spiral — and what makes it correct at the ends of
 * either, where a one-sided difference is the only direction there is.
 */
function ribbon(
  g: CanvasRenderingContext2D, pts: readonly Pt[], w0: number, w1: number,
): void {
  if (pts.length < 2) return;
  const near: Pt[] = [];
  const far: Pt[] = [];

  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const t = i / (pts.length - 1);
    const half = (w0 + (w1 - w0) * t) / 2;
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;
    near.push({ x: pts[i]!.x + nx, y: pts[i]!.y + ny });
    far.push({ x: pts[i]!.x - nx, y: pts[i]!.y - ny });
  }

  g.beginPath();
  g.moveTo(near[0]!.x, near[0]!.y);
  for (const p of near.slice(1)) g.lineTo(p.x, p.y);
  for (const p of far.reverse()) g.lineTo(p.x, p.y);
  g.closePath();
  g.fill();
}

/**
 * `steps` is 26 because the neck is about a hundred pixels long and this layer
 * is a silhouette — the outline is the only channel it has, so a facet the eye
 * can catch is a real defect here in a way it would not be on the plate.
 */
function bezier(p0: Pt, c1: Pt, c2: Pt, p3: Pt, steps = 26): Pt[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
    };
  });
}

/**
 * A spiral, for the wrought-iron volutes the reference brackets are built from.
 *
 * Radius shrinks as the angle turns, so the curl tightens the way hammered iron
 * does — a constant-radius arc is a hook, not a scroll. One turn is the most
 * that survives: at a second turn the arms of the spiral land within a pixel of
 * each other and the whole thing fills in solid.
 */
function spiral(
  at: Pt, a0: number, a1: number, r0: number, r1: number, steps = 22,
): Pt[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const a = a0 + (a1 - a0) * t;
    const r = r0 + (r1 - r0) * t;
    return { x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r };
  });
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

  // Base: a moulded plinth, not two stacked slabs. The reference posts all
  // swell toward the ground through a torus and a step — a column that meets
  // the pavement at a right angle reads as scaffolding.
  const bw = (k: number) => SHAFT_W * k;
  g.beginPath();
  g.moveTo(cx - bw(1.1), hz.deckTop - 26);
  g.lineTo(cx + bw(1.1), hz.deckTop - 26);
  g.lineTo(cx + bw(1.8), hz.deckTop - 14);
  g.lineTo(cx - bw(1.8), hz.deckTop - 14);
  g.closePath();
  g.fill();
  g.fillRect(cx - bw(1.9), hz.deckTop - 15, bw(3.8), 6);
  g.fillRect(cx - bw(2.4), hz.deckTop - 9, bw(4.8), 13);

  // Knops: the cast collars a fluted shaft is broken into. Two of them, because
  // an unbroken taper forty pixels tall is a pole, and the bands are the only
  // thing at this scale that says the shaft was cast in sections.
  //
  // Width follows the taper rather than being fixed — a constant collar reads
  // as thicker at the top of the post than at the bottom, which is backwards.
  const shaftHalf = (y: number) =>
    SHAFT_W / 2 + (SHAFT_W - SHAFT_W / 2) * ((y - top) / (hz.deckTop - top));
  for (const f of [0.34, 0.66]) {
    const y = top + (hz.deckTop - top) * f;
    const half = shaftHalf(y);
    g.fillRect(cx - half - 3, y, (half + 3) * 2, 3);
    g.fillRect(cx - half - 1, y + 3, (half + 1) * 2, 2);
  }

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
  const armEndY = anchor.y - 26;
  const apexY = top - 22;
  const reach = anchor.x - cx;
  ribbon(
    g,
    bezier(
      { x: cx, y: top - 2 },
      { x: cx, y: apexY - 5 },
      { x: anchor.x, y: apexY },
      { x: anchor.x, y: armEndY },
    ),
    // Tapered, because cast iron is: the root carries the whole overhang and
    // the tip carries a lantern. An even ribbon reads as bent pipe.
    8, 4,
  );

  /* ── The scrollwork ───────────────────────────────────────────────────────
     What the reference brackets actually are.

     A plain ogee is a pipe bent twice. Every one of these lamps carries volutes
     in the crotch — they are structural, bracing the overhang, and they are the
     first thing the eye reads as WROUGHT rather than cast. Drawn as ribbons
     along spirals, so they are the same kind of object as the neck itself and
     taper into it instead of being stuck on.

     One turn each and no more. At a second turn the arms of the spiral land
     within a pixel of each other and the curl fills in solid — the acanthus
     lesson again, in the one place where the detail does survive if it is asked
     for honestly. */
  /* One scroll that SPANS the arch, not a curl parked in the middle of it.

     Three versions got here. A fat spiral centred twelve pixels off the post
     swallowed the capital and the rest bar and read as a blob with a hole in
     it. Thinning it and moving it clear fixed the blob and produced a shape
     touching nothing at either end — which the eye read as a letter P hanging
     in the gap, because an iron scroll that floats is not iron.

     What the reference brackets actually are: ONE stroke springing off the
     neck near the apex, sweeping down across the open triangle and tightening
     into a volute beside the post. It fills the arch because it is welded to
     both sides of it, and it tapers into the neck because it is the same kind
     of object drawn the same way. */
  // Stopped short of a full turn. Swept all the way round, the scroll's outer
  // arc ran parallel to the neck above it and the two together closed into a
  // ring — a monocle bolted to a post. A scroll is a C; the gap is what says
  // which way the iron was bent.
  const eye = { x: cx + reach * 0.36, y: top + 8 };
  ribbon(g, spiral(eye, -Math.PI * 0.42, Math.PI * 0.80, 20, 3), 5, 1.5);
  // The stub that welds the volute's eye back to the shaft. Short and level:
  // everything else here curves, and one straight member is what makes the
  // curves read as chosen rather than as the only thing the draughtsman knew.
  g.fillRect(cx + 2, top + 6, reach * 0.36 - 2, 4);

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
  const gTop = anchor.y - 18;
  const gBot = anchor.y + 16;
  const halfTop = 12;
  const halfBot = 8;

  // Corner posts, splayed with the taper so the cage reads as a truncated
  // pyramid rather than as a rectangle with a lid. The taper is the whole
  // silhouette of a gas lantern — wide at the shoulder, narrow at the pan —
  // and a straight-sided box reads as a tin.
  const halfAt = (y: number) =>
    halfTop + (halfBot - halfTop) * ((y - gTop) / (gBot - gTop));
  for (const sgn of [-1, 1]) {
    for (let y = gTop; y < gBot; y++) {
      const half = halfAt(y);
      g.fillRect(Math.round(lx + sgn * half) - (sgn < 0 ? 0 : 2), y, 2, 1);
    }
  }

  // Glazing bars. One across and one down: four panes, which is what the
  // reference lanterns are glazed as, and what makes the light read as coming
  // through GLASS rather than out of a hole.
  //
  // One pixel each, and no more. The housing painting over its own flame is the
  // fault this whole object was rebuilt to fix — see the note above — so every
  // line laid across the glass has to earn the light it costs.
  const midY = Math.round(gTop + (gBot - gTop) * 0.42);
  g.fillRect(lx - Math.round(halfAt(midY)), midY, Math.round(halfAt(midY)) * 2, 1);
  g.fillRect(lx, gTop, 1, gBot - gTop);

  // The shoulder: a cornice that OVERHANGS the glass. Every lantern in the
  // reference has one, and it is what stops the cap looking like a hat resting
  // on the box — rain runs off an eave, not off a join.
  g.fillRect(lx - halfTop - 3, gTop - 3, (halfTop + 3) * 2, 4);

  // The crown, in three tiers. Not a single triangle: a gas lantern's cap is a
  // stepped ogee with a vent under each step, because the flame has to breathe
  // or it smothers, and the steps are the only part of that a silhouette can
  // show.
  for (const [dy, hgt, wide] of [[-9, 6, 10], [-13, 4, 6], [-16, 3, 3]] as const) {
    g.beginPath();
    g.moveTo(lx - wide - 2, gTop + dy + hgt);
    g.lineTo(lx - wide, gTop + dy);
    g.lineTo(lx + wide, gTop + dy);
    g.lineTo(lx + wide + 2, gTop + dy + hgt);
    g.closePath();
    g.fill();
  }

  // No finial on top. There was one, and the neck came down through it: a
  // hanging lantern has a bracket where a standing one has an ornament, and the
  // reference photographs show exactly that — the scroll IS the top of it.

  // The pan, and the drop finial under it. A lantern hangs; it needs a point at
  // the bottom for the eye to hang it from, and without one the whole thing
  // reads as sitting on an invisible shelf.
  g.fillRect(lx - halfBot - 3, gBot, (halfBot + 3) * 2, 3);
  g.beginPath();
  g.moveTo(lx - halfBot + 1, gBot + 3);
  g.lineTo(lx + halfBot - 1, gBot + 3);
  g.lineTo(lx + 2, gBot + 8);
  g.lineTo(lx - 2, gBot + 8);
  g.closePath();
  g.fill();
  g.fillRect(lx - 2, gBot + 8, 4, 3);
  g.fillRect(lx - 1, gBot + 11, 2, 3);
}

/**
 * The posts those five lights sit on.
 *
 * Small — a tenth of the near lantern — so everything here is the fewest fills
 * that still read. The heads are OPEN at the centre, for the reason the near
 * lantern is: this layer is drawn last, over the bloom, and a solid head would
 * paint out the flame it is supposed to be holding.
 */
function railLamps(g: CanvasRenderingContext2D, w: number, hz: Horizon): void {
  for (const s of railStandards(w, hz)) {
    const base = hz.railTop + 6;
    // Tapered shaft. Three pixels at the head, five at the foot.
    g.beginPath();
    g.moveTo(s.x - 1.5, s.y);
    g.lineTo(s.x + 1.5, s.y);
    g.lineTo(s.x + 2.5, base);
    g.lineTo(s.x - 2.5, base);
    g.closePath();
    g.fill();
    // A collar, and a foot spreading onto the coping.
    g.fillRect(s.x - 3, s.y + 12, 6, 2);
    g.fillRect(s.x - 4, base - 3, 8, 3);

    if (s.arc) {
      // An arc lamp hangs from a cross-arm inside a wire guard. Two droppers
      // either side and nothing across the middle: the guard is wire, the eye
      // fills it in, and anything actually drawn there would be in front of
      // the light.
      g.fillRect(s.x - 6, s.y - 2, 12, 2);
      for (const d of [-6, 4]) g.fillRect(s.x + d, s.y, 2, 7);
      g.fillRect(s.x - 6, s.y + 7, 12, 2);
      // The finial over the arm.
      g.fillRect(s.x - 1, s.y - 6, 2, 4);
    } else {
      // A small gas lantern: a cap, two uprights, a pan. Four fills, and the
      // flame shows between them.
      g.fillRect(s.x - 5, s.y - 3, 10, 2);
      g.fillRect(s.x - 4, s.y - 1, 1, 8);
      g.fillRect(s.x + 3, s.y - 1, 1, 8);
      g.fillRect(s.x - 5, s.y + 7, 10, 2);
      g.fillRect(s.x - 1, s.y - 6, 2, 3);
    }
  }
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
  // After the finials, at the same slight remove: these stand on the same
  // parapet and belong to the same depth. Full ink would make five small posts
  // read as near as the gate piers, which are four times their size.
  railLamps(g, w, hz);

  g.restore();
}
