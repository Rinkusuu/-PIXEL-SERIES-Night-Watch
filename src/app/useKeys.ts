import { useEffect } from 'react';

/**
 * Keyboard shortcuts. There were none — not one `keydown` in the whole app,
 * for a tool whose primary action is a single button pressed many times a day.
 *
 * The guard below is most of the value here. A bare `keydown` on the window
 * that treats Space as start/stop makes the quarry input unusable: every space
 * in a task name would toggle the session instead of typing. So anything typed
 * into a field, or into a `contenteditable`, belongs to that field.
 */
function isTyping(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

/**
 * The whole decision, as a pure function — so the rules above can be tested
 * without mounting anything. Returns whether the key was claimed.
 */
export function handleKey(map: Record<string, () => void>, e: KeyboardEvent): boolean {
  const key = e.key.toLowerCase();

  /**
   * A chord, written `mod+k`. `mod` is ⌘ on a Mac and Ctrl everywhere else —
   * the palette has to answer to whichever one the reader's hands expect, and
   * binding both would steal Ctrl-K from Macs, where it is a real shell key.
   *
   * Chords run even while typing. That is the point of ⌘K: it is how you leave
   * the field you are in.
   */
  if (e.metaKey || e.ctrlKey) {
    if (e.altKey || e.shiftKey) return false;
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    if (mac ? !e.metaKey : !e.ctrlKey) return false;
    const chord = map[`mod+${key}`];
    if (!chord) return false;
    e.preventDefault();
    chord();
    return true;
  }

  // Any other modifier means the key belongs to the browser or the OS: ⌥S is
  // not ours to take either.
  if (e.altKey) return false;
  if (isTyping(e.target)) return false;
  const fn = map[key];
  if (!fn) return false;
  // Only now: preventDefault before knowing we handle the key would break Tab,
  // and Space scrolls the page if it is not claimed.
  e.preventDefault();
  fn();
  return true;
}

export function useKeys(map: Record<string, () => void>): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => void handleKey(map, e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [map]);
}
