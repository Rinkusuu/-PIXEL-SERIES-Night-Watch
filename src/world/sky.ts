import type { AmbientValues } from '../ambient/types';
import { hexToRgb, mixRgb, rgbToHex } from '../ambient/interpolate';
import type { Block } from './city';
import type { Horizon } from './horizon';
import { stream } from './rng';
import { MOON_DISC } from './bloom';

/**
 * The sky was the largest surface in the frame and the only one with nothing in
 * it — one vertical gradient, identical at every x. Everything here goes on the
 * cached plate, so it costs nothing per frame.
 *
 * Nothing in this module moves. DNA §8.1 forbids wide-area motion and the fog
 * bands already hold the sky's one allowance for it. A cloud that crosses the
 * screen over a fifty-minute session reads as weather passing; a still one
 * reads as a painted sky, which is what an engraved plate is.
 */

export type Star = { x: number; y: number; r: number; a: number };
export type Lobe = { x: number; y: number; rx: number; ry: number };
export type Cloud = { lobes: Lobe[] };

const STAR_COUNT = 90;
/** Cloud bands, from the top of the sky downward. */
const BANDS = 3;

/**
 * Stars crowd toward the top of the sky: the ones near the horizon are the
 * first thing haze takes, and this is the same shape that loss has.
 */
export function starField(w: number, hz: Horizon, seed: number): Star[] {
  const r = stream(seed);
  const out: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    out.push({
      x: Math.round(r() * w),
      y: Math.round(Math.pow(r(), 1.9) * hz.skyBot),
      r: r() < 0.85 ? 1 : 2,
      a: 0.3 + r() * 0.6,
    });
  }
  return out;
}

/**
 * Torn banks, not fluffy heaps. What makes them torn is the SPACING: most lobes
 * overlap their neighbour, some leave a gap.
 *
 * Bands nearer the HORIZON are thinner. That is the direction perspective
 * actually runs: cloud low in the frame is further away and compresses toward
 * the vanishing line, while cloud overhead is close and keeps its depth.
 */
export function cloudBanks(w: number, hz: Horizon, seed: number): Cloud[] {
  const r = stream(seed);
  const out: Cloud[] = [];
  for (let b = 0; b < BANDS; b++) {
    const spineY = hz.skyBot * (0.16 + b * 0.27);
    const thin = 1 - b * 0.22;
    const lobes: Lobe[] = [];
    // Always starts off-frame, and runs until it has COVERED the far edge —
    // not until the cursor has passed it. A tear that opens near the right
    // edge can carry the cursor beyond the frame while the last lobe drawn
    // still ends short, and the sky's corner is left bare. The left edge had
    // the same hole from the other direction.
    let x = -w * (0.12 + r() * 0.10);
    let covered = -Infinity;
    for (let guard = 0; covered < w && guard < 200; guard++) {
      // Skewed small: many little lobes with the occasional big one. An even
      // spread of similar radii lays them out tangent to each other and the
      // bank comes out as a run of smooth lozenges — the silhouette has to be
      // ragged or no amount of hatching will make it read as cloud.
      const rx = Math.max(4, Math.round(w * (0.010 + Math.pow(r(), 1.7) * 0.078)));
      const ry = Math.max(2, Math.round(rx * (0.18 + r() * 0.34) * thin));
      lobes.push({
        x: Math.round(x),
        y: Math.round(spineY + (r() - 0.5) * ry * 3.0),
        rx,
        ry,
      });
      covered = x + rx;
      // Clump tight, then tear wide open. Anything gentler and the bank comes
      // out as one long sausage across the frame.
      x += rx * (r() < 0.55 ? 0.7 : 2.6 + r() * 2.4);
    }
    out.push({ lobes });
  }
  return out;
}

/**
 * Where the city's light pollution pools. Weighted by `height² × width`, so the
 * dome finds the tower district rather than sitting politely in the middle of
 * the frame. A city is not symmetrical and its glow should not pretend to be.
 */
export function cityGlowAnchor(
  blocks: readonly Block[], w: number, cityTop: number, cityBot: number,
): number {
  const span = Math.max(1, cityBot - cityTop);
  let num = 0;
  let den = 0;
  for (const b of blocks) {
    const tall = (cityBot - b.top) / span;
    const weight = tall * tall * b.w;
    num += (b.x + b.w / 2) * weight;
    den += weight;
  }
  return den > 0 ? num / den : w / 2;
}

/**
 * How much of a star survives the night's haze. A foggy night has no stars at
 * all, and a wet one has the most — rain washes the fog out, which `weather.ts`
 * already says in so many words.
 */
export function starVisibility(fogScale: number): number {
  return Math.max(0, 1 - fogScale * 0.55);
}

