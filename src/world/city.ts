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

/** `heightF`: 0 is a low shed, 1 is the tallest thing on the block. */
function pickKind(r: number, heightF: number): ShapeKind {
  // Cranes and sheds crowd the waterfront; spires and stacks stand behind them.
  if (heightF < 0.35) return r < 0.35 ? 'crane' : r < 0.75 ? 'gable' : 'flat';
  if (heightF > 0.82) return r < 0.45 ? 'spire' : r < 0.75 ? 'factory' : 'dome';
  return r < 0.55 ? 'flat' : r < 0.85 ? 'gable' : 'dome';
}

export function skyline(w: number, top: number, bot: number, seed: number): Block[] {
  const r = stream(seed);
  const span = bot - top;
  const out: Block[] = [];

  let x = 0;
  while (x < w) {
    const bw = Math.max(MIN_W, Math.round(MIN_W + r() * (MAX_W - MIN_W)));
    const heightF = Math.pow(r(), 0.85);
    out.push({
      kind: pickKind(r(), heightF),
      x,
      w: bw,
      top: Math.round(bot - span * (0.18 + heightF * 0.82)),
    });
    x += bw;
  }

  // The landmark goes on the widest block, so it always has room for its shaft.
  // Deterministic, and it reads as deliberate rather than as an accident.
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
