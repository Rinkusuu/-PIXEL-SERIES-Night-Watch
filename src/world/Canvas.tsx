import { useEffect, useRef } from 'react';
import type { AmbientValues } from '../ambient/types';
import type { Weather } from './weather';
import { defaultDeckTop } from './horizon';
import { createWorldRenderer } from './renderer';

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

    // The world is drawn at CSS resolution into a buffer and blown up to the
    // device with nearest neighbour. On a retina screen that is a clean 2x, so
    // every edge lands on a hard pixel boundary instead of an antialiased ramp.
    //
    // The buffer is deliberately the SAME size the scene was always designed
    // at: one CSS pixel per drawn pixel. A smaller buffer was tried and it
    // destroyed four rounds of work — a 4x7 window became 1x2 and the figures
    // became five pixels tall. Crispness is free; resolution is not.
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.ceil(window.innerWidth);
      h = Math.ceil(window.innerHeight);
      cv.width = Math.ceil(w * dpr);
      cv.height = Math.ceil(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      buffer.width = w;
      buffer.height = h;
      bg.setTransform(1, 0, 0, 1, 0, 0);
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
