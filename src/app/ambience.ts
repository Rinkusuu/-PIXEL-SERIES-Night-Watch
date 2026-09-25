import type { Weather } from '../world/weather';

/**
 * The sound of the embankment.
 *
 * Every sound here is SYNTHESISED. There is no audio file in this project and
 * there is not going to be one: an asset would be the only binary in the repo
 * and the only thing the service worker had to fetch that was not code, for a
 * few seconds of noise that four filters make better.
 *
 * Three rules, taken from the dashboard next door because it learned them the
 * hard way:
 *
 *   · Nothing makes a sound until it is asked to. It is off by default and it
 *     needs a real gesture to start. A page that begins playing at you is a
 *     hostile page, and the chime is already the one thing here allowed to
 *     interrupt.
 *   · The context is built lazily, inside the gesture. Constructed at import
 *     time it is born `suspended` in every browser and never recovers.
 *   · Every gain change is RAMPED. A bare `.value =` on a live gain is an
 *     instantaneous discontinuity, and that discontinuity is the click you
 *     hear in bad web audio.
 */

/** The mix, as numbers. Separated from the nodes so it can be tested at all. */
export type Mix = {
  /** The river under everything. Always present; it is what the place is. */
  river: number;
  /** Rain on stone. */
  rain: number;
  /** Wind through the ironwork. */
  wind: number;
  /**
   * Low-pass cutoff in Hz, applied to the whole bed.
   *
   * This is the entire trick of the weather here. Fog and snow do not add a
   * sound, they TAKE the top off everything — which is what they actually do
   * to a city, and why a foggy night is remembered as a quiet one even though
   * nothing has stopped. A clear night is bright and a bit hard; a foggy one
   * is the same river heard through a blanket.
   */
  cutoff: number;
};

export function mixFor(weather: Weather, progress: number): Mix {
  // The night deepens and the traffic thins. Even the river gets quieter, not
  // because the Thames slows down but because there is less on it.
  const deep = 1 - Math.abs(progress - 0.62) * 0.45;

  switch (weather) {
    case 'rain':
      // Rain is the loudest weather and the one that clears the air. It also
      // drowns the river, which is not a mistake — standing in it, you would
      // not hear the water you are standing over.
      return { river: 0.22 * deep, rain: 0.62, wind: 0.16, cutoff: 5200 };
    case 'snow':
      // Snow is the quietest thing that happens to a city. Nothing is added at
      // all; the whole bed just loses its edges.
      return { river: 0.26 * deep, rain: 0, wind: 0.10, cutoff: 900 };
    case 'fog':
      return { river: 0.30 * deep, rain: 0, wind: 0.07, cutoff: 1400 };
    case 'fullmoon':
      // A clear cold night carries further than any other.
      return { river: 0.40 * deep, rain: 0, wind: 0.20, cutoff: 7000 };
    default:
      return { river: 0.34 * deep, rain: 0, wind: 0.14, cutoff: 4800 };
  }
}

/**
 * Which hour a church bell should be striking, and how many times.
 *
 * Tied to the WALL CLOCK, not to the session — the same decision the barge
 * already makes. A bell that only rang while you were working would be a
 * reward; a bell that rings at one in the morning whether or not anyone is
 * listening is a city.
 *
 * Returns null except in the first minute of the hour, so a tab left open
 * overnight rings twelve times a night and not once a frame.
 */
export function bellAt(nowMs: number): number | null {
  const d = new Date(nowMs);
  if (d.getMinutes() !== 0) return null;
  const h = d.getHours() % 12;
  return h === 0 ? 12 : h;
}

/** The interval between strokes of the hour. Slow: a tenor bell is not a clock. */
const BELL_GAP_S = 2.4;

export type Ambience = ReturnType<typeof createAmbience>;

