import { stream } from './rng';

/**
 * The old skyline was twenty-six equal-width blocks with random heights. The eye
 * reads that as a bar chart, not a city, because a city's rhythm lives in its
 * WIDTHS as much as its heights. This is a vocabulary of shapes drawn onto a
 * walking cursor with varying widths.
 */
export type ShapeKind =
  | 'gable' | 'flat' | 'spire' | 'dome' | 'clockTower' | 'factory' | 'crane'
  /**
   * Nothing at all — a slot the cursor walks past without building on. The
   * skyline ran contiguous from edge to edge, so the sky was never visible
   * between two towers and the band read as one blocked-off mass. In the near
   * band a gap shows the far band through it: depth that was already being
   * paid for and never collected.
   */
  | 'gap';

export type Block = {
  kind: ShapeKind;
  x: number;
  w: number;
  /** y of the highest point of the massing */
  top: number;
  /** smoke anchor; present only on factories */
  stackX?: number;
};

/** Depth of the lit rim along every top edge. One pixel is a hairline at 2x. */
const RIM = 2;

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

/** How often the cursor leaves a slot empty. */
const GAP_CHANCE = 0.11;
/** Widest a gap may be, as a multiple of MIN_W. A gap as wide as a building is
 *  a square, not an alley. */
const GAP_MAX_W = 1.4;

/** A block narrower than this has no room to step its upper mass in. */
const SETBACK_MIN_W = 46;

/**
 * Where a tall box steps its upper mass in, and by how much. Read by BOTH the
 * massing and `openings()` — computed twice and the windows spill off the
 * shoulder. Same rule as `horizon()` and `lanternAnchor()`, and this project
 * has already paid for breaking it twice.
 *
 * Returns null when the block is too small or the wrong kind to step.
 */
export function setbackOf(
  b: Block, bot: number,
): { shoulder: number; inset: number } | null {
  if (b.kind !== 'flat' || b.w < SETBACK_MIN_W) return null;
  const bh = bot - b.top;
  if (bh < 60) return null;
  return { shoulder: Math.round(b.top + bh * 0.38), inset: Math.round(b.w * 0.18) };
}

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
  // The waterfront itself: sheds and cranes, and nothing tall. Threshold cut
  // from 0.22 to 0.10 when the height curve was inverted — at 0.22 a curve that
  // leans low puts a THIRD of the city on the waterfront, and a skyline that is
  // one third crane is a dockyard.
  if (heightF < 0.10) return r < 0.42 ? 'crane' : r < 0.78 ? 'gable' : 'flat';
  if (r < 0.46) return 'flat';
  if (r < 0.68) return 'gable';
  if (r < 0.82) return 'factory';
  if (r < 0.94) return 'spire';
  return 'dome';
}

/**
 * Width multiplier for the band behind the skyline. Distance does not merely
 * fade a city, it multiplies it — roughly twice as many buildings, each about
 * half as wide. Out there, density IS the detail.
 */
export const FAR_SCALE = 0.55;

/**
 * The same multiplier for the band in between. Between the far band's 0.55 and
 * the near band's 1, and closer to the near one: this band is meant to read as
 * a step in a series, not as a third unrelated city.
 */
export const MID_SCALE = 0.78;

/**
 * Every line of the landmark, from one place.
 *
 * Read by the massing, by `openings()` (the clock face and the belfry louvres
 * must land ON the stages the massing drew) and by the detail pass. Three
 * modules computing a tower's stages independently is the fault this project
 * has paid for four times — see `horizon()`, `setbackOf`, `eaveOf`, `archCrown`.
 */
export function towerOf(b: Block, bot: number) {
  const shaftW = Math.min(b.w, 30);
  const cx = Math.round(b.x + b.w / 2);
  const bh = bot - b.top;

  const stageW = Math.round(shaftW * 1.34);
  const belfryW = Math.round(shaftW * 0.82);
  const baseW = Math.round(shaftW * 1.22);

  // Measured DOWN from the top, so the ornament keeps its proportions when the
  // tower is tall and the shaft simply gets longer — rather than the spire
  // stretching and the clock sliding into the roofline.
  const spire = Math.round(bh * 0.20);
  const belfryTop = Math.round(b.top + spire);
  const belfryH = Math.round(shaftW * 0.62);
  const belfryBot = belfryTop + belfryH;
  const stageTop = belfryBot;
  const stageH = Math.round(shaftW * 1.05);
  const stageBot = stageTop + stageH;

  return {
    cx,
    shaftW, shaftX: Math.round(cx - shaftW / 2),
    stageW, stageX: Math.round(cx - stageW / 2),
    belfryW, belfryX: Math.round(cx - belfryW / 2),
    baseW, baseX: Math.round(cx - baseW / 2),
    spireTop: b.top,
    belfryTop, belfryBot,
    stageTop, stageBot,
    plinth: Math.round(bot - bh * 0.10),
  };
}

