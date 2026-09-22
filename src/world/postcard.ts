import type { Weather } from './weather';

/**
 * A plate of tonight's view.
 *
 * The world is redrawn sixty times a second and has never once been able to
 * leave the tab. Nothing new is generated here — the canvas on screen is the
 * source — so a postcard is exactly what you were looking at, which is the
 * only version worth keeping.
 *
 * No network, no asset, no library. The one thing this adds to the app is a
 * `toBlob` call.
 */

export type PostcardFacts = {
  /** The night key, `YYYY-MM-DD`. */
  night: string;
  weather: Weather;
  minutes: number;
  sessions: number;
  streak: number;
};

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
] as const;

/** The world speaks English. The plate is part of the world, not of the chrome. */
const WEATHER_WORD: Record<Weather, string> = {
  clear: 'CLEAR', fog: 'FOG', rain: 'RAIN', fullmoon: 'FULL MOON',
};

/**
 * `2026-09-22` becomes `22 SEPTEMBER 2026`.
 *
 * Parsed by hand rather than through `new Date(key)`, which reads a bare
 * `YYYY-MM-DD` as UTC and would print the night before for anyone west of
 * Greenwich — on a plate whose entire subject is which night this was.
 */
export function longNight(night: string): string {
  const [y, m, d] = night.split('-').map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return night;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Minutes as a watchman would say them: hours first, and never `0h 45m`. */
export function longSpan(minutes: number): string {
  if (minutes < 60) return `${minutes}M`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}H` : `${h}H ${m}M`;
}

/**
 * What the plate says, as text — separated from the drawing so the wording can
 * be tested without a canvas, which is the half of this that can actually be
 * got wrong.
 */
export function postcardLines(f: PostcardFacts): [string, string, string] {
  return [
    'NIGHT WATCH',
    longNight(f.night),
    // A night with nothing on it still gets a plate. The view was the same.
    f.sessions === 0
      ? `${WEATHER_WORD[f.weather]} · NO WATCH KEPT`
      : `${WEATHER_WORD[f.weather]} · ${f.sessions} WATCH${f.sessions === 1 ? '' : 'ES'}`
        + ` · ${longSpan(f.minutes)} · ${f.streak} NIGHT${f.streak === 1 ? '' : 'S'}`,
  ];
}

export function postcardName(night: string): string {
  return `night-watch-${night}.png`;
}

/** Ink for the plate. Fixed, like `VIGNETTE_INK`: a plate is not weather. */
const PLATE_INK = '#0a0d11';
const PLATE_RULE = '#2a3138';
const PLATE_TEXT = '#c9d2d6';
const PLATE_DIM = '#7b868c';

/**
 * Compose the postcard: the view as drawn, and an engraved plate beneath it.
 *
 * The plate goes BELOW rather than over the picture. A caption laid across the
 * river would cover the one thing the postcard is of, and the vignette's whole
 * job is that its corners stay dark and empty.
 */
export function drawPostcard(
  source: HTMLCanvasElement, f: PostcardFacts,
): HTMLCanvasElement {
  const w = source.width;
  // Everything on the plate is sized from the width, so a postcard taken on a
  // phone and one taken on a monitor are the same design rather than the same
  // pixel measurements at two scales.
  const u = Math.max(2, Math.round(w / 190));
  const plateH = u * 13;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = source.height + plateH;
  const g = out.getContext('2d');
  if (!g) return out;

  g.imageSmoothingEnabled = false;
  g.drawImage(source, 0, 0);

  const top = source.height;
  g.fillStyle = PLATE_INK;
  g.fillRect(0, top, w, plateH);
  // A hairline between the view and the plate, so the picture has an edge
  // rather than bleeding into its own caption.
  g.fillStyle = PLATE_RULE;
  g.fillRect(0, top, w, Math.max(1, Math.round(u / 3)));

  const [title, date, facts] = postcardLines(f);
  g.textBaseline = 'alphabetic';

  g.font = `${u * 2.4}px 'Press Start 2P', monospace`;
  g.fillStyle = PLATE_TEXT;
  g.fillText(title, u * 3, top + u * 5.5);

  g.font = `${u * 1.5}px 'Press Start 2P', monospace`;
  g.fillStyle = PLATE_DIM;
  g.fillText(facts, u * 3, top + u * 10);

  // The date is right-aligned against the other edge: it is the one fact a
  // plate exists to fix, and putting it opposite the title makes the two read
  // as a pair of marks on the same object rather than as a stack of lines.
  g.font = `${u * 1.5}px 'Press Start 2P', monospace`;
  g.fillStyle = PLATE_TEXT;
  const dw = g.measureText(date).width;
  g.fillText(date, w - u * 3 - dw, top + u * 10);

  return out;
}

/** Hand it to the browser. Same shape as `downloadTransfer` in the store. */
export function downloadPostcard(canvas: HTMLCanvasElement, night: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = postcardName(night);
    a.click();
    // Revoked on the next turn, not immediately: a synchronous revoke can beat
    // the download the click just started.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
