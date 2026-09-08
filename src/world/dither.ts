/**
 * Bayer 4×4 ordered dithering.
 *
 * DNA §9.1, carried over unchanged by the addendum's §F: a smooth gradient
 * reads as CSS, a gradient quantised through this matrix reads as 16-bit. The
 * project had none of it — the word appeared in three comments and nowhere
 * else — so every large soft field in the picture was a browser gradient, and
 * that is most of what separated it from its own reference.
 *
 * The trap the DNA names is worth repeating: thresholding on `(x + y * 2) % 3`
 * is a periodic LATTICE, not dither. Over a smooth field a lattice hardens
 * into a one-pixel checkerboard instead of dissolving. Bayer spreads the
 * transition across a 4×4 cell in the order hardest for the eye to
 * reconstruct, so the edge crumbles rather than tiles.
 */
export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

/**
 * Few enough to look quantised, many enough not to band. The DNA's own number,
 * and it is a balance rather than a taste: at 12 the sky shows stripes, at 40
 * the dithering stops being visible and you have paid for a gradient.
 */
export const STEPS = 22;

export function quant(v: number, threshold: number, steps = STEPS): number {
  const step = 255 / steps;
  return Math.min(255, Math.max(0, Math.round((v + (threshold - 0.5) * step) / step) * step));
}

/** `color` is readonly so `Rgb` from the ambient module drops straight in. */
export type Stop = { at: number; color: readonly [number, number, number] };

/**
 * A vertical dithered gradient, as a repeating pattern.
 *
 * The DNA's version paints the whole rectangle pixel by pixel. At this frame
 * size that is two million ImageData writes for the sky alone, on every plate
 * rebuild and — for the river — on every frame.
 *
 * It is also unnecessary. A vertical gradient does not vary in x, and the Bayer
 * matrix repeats every four columns, so a tile four pixels wide contains the
 * entire pattern. Everything wider is that tile again. The cost drops from
 * `w × h` to `4 × h` and the output is identical pixel for pixel.
 */
export function ditherPattern(
  g: CanvasRenderingContext2D,
  height: number,
  stops: readonly Stop[],
  steps = STEPS,
): CanvasPattern | null {
  const h = Math.max(1, Math.round(height));
  // No DOM at all in the pure-module test environment, and no 2-D context in
  // some privacy modes. Callers fall back to a smooth gradient: the wrong
  // texture beats a missing surface.
  if (typeof document === 'undefined' || stops.length === 0) return null;
  const cv = document.createElement('canvas');
  cv.width = 4;
  cv.height = h;
  const tg = cv.getContext('2d');
  if (!tg) return null;

  const img = tg.createImageData(4, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const ty = h === 1 ? 0 : y / (h - 1);
    let i = 0;
    while (i < stops.length - 2 && ty > stops[i + 1]!.at) i++;
    const s0 = stops[i]!;
    const s1 = stops[i + 1] ?? s0;
    const span = s1.at - s0.at;
    const f = span === 0 ? 0 : Math.min(1, Math.max(0, (ty - s0.at) / span));
    const r = s0.color[0] + (s1.color[0] - s0.color[0]) * f;
    const gg = s0.color[1] + (s1.color[1] - s0.color[1]) * f;
    const b = s0.color[2] + (s1.color[2] - s0.color[2]) * f;

    for (let x = 0; x < 4; x++) {
      const th = BAYER4[y & 3]![x]! / 16;
      const o = (y * 4 + x) * 4;
      d[o] = quant(r, th, steps);
      d[o + 1] = quant(gg, th, steps);
      d[o + 2] = quant(b, th, steps);
      d[o + 3] = 255;
    }
  }
  tg.putImageData(img, 0, 0);
  // `repeat-x` only: the tile is already the full height, and letting it repeat
  // vertically would restart the gradient below the band it was built for.
  return g.createPattern(cv, 'repeat-x');
}
