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

function gatePier(g: CanvasRenderingContext2D, cx: number, hz: Horizon): void {
  const pw = 26;
  const x = cx - pw / 2;
  // Shaft, from the bottom of the frame to well above the parapet. A pier only
  // as tall as the railing disappears into the railing.
  g.fillRect(x, hz.waterTop, pw, hz.h - hz.waterTop);
  // Plinth, wider at the foot.
  g.fillRect(x - 5, hz.railBot, pw + 10, hz.deckTop - hz.railBot + 6);
  // Cornice and ball cap.
  g.fillRect(x - 4, hz.waterTop + 8, pw + 8, 7);
  g.beginPath();
  g.arc(cx, hz.waterTop + 2, 9, 0, Math.PI * 2);
  g.fill();
}

function gateLeaf(
  g: CanvasRenderingContext2D, fromX: number, dir: 1 | -1, hz: Horizon,
): void {
  // Swung OPEN, flat against the pier. An arched gate would fight the bridge's
  // arches, and two curved framings in one picture weaken each other.
  const bars = 7;
  const pitch = 11;
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
  g.fillRect(fromX + Math.min(0, dir * bars * pitch), top + 6, bars * pitch, 3);
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

function branches(g: CanvasRenderingContext2D, w: number, hz: Horizon): void {
  g.lineWidth = 2;
  for (const side of [0, 1]) {
    const rootX = side === 0 ? -6 : w + 6;
    const dir = side === 0 ? 1 : -1;
    for (let b = 0; b < 3; b++) {
      const dropY = 4 + b * 26;
      const reach = 130 - b * 34;
      g.beginPath();
      g.moveTo(rootX, dropY);
      g.quadraticCurveTo(
        rootX + dir * reach * 0.5, dropY + hz.cityTop * 0.22,
        rootX + dir * reach, dropY + hz.cityTop * 0.55,
      );
      g.stroke();
      // Two twigs off each limb.
      for (const t of [0.4, 0.72]) {
        const tx = rootX + dir * reach * t;
        const ty = dropY + hz.cityTop * 0.55 * t * t;
        g.beginPath();
        g.moveTo(tx, ty);
        g.lineTo(tx + dir * 16, ty - 13);
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
