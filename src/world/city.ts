import { stream } from './rng';
import { hatch } from './hatch';

/**
 * The old skyline was twenty-six equal-width blocks with random heights. The eye
 * reads that as a bar chart, not a city, because a city's rhythm lives in its
 * WIDTHS as much as its heights. This is a vocabulary of shapes drawn onto a
 * walking cursor with varying widths.
 */
export type ShapeKind =
  | 'gable' | 'flat' | 'spire' | 'dome' | 'clockTower' | 'factory' | 'crane';

export type Block = {
  kind: ShapeKind;
  x: number;
  w: number;
  /** y of the highest point of the massing */
  top: number;
  /** smoke anchor; present only on factories */
  stackX?: number;
};

const MIN_W = 18;
const MAX_W = 90;

/**
 * A spire must be at least this many times taller than it is wide. Below about
 * 3 the shape reads as a tent; the reference's towers are needles.
 */
export const MIN_SPIRE_ASPECT = 3.4;

/**
 * Spires and towers are capped narrow no matter what width the cursor drew.
 * Exported so the test can measure the shaft that is actually drawn rather than
 * the slot it stands in.
 */
export const SPIRE_MAX_W = 34;

/** `heightF`: 0 is a low shed, 1 is the tallest thing on the block. */
function pickKind(r: number, heightF: number): ShapeKind {
  // Cranes and sheds crowd the waterfront; spires and stacks stand behind them.
  if (heightF < 0.30) return r < 0.35 ? 'crane' : r < 0.75 ? 'gable' : 'flat';
  if (heightF > 0.66) return r < 0.58 ? 'spire' : r < 0.80 ? 'factory' : 'dome';
  return r < 0.48 ? 'flat' : r < 0.80 ? 'gable' : 'dome';
}

export function skyline(w: number, top: number, bot: number, seed: number): Block[] {
  const r = stream(seed);
  const span = bot - top;
  const out: Block[] = [];

  let x = 0;
  // `run` biases the next block toward the same kind as the last, so towers
  // arrive in districts. A city with one spire every other block reads as
  // wallpaper, not as a place.
  let run = 0;
  let lastKind: ShapeKind | null = null;

  while (x < w) {
    const bw = Math.max(MIN_W, Math.round(MIN_W + r() * (MAX_W - MIN_W)));
    const heightF = Math.pow(r(), 0.62);
    const roll = r();

    // Annotated: without it TS infers `kind` through `lastKind`, which is
    // assigned from `kind` further down — a circular initializer (TS7022).
    const kind: ShapeKind = run > 0 && lastKind !== null && roll < 0.62
      ? lastKind
      : pickKind(roll, heightF);

    // Towers are needles. Capping the width here rather than inside the massing
    // keeps the cursor's coverage of `w` exact.
    const narrow = kind === 'spire' || kind === 'clockTower';
    const width = narrow ? Math.min(bw, SPIRE_MAX_W) : bw;

    // Guarantee the aspect ratio instead of hoping a random height clears it.
    // `floor`, not `round`: rounding down the top means rounding UP the height,
    // so the ratio can only ever land above the minimum, never a hair below it.
    let blockTop = Math.round(bot - span * (0.18 + heightF * 0.82));
    if (narrow) {
      blockTop = Math.min(blockTop, Math.floor(bot - width * MIN_SPIRE_ASPECT));
      if (blockTop < top) blockTop = top;
    }

    out.push({ kind, x, w: width, top: blockTop });

    run = kind === lastKind ? run - 1 : (narrow ? 2 : 0);
    lastKind = kind;
    x += width;
  }

  // The landmark goes on the widest block, so it always has room for its shaft.
  // Deterministic, and it reads as deliberate rather than as an accident.
  //
  // Its slot width is left alone on purpose: the coverage test asserts every
  // block's `x` equals the running sum of the widths before it, so shrinking one
  // after the fact would put every later block out of step. The massing already
  // draws the tower's shaft narrow inside a wide slot.
  let widest = 0;
  for (let i = 1; i < out.length; i++) if (out[i]!.w > out[widest]!.w) widest = i;
  out[widest]!.kind = 'clockTower';
  out[widest]!.top = top;

  // Smoke needs a chimney. Without this guarantee a seed can produce a city
  // where the smoke layer has nowhere to attach and silently draws nothing.
  if (!out.some((b) => b.kind === 'factory')) {
    const at = (widest + Math.max(1, Math.floor(out.length / 2))) % out.length;
    out[at]!.kind = 'factory';
    out[at]!.top = Math.round(bot - span * 0.9);
  }
  for (const b of out) if (b.kind === 'factory') b.stackX = Math.round(b.x + b.w * 0.5);

  return out;
}

