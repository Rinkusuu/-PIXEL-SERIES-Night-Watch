import type { Horizon } from './horizon';
import { stream } from './rng';

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

  // Acanthus crown — leaves curling outward under the arm.
  const crownY = top + 16;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx, crownY - 12);
    g.quadraticCurveTo(cx + s * 16, crownY - 8, cx + s * 11, crownY + 7);
    g.quadraticCurveTo(cx + s * 6, crownY - 1, cx, crownY - 12);
    g.fill();
  }

  // Bracket arm, curving inward to carry the lantern.
  const anchor = lanternAnchor(w, hz);
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx, top + 6);
  g.quadraticCurveTo(cx + (anchor.x - cx) * 0.55, top - 6, anchor.x, anchor.y - 18);
  g.stroke();

  // Lantern housing: a tapered glass box under the arm. The flame itself is
  // drawn by bloom.ts, which reads `lanternAnchor` for exactly this reason.
  g.beginPath();
  g.moveTo(anchor.x - 9, anchor.y - 16);
  g.lineTo(anchor.x + 9, anchor.y - 16);
  g.lineTo(anchor.x + 7, anchor.y + 12);
  g.lineTo(anchor.x - 7, anchor.y + 12);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(anchor.x - 11, anchor.y - 16);
  g.lineTo(anchor.x, anchor.y - 27);
  g.lineTo(anchor.x + 11, anchor.y - 16);
  g.closePath();
  g.fill();
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

/**
 * Overhanging branches at the two top corners.
 *
 * Every number here used to be fixed: three limbs at 4, 30 and 56, reaching
 * 130, 96 and 62, with two twigs on each at t = 0.4 and t = 0.72 — the same on
 * the left as on the right, every night, at every size. Two mirrored copies of
 * one diagram is what the eye actually notices, because a tree is the one thing
 * in the picture it has a lifetime of experience being irregular.
 *
 * Seeded from the frame rather than from `nightKey()` on purpose. These are the
 * shape of the place you stand in, not the weather: the same window should show
 * the same tree all week, and a resize is already allowed to reshape the
 * skyline for the same reason.
 */
function branches(g: CanvasRenderingContext2D, w: number, hz: Horizon): void {
  const r = stream(Math.round(w * 41 + hz.h));
  g.lineWidth = 2;
  for (const side of [0, 1]) {
    const rootX = side === 0 ? -6 : w + 6;
    const dir = side === 0 ? 1 : -1;
    const limbs = 3 + Math.floor(r() * 2);
    for (let b = 0; b < limbs; b++) {
      const dropY = 4 + b * 26 + Math.round(r() * 18);
      const reach = 130 - b * 34 + Math.round(r() * 46);
      // Droop varies per limb too: limbs that all bend on one curve read as a
      // rake, and the twigs inherit it so a twig never leaves its own branch.
      const droop = hz.cityTop * (0.42 + r() * 0.3);
      g.beginPath();
      g.moveTo(rootX, dropY);
      g.quadraticCurveTo(
        rootX + dir * reach * 0.5, dropY + droop * 0.4,
        rootX + dir * reach, dropY + droop,
      );
      g.stroke();
      for (let k = 0; k < 2 + Math.floor(r() * 2); k++) {
        const t = 0.3 + r() * 0.55;
        const tx = rootX + dir * reach * t;
        const ty = dropY + droop * t * t;
        const len = 11 + r() * 12;
        g.beginPath();
        g.moveTo(tx, ty);
        // Twigs go UP off the limb, always. A branch hanging into frame from
        // above is being pulled down by its own weight; its twigs are the part
        // that has not been pulled down yet, and one drawn downward reads as a
        // break rather than as growth.
        g.lineTo(tx + dir * len, ty - len * (0.6 + r() * 0.6));
        g.stroke();
      }
    }
  }
}

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

  g.globalAlpha = 0.45;
  branches(g, w, hz);

  g.restore();
}
