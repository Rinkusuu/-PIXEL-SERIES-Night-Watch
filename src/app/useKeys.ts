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

export function useKeys(map: Record<string, () => void>): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A modifier means the key belongs to the browser or the OS: ⌘S saves the
      // page, and stealing it to skip a session would be indefensible.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      const fn = map[e.key.toLowerCase()];
      if (!fn) return;
      // Only now: preventDefault before knowing we handle the key would break
      // Tab, and Space scrolls the page if it is not claimed.
      e.preventDefault();
      fn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [map]);
}
