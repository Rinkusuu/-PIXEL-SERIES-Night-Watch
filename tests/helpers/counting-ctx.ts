/**
 * Counts every drawing call, so we can assert on work done without a canvas.
 *
 * `strokes` is counted separately because a total is dominated by the hatch —
 * hundreds of moveTo/lineTo pairs swamp any detail work, and a bound on the
 * total could not fail if every stroked detail were deleted.
 */
export function countingCtx(): {
  g: CanvasRenderingContext2D;
  calls: () => number;
  strokes: () => number;
} {
  let calls = 0;
  let strokes = 0;
  const grad = { addColorStop: () => {} };
  const g = new Proxy({} as CanvasRenderingContext2D, {
    get(_t, key) {
      if (key === 'createRadialGradient' || key === 'createLinearGradient') {
        return () => { calls++; return grad; };
      }
      if (key === 'stroke') return () => { calls++; strokes++; };
      return () => { calls++; };
    },
    set: () => true,
  });
  return { g, calls: () => calls, strokes: () => strokes };
}