/**
 * The stars, live.
 *
 * They were baked onto the cached plate, which rebuilds only when the size,
 * the weather, the deck or the palette move — so for minutes at a time the
 * entire sky was a photograph. `drawSky` did not even take a time argument;
 * there was nothing to animate them WITH.
 *
 * The twinkle is an OPACITY change and never a movement, which is why it is
 * not gated on `motion`: a reader who has turned motion off has asked for
 * nothing to travel, not for the sky to die. It is the one thing that keeps
 * breathing when everything else is held still.
 */
export function drawStars(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  v: AmbientValues,
  moon: { x: number; y: number },
  fogScale: number,
  timeMs: number,
  seed: number,
): void {
  const vis = starVisibility(fogScale);
  if (vis <= 0.02) return;
  g.save();
  g.fillStyle = v.lift;
  for (const [i, s] of starField(w, hz, seed).entries()) {
    // The moon washes out everything near it, and the haze takes the ones
    // low down first.
    const dx = s.x - moon.x;
    const dy = s.y - moon.y;
    const near = Math.min(1, Math.hypot(dx, dy) / (w * 0.22));
    const high = 1 - s.y / Math.max(1, hz.skyBot);
    // Each star keeps its own period and its own phase. One shared period is a
    // sky that pulses as a single sheet, which is not twinkling, it is a fault
    // in the projector.
    const period = 1400 + (i % 17) * 260;
    const tw = 0.62 + 0.38 * Math.sin(timeMs / period + i * 1.7);
    const a = s.a * vis * near * (0.35 + high * 0.65) * tw;
    if (a < 0.03) continue;
    g.globalAlpha = a;
    g.fillRect(s.x, s.y, s.r, s.r);
  }
  g.restore();
}

