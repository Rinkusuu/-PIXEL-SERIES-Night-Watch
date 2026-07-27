import type { AmbientValues } from '../ambient/types';
import { drawFog } from './fog';
import { drawLamps } from './bloom';
import { drawStatic } from './layers';

/** Largest single-channel difference between two hex colours. */
export function channelDrift(a: string, b: string): number {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return Math.max(
    Math.abs(ar! - br!), Math.abs(ag! - bg!), Math.abs(ab! - bb!),
  );
}

/** Addendum §B.3 — redraw the static plate only when it would visibly change. */
const REDRAW_THRESHOLD = 6;

export function createWorldRenderer() {
  let cache: HTMLCanvasElement | null = null;
  let cachedMid = '';
  let cachedW = 0;
  let cachedH = 0;

  function invalidate(): void {
    cache = null;
  }

  function frame(
    target: CanvasRenderingContext2D,
    w: number,
    h: number,
    v: AmbientValues,
    progress: number,
    timeMs: number,
    motion: number,
  ): void {
    const stale =
      cache === null ||
      cachedW !== w ||
      cachedH !== h ||
      channelDrift(cachedMid, v.mid) > REDRAW_THRESHOLD;

    if (stale) {
      const cv = cache ?? document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const g = cv.getContext('2d');
      if (g) {
        g.clearRect(0, 0, w, h);
        drawStatic(g, w, h, v, progress);
      }
      cache = cv;
      cachedMid = v.mid;
      cachedW = w;
      cachedH = h;
    }

    target.clearRect(0, 0, w, h);
    if (cache) target.drawImage(cache, 0, 0);
    drawFog(target, w, h, v, timeMs, motion);
    drawLamps(target, w, h, v, progress, timeMs, motion);
  }

  return { frame, invalidate };
}
