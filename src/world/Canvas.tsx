import { useEffect, useRef } from 'react';
import type { AmbientValues } from '../ambient/types';
import type { Weather } from './weather';
import { defaultDeckTop } from './horizon';
import { createWorldRenderer } from './renderer';

/**
 * CSS pixels per drawn pixel. Three puts a 1512-wide window at a 504-wide
 * buffer — a genuine sprite-era resolution, which is the point: the chunk has
 * to be big enough that you read the grid, not merely a soft edge.
 */
export const PIXEL_SCALE = 3;

type Props = {
  values: AmbientValues;
  progress: number;
  motion: number;
  weather: Weather;
  /** Top of the glass panel row, in CSS pixels. The balustrade lands here. */
  deckTop: number;
};

export function World({ values, progress, motion, weather, deckTop }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Read through a ref so the rAF loop is started exactly once.
  const latest = useRef({ values, progress, motion, weather, deckTop });
  latest.current = { values, progress, motion, weather, deckTop };

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;

    const buffer = document.createElement('canvas');
    const bg = buffer.getContext('2d');
    if (!bg) return;

    const renderer = createWorldRenderer();
    let raf = 0;
    let w = 0;
    let h = 0;

    // The world is drawn into a SMALL buffer and blown up with nearest
    // neighbour. Everything keeps its existing CSS coordinates — the buffer's
    // own transform is 1/PIXEL_SCALE — so no constant anywhere had to be
    // retuned, and every curve, gradient and edge in the scene is quantised to
    // a chunky grid on the way out. This is the whole of the pixel look; it is
    // not something individual modules can opt into or forget.
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.ceil(window.innerWidth);
      h = Math.ceil(window.innerHeight);
      cv.width = Math.ceil(w * dpr);
      cv.height = Math.ceil(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      buffer.width = Math.ceil(w / PIXEL_SCALE);
      buffer.height = Math.ceil(h / PIXEL_SCALE);
      bg.setTransform(1 / PIXEL_SCALE, 0, 0, 1 / PIXEL_SCALE, 0, 0);
      bg.imageSmoothingEnabled = false;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.imageSmoothingEnabled = false;
      renderer.invalidate();
    };

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 150);
    };

    const loop = (t: number) => {
      const s = latest.current;
      renderer.frame(bg, {
        w,
        h,
        deckTop: s.deckTop || defaultDeckTop(h),
        v: s.values,
        progress: s.progress,
        timeMs: t,
        motion: s.motion,
        weather: s.weather,
      });
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(buffer, 0, 0, buffer.width, buffer.height, 0, 0, cv.width, cv.height);
      raf = requestAnimationFrame(loop);
    };

    resize();
    raf = requestAnimationFrame(loop);
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={ref} className="world" aria-hidden="true" />;
}
