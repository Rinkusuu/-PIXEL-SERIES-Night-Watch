// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { handleKey } from '../../src/app/useKeys';

function ev(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, cancelable: true, ...init });
}

/** An event whose target is a real element, which `new KeyboardEvent` lacks. */
function at(key: string, el: Element): KeyboardEvent {
  const e = ev(key);
  Object.defineProperty(e, 'target', { value: el });
  return e;
}

describe('handleKey', () => {
  it('runs the handler for a bare key and claims it', () => {
    let hits = 0;
    const e = ev(' ');
    expect(handleKey({ ' ': () => { hits++; } }, e)).toBe(true);
    expect(hits).toBe(1);
    // Space scrolls the page if it is not claimed.
    expect(e.defaultPrevented).toBe(true);
  });

  it('ignores keys typed into a field', () => {
    // Without this, every space in a task name toggles the session instead of
    // typing — the quarry input would be unusable with Space bound at window.
    let hits = 0;
    for (const tag of ['input', 'textarea', 'select']) {
      const el = document.createElement(tag);
      expect(handleKey({ ' ': () => { hits++; } }, at(' ', el))).toBe(false);
    }
    expect(hits).toBe(0);
  });

  it('ignores contenteditable too', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'isContentEditable', { value: true });
    expect(handleKey({ ' ': () => {} }, at(' ', el))).toBe(false);
  });

  it('leaves modified keys to the browser unless they are a declared chord', () => {
    // Stealing Cmd-S to skip a session would be indefensible.
    let hits = 0;
    const map = { s: () => { hits++; } };
    for (const mod of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }]) {
      expect(handleKey(map, ev('s', mod))).toBe(false);
    }
    expect(hits).toBe(0);
  });

  it('runs a `mod+` chord, and runs it even while typing', () => {
    // That is what the palette shortcut is FOR: leaving the field you are in.
    let hits = 0;
    const map = { 'mod+k': () => { hits++; } };
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const e = ev('k', mac ? { metaKey: true } : { ctrlKey: true });
    const input = document.createElement('input');
    Object.defineProperty(e, 'target', { value: input });
    expect(handleKey(map, e)).toBe(true);
    expect(hits).toBe(1);
    expect(e.defaultPrevented).toBe(true);
  });

  it('does not fire a chord for a plain key of the same letter', () => {
    let hits = 0;
    expect(handleKey({ 'mod+k': () => { hits++; } }, ev('k'))).toBe(false);
    expect(hits).toBe(0);
  });

  it('ignores a chord that adds shift or alt', () => {
    // ⌘⇧K is a different shortcut, and often the browser's.
    let hits = 0;
    const map = { 'mod+k': () => { hits++; } };
    expect(handleKey(map, ev('k', { metaKey: true, shiftKey: true }))).toBe(false);
    expect(handleKey(map, ev('k', { ctrlKey: true, altKey: true }))).toBe(false);
    expect(hits).toBe(0);
  });

  it('does not preventDefault on a key it does not handle', () => {
    // Claiming Tab would break keyboard navigation for everything else.
    const e = ev('Tab');
    expect(handleKey({ ' ': () => {} }, e)).toBe(false);
    expect(e.defaultPrevented).toBe(false);
  });

  it('matches case-insensitively, so Shift does not lose the key', () => {
    let hits = 0;
    expect(handleKey({ s: () => { hits++; } }, ev('S'))).toBe(true);
    expect(hits).toBe(1);
  });
});