export function drawSky(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  v: AmbientValues,
  blocks: readonly Block[],
  moon: { x: number; y: number },
  /** Already scaled by the weather. From bloom.ts, so halo and body agree. */
  moonR: number,
  fogScale: number,
  /** Engraving ink, passed in like `drawForeground`'s — never derived here. */
  ink: string,
  seed: number,
): void {
  // 2 — the gas dome over the city. The only honest reason for the sky to vary
  //     horizontally at all.
  const anchor = cityGlowAnchor(blocks, w, hz.cityTop, hz.cityBot);
  const domeR = w * 0.42;
  const dome = g.createRadialGradient(anchor, hz.cityBot, 0, anchor, hz.cityBot, domeR);
  dome.addColorStop(0, v.glow);
  dome.addColorStop(1, 'transparent');
  g.save();
  g.globalAlpha = 0.12;
  g.fillStyle = dome;
  g.fillRect(0, 0, w, hz.cityBot);
  g.restore();

  // 2b — the moon's body, BEFORE the cloud banks and before the skyline.
  //
  //      Two occlusions, and the order is the whole of both. The city is drawn
  //      after `drawSky` returns, so the skyline stands in front of the moon on
  //      its own. The clouds are drawn a few lines below this, so a bank can
  //      now pass across its face — which it could not when the moon was drawn
  //      last and sat on top of everything in the sky including the weather.
  //
  //      The wide corona is still drawn live by `drawLamps`, over the finished
  //      plate, because that one belongs in front: it is moisture in the air
  //      between you and everything else, and it genuinely does wash over the
  //      near buildings as well as the far ones.
  g.save();
  g.globalCompositeOperation = 'lighter';
  const tight = g.createRadialGradient(moon.x, moon.y, 0, moon.x, moon.y, moonR * 3.6);
  tight.addColorStop(0, v.glow);
  tight.addColorStop(1, 'transparent');
  g.globalAlpha = 0.30 + v.lum * 0.1;
  g.fillStyle = tight;
  g.beginPath();
  g.arc(moon.x, moon.y, moonR * 3.6, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // The disc itself is opaque, not additive: it is the brightest thing in the
  // picture and the top of the value range, the same reason `MOON_DISC` is a
  // fixed constant rather than an ambient role.
  g.save();
  g.globalAlpha = Math.min(1, 0.62 + v.lum * 0.3);
  g.fillStyle = MOON_DISC;
  g.beginPath();
  g.arc(moon.x, moon.y, moonR, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/**
 * The quantum a cloud is built out of.
 *
 * Four, the same step the dither tile uses. A cloud was drawn with
 * `ctx.ellipse` — a smooth curve, in a picture whose first rule is that matter
 * is quantised and only light is not. A cloud is matter. It was the one object
 * in the frame drawing its own outline with a compass, and at this scale a
 * smooth ellipse next to a stepped roofline does not read as softness, it
 * reads as a different program.
 */
export const CLOUD_STEP = 4;

/**
 * How far a bank has drifted.
 *
 * Each band has its own speed and they are not multiples of each other, so the
 * three never line up into one sliding sheet — the same rule `fogOffset`
 * follows, for the same reason. Motion zero stops them dead; this is
 * wide-area travel and it is exactly what §8.1 is about.
 */
export function cloudDrift(timeMs: number, band: number, motion: number): number {
  const speed = [0.0042, -0.0027, 0.0016][band % 3]!;
  return timeMs * speed * motion;
}

/**
 * A bank, as a run of columns rather than a row of ellipses.
 *
 * Each column takes the UNION of every lobe covering it — one top, one bottom,
 * whatever the lobes underneath are doing. That solves by construction the
 * thing the old path-based version needed a comment to explain: filling lobe
 * by lobe doubled the alpha wherever two overlapped and showed every lobe's
 * outline through the body. There are no lobe outlines here. There is a
 * silhouette, and it is made of pixels.
 */
function cloudColumns(lobes: readonly Lobe[]): { x: number; top: number; h: number }[] {
  const out: { x: number; top: number; h: number }[] = [];
  const minX = Math.min(...lobes.map((l) => l.x - l.rx));
  const maxX = Math.max(...lobes.map((l) => l.x + l.rx));
  for (let cx = Math.floor(minX / CLOUD_STEP) * CLOUD_STEP; cx < maxX; cx += CLOUD_STEP) {
    const mid = cx + CLOUD_STEP / 2;
    let top = Infinity;
    let bot = -Infinity;
    for (const l of lobes) {
      const dx = (mid - l.x) / l.rx;
      if (dx <= -1 || dx >= 1) continue;
      const dy = l.ry * Math.sqrt(1 - dx * dx);
      if (l.y - dy < top) top = l.y - dy;
      if (l.y + dy > bot) bot = l.y + dy;
    }
    if (top === Infinity) continue;
    /* Stepped in x, rounded to the whole pixel in y — NOT quantised to the
       same coarse step in both.
       It was, and that is what a staircase looks like when you take the risers
       away as well as the treads: the banks came out as long flat slabs, and
       every lobe shorter than the step vanished into the one beside it. The
       silhouette has to be ragged or no amount of texture makes it read as
       cloud, and the raggedness lives entirely in the small lobes.
       Four across and one down is the staircase. That IS the pixel grid; it is
       only the horizontal run that has to be coarse enough to see. */
    const qt = Math.round(top);
    const qb = Math.round(bot);
    if (qb - qt < 2) continue;
    out.push({ x: cx, top: qt, h: qb - qt });
  }
  return out;
}

/**
 * The cloud banks, live and drifting.
 *
 * Body a step toward the sky's own darkest stop, so they stay on the sky's
 * scale instead of borrowing the depth ladder, which measures from the fog and
 * has nothing to say about anything above it.
 */
export function drawClouds(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  v: AmbientValues,
  moon: { x: number; y: number },
  timeMs: number,
  motion: number,
  seed: number,
): void {
  const sky0 = hexToRgb(v.sky[0]);
  g.save();
  for (const [b, cloud] of cloudBanks(w, hz, seed + 991).entries()) {
    const cols = cloudColumns(cloud.lobes);
    if (cols.length === 0) continue;

    const spineY = cloud.lobes.reduce((s, l) => s + l.y, 0) / cloud.lobes.length;
    const t = Math.min(1, spineY / Math.max(1, hz.waterTop));
    const local = mixRgb(sky0, hexToRgb(v.sky[1]), t);
    const body = rgbToHex(mixRgb(local, sky0, 0.62));

    // The bank is wider than the frame by construction, so its own span is the
    // wrap period: a clump that leaves the left edge arrives at the right one
    // still a clump, instead of being torn apart lobe by lobe.
    const span = cols[cols.length - 1]!.x + CLOUD_STEP - cols[0]!.x;
    const drift = cloudDrift(timeMs, b, motion);
    const below = moon.y > spineY;

    for (const c of cols) {
      let x = c.x + drift;
      x = ((x - cols[0]!.x) % span + span) % span + cols[0]!.x;
      if (x > w || x + CLOUD_STEP < 0) continue;
      const qx = Math.round(x / CLOUD_STEP) * CLOUD_STEP;

      g.globalAlpha = 0.70;
      g.fillStyle = body;
      g.fillRect(qx, c.top, CLOUD_STEP, c.h);

      /* The lit edge, as ONE stepped course on the moon's side.
         It was a linear gradient clipped to the bank — a smooth wash, which is
         the same fault as the smooth outline, and it needed a long comment
         about why `stroke` could not be used. A single row of pixels on the
         side the light comes from says the same thing in the picture's own
         vocabulary, and says it more clearly.
         `lift`, not `glow`: the moon is near-white and it is what lights
         these. The amber belongs to the gas, and §D says it is the picture's
         only warm colour — a sky full of it undoes the whole cold palette. */
      g.globalAlpha = 0.20;
      g.fillStyle = v.lift;
      const rim = Math.min(2, c.h);
      g.fillRect(qx, below ? c.top + c.h - rim : c.top, CLOUD_STEP, rim);
    }
  }
  g.restore();
}
