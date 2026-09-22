import type { Phase } from '../session/machine';
import type { Alerts } from '../store/schema';

/**
 * How a session announces that it has ended.
 *
 * The app had no way at all to tell you. No `document.title`, no sound, no
 * notification — which matters more here than in most apps, because the whole
 * point of a focus timer is that you press start and then look at something
 * else. A timer you have to watch is a clock.
 *
 * Three channels, in ascending order of how much they intrude, and every one
 * of them switchable. They are separate settings rather than one "alerts: on"
 * because they fail differently: the title always works, sound is a matter of
 * taste and of whether headphones are in, and a notification needs permission
 * the browser may refuse.
 */

/** Title while a phase is running: the clock first, so it survives truncation. */
export function titleFor(
  phase: Phase, clock: string, quarry: string | null, held = false,
): string {
  if (phase === 'idle') return 'Night Watch';
  // A held watch has a clock that does not move, and a countdown sitting still
  // in a tab title reads as a broken app rather than as a deliberate pause.
  if (held) return `${clock} · tertahan`;
  // The clock goes FIRST. A pinned tab shows about six characters, and
  // "Night Watch — 12:0…" is a countdown you cannot read.
  const tail = phase === 'respite' ? 'jeda' : quarry ?? 'jaga';
  return `${clock} · ${tail}`;
}

/**
 * Two notes, a fifth apart, on a triangle wave with a long decay.
 *
 * Synthesised rather than loaded: an audio asset would be the only network
 * request the app makes and the only binary in the repo, for two seconds of
 * sound. WebAudio is a handful of lines and stays silent until called.
 *
 * The context is created ON DEMAND, inside the user gesture chain that led
 * here, because a context constructed at import time starts `suspended` in
 * every browser and never recovers on its own.
 */
export function chime(): void {
  type Ctor = typeof AudioContext;
  const AC: Ctor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!AC) return;
  let ctx: AudioContext;
  try {
    ctx = new AC();
  } catch {
    return;
  }
  const now = ctx.currentTime;
  // A watchman's bell, not a notification blip: low, and the second note
  // arrives while the first is still ringing.
  for (const [i, hz] of [392, 587.33].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = hz;
    const at = now + i * 0.42;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.14, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.7);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 1.8);
  }
  // Release the hardware once the tail has rung out. Contexts left open
  // accumulate across a long session and some browsers cap how many you get.
  window.setTimeout(() => void ctx.close().catch(() => {}), 2600);
}

/** True when the browser can show notifications and the user has allowed it. */
export function canNotify(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

/**
 * Asks, and reports what happened. Called only from the settings toggle, never
 * on load: an unprompted permission dialog is the thing this app avoids by
 * having no account and no server in the first place.
 */
export async function requestNotify(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Fires the channels the user has left on.
 *
 * `title` is not handled here — it is a render-time fact, not an event, and is
 * applied by the hook every tick. This is only the punctuation at a phase's end.
 */
export function announce(a: Alerts, body: string): void {
  if (a.chime) chime();
  if (a.notify && canNotify()) {
    try {
      // `tag` collapses repeats: a laptop that wakes from sleep across two
      // finished phases should show the latest, not a stack.
      new Notification('Night Watch', { body, tag: 'nightwatch-phase', silent: a.chime });
    } catch {
      // Some browsers throw for constructed notifications outside a service
      // worker. The chime and the title have already done the job.
    }
  }
}
