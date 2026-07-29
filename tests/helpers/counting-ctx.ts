/** Counts every drawing call, so we can assert on work done without a canvas. */
export function countingCtx(): { g: CanvasRenderingContext2D; calls: () => number } {
  let calls = 0;
  const grad = { addColorStop: () => {} };
  const g = new Proxy({} as CanvasRenderingContext2D, {
    get(_t, key) {
      if (key === 'createRadialGradient' || key === 'createLinearGradient') {
        return () => { calls++; return grad; };
      }
      return () => { calls++; };
    },
    set: () => true,
  });
  return { g, calls: () => calls };
}
