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

/**
 * `heightF`: 0 is a low shed, 1 is the tallest thing on the block.
 *
 * Shape is decided almost independently of height, and that is the whole point.
 * The old table let a tall block be ONLY a spire, a stack or a dome, so a box
 * was structurally forbidden from being tall — twenty-one of thirty-one blocks
 * came out pointed or round, and the skyline read as a fairground.
 *
 * A Victorian city is boxes. Warehouses, mills, tenement blocks: tall, flat,
 * blunt. Spires and domes are the accents that mean something BECAUSE they are
 * rare. Height now only decides whether we are down on the waterfront.
 */
function pickKind(r: number, heightF: number): ShapeKind {
  // The waterfront itself: sheds and cranes, and nothing tall.
  if (heightF < 0.22) return r < 0.42 ? 'crane' : r < 0.78 ? 'gable' : 'flat';
  if (r < 0.46) return 'flat';
  if (r < 0.68) return 'gable';
  if (r < 0.82) return 'factory';
  if (r < 0.94) return 'spire';
  return 'dome';
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

export type OpeningKind = 'window' | 'clock' | 'louvre';
export type Opening = {
  kind: OpeningKind;
  x: number; y: number; w: number; h: number;
};

const WIN_W = 4;
const WIN_H = 7;
/** Floor to floor. Under about ten and the rows merge into a smear. */
const STOREY = 11;
const COL_PITCH = 9;
const INSET = 5;

/**
 * Fills a slab with a window grid, centred horizontally and clamped hard. A
 * block too small for one whole row gets nothing at all — a clipped row reads
 * as damage, not as a window.
 */
function grid(x0: number, y0: number, x1: number, y1: number): Opening[] {
  const out: Opening[] = [];
  const innerW = x1 - x0 - INSET * 2;
  const cols = Math.floor((innerW + (COL_PITCH - WIN_W)) / COL_PITCH);
  if (cols < 1) return out;
  const gridW = cols * COL_PITCH - (COL_PITCH - WIN_W);
  const sx = Math.round(x0 + (x1 - x0 - gridW) / 2);
  for (let y = y0 + INSET; y + WIN_H <= y1 - INSET; y += STOREY) {
    for (let c = 0; c < cols; c++) {
      out.push({
        kind: 'window', x: sx + c * COL_PITCH, y: Math.round(y), w: WIN_W, h: WIN_H,
      });
    }
  }
  return out;
}

/**
 * Where a block's light can come from. Read by BOTH the plate, which cuts them
 * as dark holes, and `bloom.ts`, which lights a handful — the same one-source
 * rule as `horizon()` and `lanternAnchor()`. Two modules inventing window
 * positions separately is how the glow ends up beside the window.
 *
 * Pure geometry, no randomness: nothing to keep in sync across callers.
 */
export function openings(b: Block, bot: number): Opening[] {
  const { x, w, top, kind } = b;
  const bh = bot - top;

  switch (kind) {
    case 'flat':
      return grid(x, top, x + w, bot);

    case 'gable':
      // Starts at the eaves the massing draws its roof from.
      return grid(x, top + bh * 0.34, x + w, bot);

    case 'factory':
      // The stack stays blind. Only the shed body is glazed.
      return grid(x, top + bh * 0.62, x + w, bot);

    case 'dome': {
      // One arcade ring around the drum, and a grid on the block below it. A
      // drum is not a terrace; a grid on it reads as an office in a hat.
      const cx = x + w / 2;
      const dr = Math.min(w * 0.34, 26);
      const shoulder = top + dr * 2.1;
      const out: Opening[] = [];
      const n = Math.max(2, Math.floor((dr * 2) / 9));
      const pitch = (dr * 2) / n;
      const ringY = Math.round(top + dr + 3);
      for (let i = 0; i < n; i++) {
        const ox = Math.round(cx - dr + pitch * (i + 0.5) - 1.5);
        if (ox < x || ox + 3 > x + w || ringY + 8 > bot) continue;
        out.push({ kind: 'window', x: ox, y: ringY, w: 3, h: 8 });
      }
      return out.concat(grid(x, shoulder, x + w, bot));
    }

    case 'spire': {
      // Two lancets on the shaft. The point stays clean — glazing a spire's
      // point turns a church into a lighthouse.
      const shaftTop = Math.round(top + bh * 0.55);
      const out: Opening[] = [];
      const ox = Math.round(x + w * 0.5 - 3);
      if (ox < x || ox + 6 > x + w) return out;
      for (const f of [0.28, 0.60]) {
        const y = Math.round(shaftTop + (bot - shaftTop) * f);
        if (y + 14 > bot - 4) continue;
        out.push({ kind: 'window', x: ox, y, w: 6, h: 14 });
      }
      return out;
    }

    case 'clockTower': {
      const sw = Math.min(w, 30);
      const sx = x + (w - sw) / 2;
      const face = Math.max(9, Math.round(sw * 0.5));
      const faceY = Math.round(top + sw);
      const out: Opening[] = [];
      if (faceY + face <= bot - 4) {
        out.push({
          kind: 'clock',
          x: Math.round(sx + (sw - face) / 2), y: faceY, w: face, h: face,
        });
      }
      // Belfry louvres, under the clock stage.
      const louvreY = faceY + face + 6;
      if (louvreY + 8 <= bot - 4) {
        for (let i = 0; i < 3; i++) {
          out.push({
            kind: 'louvre',
            x: Math.round(sx + 4 + i * ((sw - 8) / 3)), y: louvreY, w: 3, h: 8,
          });
        }
      }
      return out;
    }

    case 'crane':
    default:
      return [];
  }
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
      // A dome on a drum on a block — not a bubble the width of the plot. At
      // `w * 0.5` every dome swallowed its own building and the skyline filled
      // up with half-circles.
      const cx = x + w / 2;
      const dr = Math.min(w * 0.34, 26);
      const shoulder = top + dr * 2.1;
      g.moveTo(x, bot);
      g.lineTo(x, shoulder);
      g.lineTo(cx - dr, shoulder);
      g.lineTo(cx - dr, top + dr);
      g.arc(cx, top + dr, dr, Math.PI, 0);
      g.lineTo(cx + dr, shoulder);
      g.lineTo(x + w, shoulder);
      g.lineTo(x + w, bot);
      g.closePath();
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
      // A parapet, not a bare rectangle. One step in from each end is enough to
      // say the roof has an edge instead of a cut line — and boxes are now the
      // backbone of the skyline, so a bare one would be everywhere.
      g.moveTo(x, bot);
      g.lineTo(x, top + 5);
      g.lineTo(x + w * 0.14, top + 5);
      g.lineTo(x + w * 0.14, top);
      g.lineTo(x + w * 0.86, top);
      g.lineTo(x + w * 0.86, top + 5);
      g.lineTo(x + w, top + 5);
      g.lineTo(x + w, bot);
      g.closePath();
      break;
  }
}

export type SkylineStyle = {
  angle: number;
  fill: string;
  ink: string;
  density: number;
  /** False for the far band: at twelve pixels wide an opening is a smudge. */
  openings: boolean;
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
      angle: s.angle, color: s.ink,
    });

    // Openings, cut as dark holes while we are still clipped to the silhouette.
    // Addendum §C.2 says a glowing thing is a HOLE in the hatching; until now
    // there were no holes, so the window lights sat on top of solid wall.
    // Unlit windows stay dark, and that is right: a city at night is mostly
    // dark, and that is what makes the lit ones mean anything.
    if (s.openings) {
      g.fillStyle = s.ink;
      g.globalAlpha = 0.85;
      for (const o of openings(b, bot)) {
        if (o.kind === 'clock') {
          g.beginPath();
          g.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, 0, Math.PI * 2);
          g.fill();
        } else {
          g.fillRect(o.x, o.y, o.w, o.h);
        }
      }
      g.globalAlpha = 1;
    }
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
