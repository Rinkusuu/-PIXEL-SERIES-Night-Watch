import type { AmbientValues } from '../ambient/types';
import { hexToRgb, mixRgb, rgbToHex } from '../ambient/interpolate';
import type { Block } from './city';
import type { Horizon } from './horizon';
import { stream } from './rng';
import { HATCH_ANGLES, hatch } from './hatch';

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
 * Lighter than the far city's 0.18. Cloud is further off than anything standing
 * on the ground, and the hatch is what keeps it in the same drawing as the rest
 * of the plate rather than a flat shape pasted over it.
 */
const CLOUD_DENSITY = 0.13;

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

export function drawSky(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  v: AmbientValues,
  blocks: readonly Block[],
  moon: { x: number; y: number },
  fogScale: number,
  /** Engraving ink, passed in like `drawForeground`'s — never derived here. */
  ink: string,
  seed: number,
): void {
  const sky0 = hexToRgb(v.sky[0]);

  // 1 — stars, furthest back.
  const vis = starVisibility(fogScale);
  if (vis > 0.02) {
    g.save();
    g.fillStyle = v.lift;
    for (const s of starField(w, hz, seed)) {
      // The moon washes out everything near it, and the haze takes the ones
      // low down first.
      const dx = s.x - moon.x;
      const dy = s.y - moon.y;
      const near = Math.min(1, Math.hypot(dx, dy) / (w * 0.22));
      const high = 1 - s.y / Math.max(1, hz.skyBot);
      const a = s.a * vis * near * (0.35 + high * 0.65);
      if (a < 0.03) continue;
      g.globalAlpha = a;
      g.fillRect(s.x, s.y, s.r, s.r);
    }
    g.restore();
  }

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

  // 3 — cloud banks. Body a step toward the sky's own darkest stop, so they stay
  //     on the sky's scale instead of borrowing the depth ladder, which measures
  //     from the fog and has nothing to say about anything above it.
  g.save();
  g.lineWidth = 1;
  for (const cloud of cloudBanks(w, hz, seed + 991)) {
    const spineY = cloud.lobes.reduce((s, l) => s + l.y, 0) / cloud.lobes.length;
    const t = Math.min(1, spineY / Math.max(1, hz.waterTop));
    const local = mixRgb(sky0, hexToRgb(v.sky[1]), t);

    // ONE path for the whole bank. Filling lobe by lobe doubles the alpha
    // wherever two overlap and shows every lobe's own outline through the
    // body — a row of pills, not a cloud. `moveTo` before each ellipse or the
    // subpaths get joined by a line.
    const trace = () => {
      g.beginPath();
      for (const l of cloud.lobes) {
        g.moveTo(l.x + l.rx, l.y);
        g.ellipse(l.x, l.y, l.rx, l.ry, 0, 0, Math.PI * 2);
      }
    };

    const bankTop = Math.min(...cloud.lobes.map((l) => l.y - l.ry));
    const bankBot = Math.max(...cloud.lobes.map((l) => l.y + l.ry));

    trace();
    g.globalAlpha = 0.70;
    g.fillStyle = rgbToHex(mixRgb(local, sky0, 0.62));
    g.fill();

    // Cloud is HATCHED, like everything else that is cut into the sky. The sky
    // itself stays bare because it is the paper; a cloud is an object drawn on
    // that paper, and a flat vector fill in a plate made entirely of line work
    // is the one thing in the picture that does not belong to it.
    //
    // Lighter than the far city — cloud is further off than anything standing
    // on the ground, and the same angle marks the same depth (§C.2).
    g.save();
    trace();
    g.clip();
    hatch(g, 0, bankTop, w, bankBot - bankTop, CLOUD_DENSITY, {
      angle: HATCH_ANGLES.far, color: ink,
    });
    g.restore();

    // The side the moon is on, washed in with a gradient INSIDE the bank —
    // never stroked. `fill` merges overlapping subpaths; `stroke` does not, so
    // stroking the same path draws a loop of wire around every ellipse in it,
    // including the ones buried in the middle, and the sky fills with gold
    // noodles. Canvas will not hand out a union outline, so the lit edge has to
    // be painted rather than drawn.
    const below = moon.y > spineY;
    g.save();
    trace();
    g.clip();
    const wash = g.createLinearGradient(
      0, below ? bankTop : bankBot, 0, below ? bankBot : bankTop,
    );
    // Only the outer edge catches. A wash that starts at the far side turns the
    // whole bank into a lamp, and the top of the frame has no business being
    // the brightest thing in it.
    wash.addColorStop(0, 'transparent');
    wash.addColorStop(0.62, 'transparent');
    // `lift`, not `glow`. The moon is near-white and it is what lights these;
    // the amber belongs to the gas, and §D says it is the picture's only warm
    // colour. A sky full of it undoes the whole cold palette.
    wash.addColorStop(1, v.lift);
    g.globalAlpha = 0.16;
    g.fillStyle = wash;
    g.fillRect(0, bankTop, w, bankBot - bankTop);
    g.restore();
  }
  g.restore();
}