/**
 * Massing only. Details (pots, jibs) are stroked separately after hatching.
 *
 * The block's own height is `bh`, never `h`: `h` is reserved for the frame, and
 * the smoke test in tests/smoke.test.ts refuses any `h * 0.x` outside horizon.ts.
 */
function massing(g: CanvasRenderingContext2D, b: Block, bot: number): void {
  const { x, w, top, kind } = b;
  const bh = bot - top;
  g.beginPath();
  switch (kind) {
    case 'gable':
      g.moveTo(x, bot); g.lineTo(x, top + bh * 0.34);
      g.lineTo(x + w / 2, top); g.lineTo(x + w, top + bh * 0.34);
      g.lineTo(x + w, bot); g.closePath();
      break;
    case 'spire':
      g.moveTo(x, bot); g.lineTo(x, top + bh * 0.55);
      g.lineTo(x + w * 0.5, top); g.lineTo(x + w, top + bh * 0.55);
      g.lineTo(x + w, bot); g.closePath();
      break;
    case 'dome': {
      const r = w * 0.5;
      g.moveTo(x, bot); g.lineTo(x, top + r);
      g.arc(x + r, top + r, r, Math.PI, 0);
      g.lineTo(x + w, bot); g.closePath();
      break;
    }
    case 'clockTower': {
      const sw = Math.min(w, 30);
      const sx = x + (w - sw) / 2;
      g.moveTo(sx, bot); g.lineTo(sx, top + sw * 0.9);
      g.lineTo(sx + sw / 2, top); g.lineTo(sx + sw, top + sw * 0.9);
      g.lineTo(sx + sw, bot); g.closePath();
      break;
    }
    case 'factory': {
      const sw = Math.max(5, w * 0.18);
      const sx = x + w * 0.5 - sw / 2;
      const shoulder = top + bh * 0.62;
      g.moveTo(x, bot); g.lineTo(x, shoulder);
      g.lineTo(sx, shoulder); g.lineTo(sx + sw * 0.15, top);
      g.lineTo(sx + sw * 0.85, top); g.lineTo(sx + sw, shoulder);
      g.lineTo(x + w, shoulder); g.lineTo(x + w, bot); g.closePath();
      break;
    }
    case 'crane':
      // A low shed; the jib is stroked on top, because a filled jib at this size
      // turns into a blob.
      g.rect(x, top + bh * 0.55, w, bh * 0.45);
      break;
    case 'flat':
    default:
      g.rect(x, top, w, bh);
      break;
  }
}

export type SkylineStyle = {
  angle: number;
  fill: string;
  ink: string;
  density: number;
  maxGap: number;
};

export function drawSkyline(
  g: CanvasRenderingContext2D,
  blocks: readonly Block[],
  bot: number,
  s: SkylineStyle,
): void {
  for (const b of blocks) {
    g.fillStyle = s.fill;
    massing(g, b, bot);
    g.fill();

    // Hatch is clipped to the silhouette, not to its bounding box — the whole
    // point of a vocabulary of shapes is lost if every one wears a square coat.
    g.save();
    massing(g, b, bot);
    g.clip();
    hatch(g, b.x, b.top, b.w, bot - b.top, s.density, {
      angle: s.angle, color: s.ink, maxGap: s.maxGap,
    });
    g.restore();
  }

  // Details, stroked over the hatching.
  g.strokeStyle = s.ink;
  g.lineWidth = 1;
  for (const b of blocks) {
    const bh = bot - b.top;
    if (b.kind === 'flat') {
      // A row of chimney pots. Terraces without them read as filing cabinets.
      g.fillStyle = s.fill;
      for (let k = 0; k < 3; k++) {
        const px = b.x + b.w * (0.2 + k * 0.3);
        g.fillRect(px, b.top - 7, 3, 7);
      }
    }
    if (b.kind === 'crane') {
      const mx = b.x + b.w * 0.62;
      const mastTop = b.top + bh * 0.05;
      g.beginPath();
      g.moveTo(mx, b.top + bh * 0.55);
      g.lineTo(mx, mastTop);
      g.lineTo(b.x + b.w * 0.08, mastTop + bh * 0.18);
      g.stroke();
    }
  }
}