/**
 * Where the landmark stands, as a fraction of the width.
 *
 * Left of centre, because the moon is at 0.78. Two focal points on opposite
 * sides of the frame read as a composition; two in the same corner read as a
 * pile.
 */
export const LANDMARK_X = 0.31;

/** How wide a slot the tower wants before it will settle for a narrower one. */
export const LANDMARK_W = 44;

export function skyline(
  w: number, top: number, bot: number, seed: number, scale = 1,
  /**
   * The landmark's own ceiling. `null` for the bands behind, which get no
   * landmark at all — a second tower at a second distance is not a hero, it is
   * a pair, and a pair has no centre.
   */
  landmarkTop: number | null = null,
): Block[] {
  const r = stream(seed);
  const span = bot - top;
  const minW = Math.max(6, Math.round(MIN_W * scale));
  const maxW = Math.max(minW + 4, Math.round(MAX_W * scale));
  const out: Block[] = [];

  let x = 0;
  // `run` biases the next block toward the same kind as the last, so towers
  // arrive in districts. A city with one spire every other block reads as
  // wallpaper, not as a place.
  let run = 0;
  let lastKind: ShapeKind | null = null;

  while (x < w) {
    const bw = Math.max(minW, Math.round(minW + r() * (maxW - minW)));
    // Exponent ABOVE one, so the curve leans low. It was 0.62, which leans
    // high: the mean block filled 69% of the band and the bulk of them landed
    // between 60% and 100%, so the roofline came out an even hedge and nothing
    // in the city towered over anything else. A skyline is not made grand by
    // being tall, it is made grand by the DIFFERENCE between its tall things
    // and its ordinary ones — and if everything is tall there is no difference
    // left to read. At 1.5 the mean block fills 40% and roughly one in seven
    // clears 80%, which is the ratio a real skyline has.
    const heightF = Math.pow(r(), 1.5);
    const roll = r();

    // Annotated: without it TS infers `kind` through `lastKind`, which is
    // assigned from `kind` further down — a circular initializer (TS7022).
    // A gap never follows a gap: two in a row is one wide hole and the band
    // turns into a picket fence.
    // Annotated for the same reason `kind` is: without it TS infers this
    // through `lastKind`, which is assigned from `kind`, which reads this.
    const wantGap: boolean = lastKind !== 'gap' && r() < GAP_CHANCE;
    const kind: ShapeKind = wantGap
      ? 'gap'
      : run > 0 && lastKind !== null && roll < 0.62
        ? lastKind
        : pickKind(roll, heightF);

    // Towers are needles. Capping the width here rather than inside the massing
    // keeps the cursor's coverage of `w` exact.
    const narrow = kind === 'spire' || kind === 'clockTower';
    const width = kind === 'gap'
      ? Math.min(bw, Math.round(minW * GAP_MAX_W))
      : narrow ? Math.min(bw, SPIRE_MAX_W) : bw;

    // Guarantee the aspect ratio instead of hoping a random height clears it.
    // `floor`, not `round`: rounding down the top means rounding UP the height,
    // so the ratio can only ever land above the minimum, never a hair below it.
    // Floor raised from 0.18 to 0.30. The upstream bridge's parapet stands at
    // about a fifth of this band up from the waterline, so anything shorter
    // than that is drawn entirely behind stone and seen by nobody. With the old
    // height curve almost nothing landed that low; with this one a great deal
    // would, and it would all be wasted ink.
    let blockTop = Math.round(bot - span * (0.30 + heightF * 0.70));
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
  if (landmarkTop !== null) {
    // Placed, not picked. It used to go on whichever block happened to come out
    // widest, which put the one thing the eye is supposed to find somewhere
    // different every seed — sometimes against the frame edge, sometimes
    // directly under the moon, where the two strongest elements in the picture
    // cancel instead of balancing.
    //
    // The moon sits at 0.78 of the width. The tower goes at LANDMARK_X, well to
    // the other side of centre, so the frame reads as two focal points across a
    // wide composition rather than one crowded corner.
    const want = w * LANDMARK_X;
    let best = 0;
    let bestScore = Infinity;
    for (let i = 0; i < out.length; i++) {
      const b = out[i]!;
      if (b.kind === 'gap') continue;
      // Distance from the target, with a penalty for a slot too narrow to draw
      // a tower in. A near miss on a wide block beats a bullseye on an alley.
      const cx = b.x + b.w / 2;
      const score = Math.abs(cx - want) + Math.max(0, LANDMARK_W - b.w) * 6;
      if (score < bestScore) { bestScore = score; best = i; }
    }
    widest = best;
    out[best]!.kind = 'clockTower';
    out[best]!.top = landmarkTop;
  } else {
    // No landmark in the bands behind. A second tower at a second distance is
    // not a hero, it is a pair, and a pair has no centre. `widest` is still
    // wanted below as the anchor the factory fallback measures from.
    for (let i = 1; i < out.length; i++) if (out[i]!.w > out[widest]!.w) widest = i;
  }

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

const INSET = 5;

/**
 * The window grid of a mass, as a function of how big that mass is.
 *
 * These used to be five flat constants, so a ninety-pixel warehouse and an
 * eighteen-pixel shed carried windows of exactly the same size at exactly the
 * same spacing. That is the single strongest reason the city read as small.
 *
 * The eye does not judge a building's size from how much of the frame it takes
 * up — it has nothing to compare that against. It judges size from how FINELY
 * the thing is subdivided, because window and storey are the units it already
 * knows the real-world measurement of. A cathedral reads as vast because it is
 * made of hundreds of small parts. Give a big mass the same four-by-seven
 * windows as the shed beside it and the eye sizes it like the shed, however
 * wide it is drawn.
 *
 * So: bigger mass, MORE and SMALLER openings. Not the same openings spread
 * further apart, which is the intuitive move and the wrong one — it reads as a
 * shed built by someone who ran out of windows.
 *
 * `t` runs 0 for a low block to 1 for a tall one. Everything below has a floor,
 * because past a point a window stops being a window and becomes grain: at
 * three by five it is still an opening, at two by three it is dirt on the
 * plate.
 */
function metrics(bh: number): {
  winW: number; winH: number; storey: number; pitch: number;
} {
  const t = Math.min(1, Math.max(0, (bh - 55) / 110));
  return {
    winW: t > 0.55 ? 3 : 4,
    winH: Math.round(7 - t * 2),
    // Floor to floor. Under about eight and the rows merge into a smear.
    storey: Math.round(11 - t * 3),
    pitch: Math.round(9 - t * 2),
  };
}

/**
 * Fills a slab with a window grid, centred horizontally and clamped hard. A
 * block too small for one whole row gets nothing at all — a clipped row reads
 * as damage, not as a window.
 *
 * `m` comes from the whole block, never from this slab: a stepped tower's upper
 * mass and lower mass are ONE building and must be glazed on one module. Sized
 * per slab, the storeys visibly change height at the shoulder.
 */
function grid(
  x0: number, y0: number, x1: number, y1: number,
  m: ReturnType<typeof metrics>,
): Opening[] {
  const { winW: WIN_W, winH: WIN_H, storey: STOREY, pitch: COL_PITCH } = m;
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
  // Sized once, from the block as a whole. Every slab of this block is glazed
  // on the same module — see `grid`.
  const m = metrics(bh);

  switch (kind) {
    case 'flat': {
      // Follows the setback from the SAME source the massing uses. Two copies
      // of this geometry and the upper storeys hang off the shoulder in mid-air.
      const sb = setbackOf(b, bot);
      if (!sb) return grid(x, top, x + w, bot, m);
      return grid(x + sb.inset, top, x + w - sb.inset, sb.shoulder, m)
        .concat(grid(x, sb.shoulder, x + w, bot, m));
    }

    case 'gable':
      // Starts at the eaves the massing draws its roof from.
      return grid(x, top + bh * 0.34, x + w, bot, m);

    case 'factory':
      // The stack stays blind. Only the shed body is glazed.
      return grid(x, top + bh * 0.62, x + w, bot, m);

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
      return out.concat(grid(x, shoulder, x + w, bot, m));
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
      // Straight off `towerOf`, so the face cannot drift off the stage the
      // massing built for it.
      const t = towerOf(b, bot);
      const out: Opening[] = [];
      const face = Math.max(9, Math.round(t.stageW * 0.52));
      out.push({
        kind: 'clock',
        x: Math.round(t.cx - face / 2),
        y: Math.round(t.stageTop + (t.stageBot - t.stageTop - face) / 2),
        w: face, h: face,
      });
      // Belfry louvres: two tall slots, open to the bells. Not windows — a
      // belfry is a room with no glass in it, and drawing it glazed is what
      // makes a tower read as an office with a hat on.
      const lw = Math.max(2, Math.round(t.belfryW * 0.18));
      const lh = Math.max(4, Math.round((t.belfryBot - t.belfryTop) * 0.6));
      const ly = Math.round(t.belfryTop + (t.belfryBot - t.belfryTop - lh) / 2);
      for (const sgn of [-1, 1]) {
        out.push({
          kind: 'louvre',
          x: Math.round(t.cx + sgn * t.belfryW * 0.22 - lw / 2), y: ly, w: lw, h: lh,
        });
      }
      return out;
    }

    case 'crane':
    case 'gap':
    default:
      return [];
  }
}

/**
 * Eaves line of a gable and springing line of a spire's point. Read by BOTH the
 * massing and the shingle courses drawn over it — one source, same rule as
 * `setbackOf`.
 */
export function eaveOf(b: Block, bot: number): number {
  const bh = bot - b.top;
  return Math.round(b.top + bh * (b.kind === 'spire' ? 0.55 : 0.34));
}

/**
 * Massing only. Details (pots, jibs) are stroked separately after hatching.
 *
 * Every coordinate is rounded to a whole pixel. A path corner at x.5 is
 * antialiased into a two-pixel ramp, and the buffer is blown up to the device
 * with nearest neighbour — so one soft edge becomes a two-device-pixel smear
 * and the whole band stops reading as pixel art. This is the cheapest half of
 * the pixel look; the value steps are the other half.
 *
 * The block's own height is `bh`, never `h`: `h` is reserved for the frame, and
 * the smoke test in tests/smoke.test.ts refuses any `h * 0.x` outside horizon.ts.
 */
function massing(g: CanvasRenderingContext2D, b: Block, bot: number): void {
  const { w, top, kind } = b;
  const x = Math.round(b.x);
  const bh = bot - top;
  g.beginPath();
  switch (kind) {
    case 'gap':
      // Nothing. The slot exists so the cursor's arithmetic still covers the
      // width; what stands in it is sky.
      break;
    case 'gable': {
      const eave = eaveOf(b, bot);
      g.moveTo(x, bot); g.lineTo(x, eave);
      g.lineTo(x + Math.round(w / 2), top); g.lineTo(x + w, eave);
      g.lineTo(x + w, bot); g.closePath();
      break;
    }
    case 'spire': {
      const eave = eaveOf(b, bot);
      g.moveTo(x, bot); g.lineTo(x, eave);
      g.lineTo(x + Math.round(w * 0.5), top); g.lineTo(x + w, eave);
      g.lineTo(x + w, bot); g.closePath();
      break;
    }
    case 'dome': {
      // A dome on a drum on a block — not a bubble the width of the plot. At
      // `w * 0.5` every dome swallowed its own building and the skyline filled
      // up with half-circles.
      const cx = Math.round(x + w / 2);
      const dr = Math.round(Math.min(w * 0.34, 26));
      const shoulder = Math.round(top + dr * 2.1);
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
      // The one silhouette in the city that is not a box, a gable or a cone,
      // and the only one whose profile goes OUT before it goes up. A clock
      // stage that oversails its own shaft is the move: nothing else in this
      // vocabulary widens as it rises, so the eye finds it without being told.
      const t = towerOf(b, bot);
      // Buttressed foot.
      g.moveTo(t.baseX, bot);
      g.lineTo(t.baseX, t.plinth);
      g.lineTo(t.shaftX, t.plinth);
      // Shaft, up to the stage.
      g.lineTo(t.shaftX, t.stageBot);
      // Stage, oversailing on both sides.
      g.lineTo(t.stageX, t.stageBot);
      g.lineTo(t.stageX, t.stageTop);
      // Belfry, stepped back in again.
      g.lineTo(t.belfryX, t.belfryBot);
      g.lineTo(t.belfryX, t.belfryTop);
      // Spire.
      g.lineTo(t.cx, top);
      g.lineTo(t.belfryX + t.belfryW, t.belfryTop);
      g.lineTo(t.belfryX + t.belfryW, t.belfryBot);
      g.lineTo(t.stageX + t.stageW, t.stageTop);
      g.lineTo(t.stageX + t.stageW, t.stageBot);
      g.lineTo(t.shaftX + t.shaftW, t.stageBot);
      g.lineTo(t.shaftX + t.shaftW, t.plinth);
      g.lineTo(t.baseX + t.baseW, t.plinth);
      g.lineTo(t.baseX + t.baseW, bot);
      g.closePath();
      break;
    }
    case 'factory': {
      const sw = Math.max(5, Math.round(w * 0.18));
      const sx = Math.round(x + w * 0.5 - sw / 2);
      const shoulder = Math.round(top + bh * 0.62);
      g.moveTo(x, bot); g.lineTo(x, shoulder);
      g.lineTo(sx, shoulder); g.lineTo(sx + Math.round(sw * 0.15), top);
      g.lineTo(sx + Math.round(sw * 0.85), top); g.lineTo(sx + sw, shoulder);
      g.lineTo(x + w, shoulder); g.lineTo(x + w, bot); g.closePath();
      break;
    }
    case 'crane':
      // A low shed; the jib is stroked on top, because a filled jib at this size
      // turns into a blob.
      g.rect(x, Math.round(top + bh * 0.55), w, Math.round(bh * 0.45));
      break;
    case 'flat':
    default: {
      // A parapet, not a bare rectangle. One step in from each end is enough to
      // say the roof has an edge instead of a cut line — and boxes are now the
      // backbone of the skyline, so a bare one would be everywhere.
      //
      // Wide ones step their upper mass in as well. A box that runs the same
      // width from roof to footing is a slab; one shoulder is the difference
      // between a warehouse and a wall.
      const sb = setbackOf(b, bot);
      const ux = sb ? x + sb.inset : x;
      const uw = sb ? w - sb.inset * 2 : w;
      const pl = Math.round(uw * 0.14);
      const pr = Math.round(uw * 0.86);
      g.moveTo(x, bot);
      if (sb) {
        g.lineTo(x, sb.shoulder);
        g.lineTo(ux, sb.shoulder);
      }
      g.lineTo(ux, top + 5);
      g.lineTo(ux + pl, top + 5);
      g.lineTo(ux + pl, top);
      g.lineTo(ux + pr, top);
      g.lineTo(ux + pr, top + 5);
      g.lineTo(ux + uw, top + 5);
      if (sb) {
        g.lineTo(ux + uw, sb.shoulder);
        g.lineTo(x + w, sb.shoulder);
      }
      g.lineTo(x + w, bot);
      g.closePath();
      break;
    }
  }
}

export type SkylineStyle = {
  fill: string;
  ink: string;
  /**
   * One rung LIGHTER than `fill`, for the two-pixel rim along every top edge,
   * cornice caps and window sills. A silhouette painted in one flat value is a
   * cut-out; what makes pixel art read as built stone is that every horizontal
   * edge catches a little of the sky above it.
   */
  lit: string;
  /**
   * One rung DARKER, for the shadow side. The moon sits right of frame, so the
   * shadow is always on a block's LEFT. One convention for the whole band —
   * lighting each block from its own centre is what makes a skyline read as
   * stickers.
   */
  shade: string;
  density: number;
  /** False for the far band: at twelve pixels wide an opening is a smudge. */
  openings: boolean;
  /**
   * False for the far band too. A crocket is four pixels long; at 0.55 scale a
   * band of them reads as grit blown across the sky, not as gothic stonework.
   */
  details: boolean;
};

export function drawSkyline(
  g: CanvasRenderingContext2D,
  blocks: readonly Block[],
  bot: number,
  s: SkylineStyle,
): void {
  for (const b of blocks) {
    if (b.kind === 'gap') continue;

    // The whole silhouette in the LIGHT value first, then the same silhouette
    // dropped two pixels in the body value on top of it. What survives is a
    // two-pixel lit rim along every top edge the shape has — the gable's
    // slopes, the dome's curve, each parapet step — without one line of
    // per-shape edge code. A rim traced per kind is a rim that goes wrong on
    // the kind nobody re-checked.
    g.fillStyle = s.lit;
    massing(g, b, bot);
    g.fill();

    g.save();
    g.translate(0, RIM);
    g.fillStyle = s.fill;
    massing(g, b, bot);
    g.fill();
    g.restore();

    // Hatch is clipped to the silhouette, not to its bounding box — the whole
    // point of a vocabulary of shapes is lost if every one wears a square coat.
    g.save();
    massing(g, b, bot);
    g.clip();

    // The shadow side. Always the left, because the moon is right of frame —
    // see `SkylineStyle.shade`. Clipped, so on a spire it narrows with the
    // point instead of standing beside it as a floating bar.
    g.fillStyle = s.shade;
    g.fillRect(b.x, b.top - RIM, Math.max(3, Math.round(b.w * 0.16)), bot - b.top + RIM);

    // Openings, cut as dark holes while we are still clipped to the silhouette.
    // Addendum §C.2 says a glowing thing is a HOLE in the hatching; until now
    // there were no holes, so the window lights sat on top of solid wall.
    // Unlit windows stay dark, and that is right: a city at night is mostly
    // dark, and that is what makes the lit ones mean anything.
    if (s.openings) {
      g.fillStyle = s.ink;
      g.globalAlpha = 0.85;
      const cut = openings(b, bot);
      for (const o of cut) {
        if (o.kind === 'clock') {
          g.beginPath();
          g.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, 0, Math.PI * 2);
          g.fill();
        } else {
          g.fillRect(o.x, o.y, o.w, o.h);
          // A pointed head, two pixels of it. This is the whole gothic accent
          // at window scale: a lancet is a rectangle that loses a pixel from
          // each shoulder, and at 4x7 that is all the arch there is room for.
          // Louvres stay square — a belfry opening is a slot, not a window.
          if (o.kind === 'window' && o.w >= 4) {
            g.fillRect(o.x + 1, o.y - 2, o.w - 2, 2);
          }
        }
      }
      g.globalAlpha = 1;

      // Sills, cut after every hole so a sill can never be punched out by the
      // window below it. One lit pixel under each opening — the row of them is
      // what turns a grid of dark squares into storeys with floors between.
      g.fillStyle = s.lit;
      for (const o of cut) {
        if (o.kind === 'clock') continue;
        g.fillRect(o.x - 1, o.y + o.h, o.w + 2, 1);
      }
    }
    g.restore();
  }

  // Details. Every one of them is a FILLED block, never a stroke. A one-pixel
  // line is the thing that stopped this reading as pixel art — crockets and
  // dome ribs came out as scratches scattered around the silhouettes, and the
  // surface texture they sat on has gone with them.
  if (!s.details) return;

  for (const b of blocks) {
    if (b.kind === 'gap') continue;
    const bh = bot - b.top;
    const cx = Math.round(b.x + b.w / 2);
    // Reset per block, not once before the loop. Cases now paint in three
    // values, and whichever one the last block finished on would otherwise be
    // the colour the next one starts drawing its ironwork in.
    g.fillStyle = s.ink;
    switch (b.kind) {
      case 'flat': {
        // EVERYTHING on this roof is measured off the UPPER mass, never the
        // slot. A stepped box's roof is `inset` narrower on each side, and a
        // cornice drawn at the slot's width hung sixteen pixels out into open
        // sky on both sides of the tower — the horizontal lines that ran
        // through the skyline like scaffolding. Chimney pots spread across the
        // slot floated off the shoulder for the same reason.
        const sb = setbackOf(b, bot);
        const ux = sb ? b.x + sb.inset : b.x;
        const uw = sb ? b.w - sb.inset * 2 : b.w;
        const ucx = Math.round(ux + uw / 2);

        // Chimney pots. Terraces without them read as filing cabinets.
        g.fillStyle = s.fill;
        for (let k = 0; k < 3; k++) {
          g.fillRect(Math.round(ux + uw * (0.2 + k * 0.3)), b.top - 7, 3, 7);
        }
        // A water tank on the roof of the wider ones — the prop that says a
        // flat roof is used rather than merely flat.
        if (uw > 40) {
          g.fillRect(ucx - 6, b.top - 9, 12, 9);
          g.fillStyle = s.lit;
          g.fillRect(ucx - 6, b.top - 10, 12, 1);
        }
        // Cornice: a dark course with a lit lip riding on top of it. Two values
        // is what makes it read as a projecting ledge instead of a painted
        // stripe. Two courses at most — the parapet's, and the shoulder's where
        // a stepped box actually has a ledge. A band every few storeys was
        // tried and it put the skyline straight back to reading as scaffolding.
        const course = (y: number, cxx: number, cww: number) => {
          g.fillStyle = s.ink;
          g.fillRect(cxx, y, cww, 2);
          g.fillStyle = s.lit;
          g.fillRect(cxx, y - 1, cww, 1);
        };
        course(b.top + 8, ux, uw);
        if (sb) course(sb.shoulder, b.x, b.w);
        // The plinth the whole thing stands on, in shadow.
        g.fillStyle = s.shade;
        g.fillRect(b.x, bot - 4, b.w, 4);
        break;
      }
      case 'gable': {
        const eave = eaveOf(b, bot);
        // Shingle courses down both slopes, stepped like a pixel line rather
        // than drawn as one. This is the Stardew roof: a slope is not a colour,
        // it is a stack of short bars each one pixel below its neighbour.
        const half = Math.round(b.w / 2);
        for (let k = 1; k <= 3; k++) {
          const t = k / 4;
          const dy = Math.round(eave - b.top) * t;
          const dx = Math.round(half * t);
          g.fillStyle = k % 2 === 0 ? s.shade : s.ink;
          g.fillRect(cx - dx, Math.round(b.top + dy), dx * 2, 1);
        }
        // One dormer, off centre: a symmetrical roof reads as a diagram.
        const dx0 = Math.round(b.x + b.w * 0.62);
        g.fillStyle = s.fill;
        g.fillRect(dx0 - 4, eave - 9, 8, 9);
        g.fillStyle = s.lit;
        g.fillRect(dx0 - 5, eave - 10, 10, 1);
        g.fillStyle = s.ink;
        g.fillRect(dx0 - 2, eave - 7, 4, 4);
        // The eaves board, overhanging by a pixel each side as eaves do.
        g.fillRect(b.x - 1, eave, b.w + 2, 2);
        break;
      }
      case 'spire': {
        // Crockets: the gothic hooks that climb a spire's edges. They were
        // deleted once as four-pixel diagonal STROKES; as filled 2x2 blocks
        // stepping down the slope they are the same ornament drawn the way
        // this picture draws everything else.
        const eave = eaveOf(b, bot);
        // In `shade`, not ink, and straddling the edge by a pixel. A needle at
        // the top of the band is veiled almost to the fog's own value, and an
        // ink crocket sitting a pixel clear of it reads as a fly rather than as
        // stonework — the same failure the stroked ones had, in another form.
        g.fillStyle = s.shade;
        for (let k = 1; k <= 3; k++) {
          const t = k / 4;
          const y = Math.round(b.top + (eave - b.top) * t);
          const dx = Math.round((b.w / 2) * t);
          g.fillRect(cx - dx - 1, y, 2, 2);
          g.fillRect(cx + dx - 1, y, 2, 2);
        }
        // A cross finial. A spire is a church before it is a shape, and the
        // cross is what says so at eight pixels.
        g.fillRect(cx - 1, b.top - 9, 2, 9);
        g.fillRect(cx - 3, b.top - 6, 6, 2);
        break;
      }
      case 'dome': {
        const dr = Math.round(Math.min(b.w * 0.34, 26));
        // The lantern on top. It is what makes a dome a dome and not a hill.
        g.fillStyle = s.fill;
        g.fillRect(cx - 4, b.top - 8, 8, 8);
        g.fillStyle = s.lit;
        g.fillRect(cx - 5, b.top - 9, 10, 1);
        g.fillStyle = s.ink;
        g.fillRect(cx - 1, b.top - 13, 2, 4);
        // Meridian ribs, stopping short of the springing so they read as
        // curving away from the eye rather than as bars laid over the dome.
        g.fillStyle = s.shade;
        for (const f of [-0.62, -0.24, 0.24, 0.62]) {
          const rx = Math.round(cx + dr * f);
          const drop = Math.round(dr * (1 - Math.abs(f) * 0.55));
          g.fillRect(rx, b.top + dr - drop + 2, 1, drop);
        }
        // A band at the springing, where the dome meets its drum.
        g.fillStyle = s.ink;
        g.fillRect(cx - dr, b.top + dr, dr * 2, 2);
        g.fillStyle = s.lit;
        g.fillRect(cx - dr, b.top + dr - 1, dr * 2, 1);
        break;
      }
      case 'clockTower': {
        const t = towerOf(b, bot);
        const cap = (y: number, cx0: number, ww: number) => {
          g.fillStyle = s.ink;
          g.fillRect(cx0, y, ww, 2);
          g.fillStyle = s.lit;
          g.fillRect(cx0, y - 1, ww, 1);
        };
        // A cornice on every setback the silhouette makes. This is where the
        // tower stops being an outline and starts being masonry — each ledge
        // catches a pixel of sky, which is the same trick the flat blocks use.
        cap(t.stageBot, t.stageX - 2, t.stageW + 4);
        cap(t.belfryBot, t.belfryX - 2, t.belfryW + 4);
        cap(t.plinth, t.baseX, t.baseW);

        // Pinnacles at the belfry's four corners, the ornament that says gothic
        // rather than town hall. Blocks, never strokes — a four-pixel diagonal
        // reads as grit at this size, which is why the spires lost theirs once.
        g.fillStyle = s.fill;
        for (const sgn of [-1, 1]) {
          const px = sgn < 0 ? t.belfryX - 3 : t.belfryX + t.belfryW;
          g.fillRect(px, t.belfryTop - 5, 3, t.belfryBot - t.belfryTop + 5);
          g.fillRect(px - 1, t.belfryTop - 8, 5, 3);
        }

        // Hands, frozen. A clock that ticks in a painted city reads as a bug.
        const face = Math.max(9, Math.round(t.stageW * 0.52));
        const fy = Math.round(t.stageTop + (t.stageBot - t.stageTop) / 2);
        g.fillStyle = s.ink;
        g.fillRect(t.cx - 1, fy - Math.round(face * 0.34), 2, Math.round(face * 0.34));
        g.fillRect(t.cx, fy, Math.round(face * 0.30), 2);

        // A finial on the spire's point.
        g.fillRect(t.cx - 1, b.top - 6, 2, 6);
        break;
      }
      case 'factory': {
        const sw = Math.max(5, Math.round(b.w * 0.18));
        const sx = Math.round(b.x + b.w * 0.5 - sw / 2);
        // Iron bands, and the capping ring at the lip.
        for (const f of [0.12, 0.30]) {
          g.fillRect(sx - 1, Math.round(b.top + bh * f), sw + 2, 2);
        }
        g.fillRect(sx - 2, b.top, sw + 4, 2);
        // The shed's eaves course, where the roof meets the wall.
        const shoulder = Math.round(b.top + bh * 0.62);
        g.fillRect(b.x, shoulder, b.w, 2);
        g.fillStyle = s.lit;
        g.fillRect(b.x, shoulder - 1, b.w, 1);
        g.fillStyle = s.shade;
        g.fillRect(b.x, bot - 4, b.w, 4);
        break;
      }
      case 'crane': {
        const mx = Math.round(b.x + b.w * 0.62);
        const mastTop = Math.round(b.top + bh * 0.05);
        // Mast, jib and hook, all as bars. A stroked lattice at this size is a
        // smudge; a two-pixel bar is a crane.
        g.fillRect(mx - 1, mastTop, 2, Math.round(bh * 0.5));
        const jibX = Math.round(b.x + b.w * 0.08);
        const jibY = Math.round(mastTop + bh * 0.18);
        const steps = 6;
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          g.fillRect(
            Math.round(mx + (jibX - mx) * t),
            Math.round(mastTop + (jibY - mastTop) * t),
            2, 2,
          );
        }
        g.fillRect(jibX, jibY, 2, Math.round(bh * 0.16));
        break;
      }
    }
  }
}