export function createAmbience() {
  type Ctor = typeof AudioContext;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let beds: { river: GainNode; rain: GainNode; wind: GainNode; tone: BiquadFilterNode } | null = null;
  let lastBellHour = -1;
  let volume = 0.5;

  /**
   * Three seconds of white noise, made once.
   *
   * Three and not one: a one-second loop at this length is short enough that
   * the ear finds the seam and the river starts to sound like a machine.
   */
  function noiseBuffer(c: AudioContext): AudioBuffer {
    const len = c.sampleRate * 3;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function build(): boolean {
    if (ctx) return true;
    const AC: Ctor | undefined =
      window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!AC) return false;

    const c = new AC();
    const out = c.createGain();
    out.gain.value = 0;
    out.connect(c.destination);

    // One filter for the whole bed, so the weather can take the top off
    // everything at once instead of each layer being muffled separately and
    // drifting out of step with the others.
    const tone = c.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 4800;
    tone.Q.value = 0.4;
    tone.connect(out);

    const buf = noiseBuffer(c);
    const layer = (type: BiquadFilterType, freq: number, q: number) => {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = c.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(tone);
      src.start();
      // The filter comes back too. It was not, and the LFO below was written
      // to reach for it through a property that never existed — so the gust
      // connected to nothing and the wind was flat hiss that looked, in the
      // source, exactly like working code.
      return { gain: g, filter: f };
    };

    // The river: low, wide, almost all body. The Thames at a stone wall is not
    // a babbling brook — it is a big slow mass of water with no top end.
    const river = layer('lowpass', 380, 0.7).gain;
    // Rain: a band up where the drops actually hit, not the whole spectrum.
    const rain = layer('bandpass', 1900, 0.6).gain;
    // Wind: a narrow band, and it gets an LFO below so it breathes. Without
    // the LFO this is not wind, it is hiss.
    const wind = layer('bandpass', 620, 1.2);

    const lfo = c.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain);
    lfo.start();
    // Into the wind band's own cutoff, so the gust moves THROUGH the sound
    // rather than just turning it up and down.
    lfoGain.connect(wind.filter.frequency);

    ctx = c;
    master = out;
    beds = { river, rain, wind: wind.gain, tone };
    return true;
  }

  /** Ramped, always. `ramp` is the shortest slide the ear reads as smooth. */
  const glide = (p: AudioParam, to: number, seconds = 0.6) => {
    if (!ctx) return;
    p.cancelScheduledValues(ctx.currentTime);
    p.setTargetAtTime(to, ctx.currentTime, Math.max(0.01, seconds / 3));
  };

  /** The one-shot listeners waiting for a gesture, so they can be taken off. */
  let armed: (() => void) | null = null;

  /**
   * Is the browser willing to let us start RIGHT NOW?
   *
   * Transient user activation is exactly this question, and asking it is the
   * only way to avoid constructing a context we are not allowed to run —
   * which is itself what Chrome logs the warning for, before anyone calls
   * `resume`. The first version of this armed a resume but still built the
   * context on mount, so a tab reloaded with the sound remembered on logged
   * six warnings before it had done anything at all.
   *
   * I checked for those warnings after the first fix and saw none, because I
   * had just switched the sound OFF to test the cold path. Verified under the
   * wrong condition is not verified.
   */
  function canStartNow(): boolean {
    const ua = (navigator as unknown as { userActivation?: { isActive?: boolean } }).userActivation;
    // No support: assume not, and wait for a gesture we can see. Waiting is
    // recoverable; a warning on every load is not.
    return ua?.isActive === true;
  }

  function disarm(): void {
    armed?.();
    armed = null;
  }

  /**
   * Wait for the first touch of the page, then start.
   *
   * A tab reloaded with the sound on is not a gesture. Dropping the preference
   * instead would be worse — the switch would read ON over silence — so the
   * preference is kept and the sound waits. The next click, key or scroll
   * anywhere brings it in on the same slow fade it would have had. Nothing
   * announces it: you press start, or press a key, and the river is there.
   */
  function arm(): void {
    disarm();
    const wake = () => {
      disarm();
      if (!build() || !ctx || !master) return;
      void ctx.resume().then(() => { if (master) glide(master.gain, volume, 1.8); });
    };
    const events = ['pointerdown', 'keydown', 'wheel'] as const;
    for (const ev of events) window.addEventListener(ev, wake, { once: true, passive: true });
    armed = () => { for (const ev of events) window.removeEventListener(ev, wake); };
  }

  /** Start if we may, and otherwise wait until we may. */
  function enable(vol = volume): boolean {
    volume = vol;
    if (!canStartNow()) { arm(); return false; }
    disarm();
    if (!build() || !ctx || !master) return false;
    void ctx.resume();
    glide(master.gain, volume, 1.8);
    return true;
  }

  function disable(): void {
    disarm();
    if (!ctx || !master) return;
    glide(master.gain, 0, 0.8);
    // Suspended rather than closed: closing throws away the noise buffer and
    // every node, and turning the sound back on would rebuild the lot and
    // start the river from a different place in its own loop.
    window.setTimeout(() => { if (ctx && master && master.gain.value < 0.01) void ctx.suspend(); }, 900);
  }

  function setVolume(v: number): void {
    volume = Math.min(1, Math.max(0, v));
    if (master) glide(master.gain, volume, 0.4);
  }

  /** Called every tick. Cheap when nothing has changed — every set is a ramp. */
  function update(weather: Weather, progress: number, nowMs: number): void {
    if (!ctx || !beds || ctx.state !== 'running') return;
    const m = mixFor(weather, progress);
    glide(beds.river.gain, m.river, 2.5);
    glide(beds.rain.gain, m.rain, 2.5);
    glide(beds.wind.gain, m.wind, 4);
    // Slowest of all. The weather does not change mid-night, but the deck can
    // move under a resize, and a cutoff that snapped would be a curtain being
    // pulled across the sound.
    glide(beds.tone.frequency, m.cutoff, 5);

    const strike = bellAt(nowMs);
    if (strike !== null && strike !== lastBellHour) {
      lastBellHour = strike;
      bell(strike);
    } else if (strike === null) {
      lastBellHour = -1;
    }
  }

  /**
   * A church bell, across the water.
   *
   * Three partials, not one. A bell is famously not a harmonic series — the
   * hum an octave below the strike note is most of why a bell sounds like a
   * bell and not like a sine wave with a slow release.
   */
  function bell(times: number): void {
    if (!ctx || !master) return;
    const c = ctx;
    const base = 196; // G3, a tenor bell's rough neighbourhood.
    for (let n = 0; n < times; n++) {
      const at = c.currentTime + n * BELL_GAP_S;
      // hum, strike, tierce — the three a listener actually hears.
      for (const [ratio, level, decay] of [[0.5, 0.5, 5.2], [1, 1, 4.4], [1.19, 0.35, 3.1]] as const) {
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.value = base * ratio;
        const g = c.createGain();
        g.gain.setValueAtTime(0, at);
        // 6ms attack. Instant is a click; anything slower is a bowed note.
        g.gain.linearRampToValueAtTime(0.16 * level * volume, at + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
        o.connect(g).connect(master!);
        o.start(at);
        o.stop(at + decay + 0.1);
      }
    }
  }

  /** For the settings panel, and for anyone checking whether it ever started. */
  const state = () => (ctx ? ctx.state : 'idle');

  return { enable, disable, setVolume, update, state, bell };
}
