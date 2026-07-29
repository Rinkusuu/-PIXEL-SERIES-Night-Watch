import type { AmbientValues } from '../ambient/types';
import type { Horizon } from './horizon';

/**
 * The scene had no people in it. Everything else — the gas, the smoke, the
 * barge, five hundred windows — implied them without ever showing one, and a
 * city that is entirely implied reads as a stage set after the cast went home.
 *
 * Two figures, because one is a decoration and two is a world:
 *
 *  - the WATCHER stands on the upstream bridge and never leaves. Look up from
 *    the timer and somebody else is keeping watch too. That is the whole app in
 *    one silhouette, so it belongs on the plate and costs nothing per frame.
 *  - the WALKER crosses on the wall clock, rarely and slowly, carrying a light.
 *    The river does not care about your timer and neither does he.
 *
 * The local height is `fh`, never `h`: `h` belongs to the frame, and the smoke
 * test refuses any `h * 0.x` outside horizon.ts.
 */

/**
 * Readable rather than literal. A person at this bridge's true scale would be
 * seven pixels; the gas standards on the same parapet already cheat by about
 * as much, so the picture is consistent with itself if not with arithmetic.
 *
 * Eleven was measured and rejected: the silhouette was there and its contrast
 * was better than two to one, but at 1.3% of frame height nobody finds it, and
 * a figure you cannot find gives no scale — which is the only reason he exists.
 */
export const FIGURE_H = 15;

/** Clear of the gas standard at 0.105w, and off-centre so it reads as a person
 *  who chose a spot rather than as a marker. */
export const WATCHER_X = 0.27;

export const WALK_PERIOD_MS = 7 * 60_000;
export const WALK_CROSS_MS = 180_000;

/**
 * Where the walker is, as a fraction of width, or null when nobody is crossing.
 * A pure function of the clock — no state, no randomness — the same shape as
 * `bargeAt`. Most of the time the bridge is empty, and that is the point: a
 * figure who is always there stops being an event.
 */
export function walkerAt(nowMs: number): number | null {
  const phase = ((nowMs % WALK_PERIOD_MS) + WALK_PERIOD_MS) % WALK_PERIOD_MS;
  if (phase >= WALK_CROSS_MS) return null;
  return -0.06 + (phase / WALK_CROSS_MS) * 1.12;
}

/**
 * A hat and a long coat. At eleven pixels those two shapes are the whole of
 * what makes a silhouette read as a person of the nineteenth century rather
 * than as a smudge — the brim especially, which is why it gets its own pixel
 * row instead of being implied by the crown.
 */
export function drawFigure(
  g: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  stride: number,
): void {
  const fh = FIGURE_H;
  const top = groundY - fh;
  const cx = Math.round(x);
  const shoulder = Math.round(top + fh * 0.34);
  const hatY = Math.round(top + fh * 0.16);

  // Coat: narrow at the shoulder, flaring to the hem. The flare is what stops
  // it reading as a fence post.
  g.beginPath();
  g.moveTo(cx - 2, shoulder);
  g.lineTo(cx + 2, shoulder);
  g.lineTo(cx + 3, groundY - 2);
  g.lineTo(cx - 3, groundY - 2);
  g.closePath();
  g.fill();

  // Legs. `stride` opens them as he walks and closes them when he stands.
  const gap = Math.round(stride);
  g.fillRect(cx - 2 - gap, groundY - 2, 1, 2);
  g.fillRect(cx + 1 + gap, groundY - 2, 1, 2);

  // Head, then the hat brim, then its crown.
  g.fillRect(cx - 1, hatY, 2, 2);
  g.fillRect(cx - 3, hatY, 6, 1);
  g.fillRect(cx - 1, hatY - 4, 3, 4);
}

/** A small warm pool. Shared by both figures so their lights agree. */
function lamp(
  g: CanvasRenderingContext2D,
  x: number, y: number, radius: number, glow: string, alpha: number,
): void {
  g.save();
  g.globalCompositeOperation = 'lighter';
  const halo = g.createRadialGradient(x, y, 0, x, y, radius);
  halo.addColorStop(0, glow);
  halo.addColorStop(1, 'transparent');
  g.globalAlpha = alpha;
  g.fillStyle = halo;
  g.beginPath();
  g.arc(x, y, radius, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = glow;
  g.fillRect(x - 1, y - 1, 2, 3);
  g.restore();
}

/**
 * The one who is always there. Drawn on the static plate, in the same ink as
 * everything else at that depth.
 *
 * His lamp is set DOWN on the parapet beside him rather than carried. At this
 * distance the silhouette alone is a tick on a line — a light is what makes the
 * eye find him at all — and a lamp on the ground says he stopped here, which is
 * what tells him apart from the man walking past with his in his hand.
 */
export function drawWatcher(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  v: AmbientValues,
  ink: string,
): void {
  const x = w * WATCHER_X;
  g.save();
  g.fillStyle = ink;
  drawFigure(g, x, hz.bridgeTop, 0);
  g.restore();
  lamp(g, Math.round(x) + 7, hz.bridgeTop - 2, 11, v.glow, 0.42);
}

/**
 * The one who passes. Lives in the live pass because his position comes from
 * the wall clock, and freezes completely when motion is off — a figure who
 * teleports on a still scene is worse than no figure at all.
 */
export function drawWalker(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  v: AmbientValues,
  ink: string,
  nowMs: number,
  motion: number,
): void {
  const at = walkerAt(nowMs);
  if (at === null) return;

  const x = at * w;
  const ground = hz.bridgeTop;
  // Two frames of walk, and nothing at all with motion off.
  const stride = motion === 0 ? 0 : (Math.floor(nowMs / 420) % 2);

  g.save();
  g.fillStyle = ink;
  drawFigure(g, x, ground, stride);
  g.restore();

  // The lantern he CARRIES — held at hand height, not set down. That is the
  // whole difference between him and the watcher, and it is what makes him read
  // as somebody going somewhere.
  lamp(g, Math.round(x) + 6, ground - 6, 15, v.glow, 0.55);
}
