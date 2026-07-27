import { useEffect, useRef, useState } from 'react';

export function splitDigits(text: string): string[] {
  return text.split('');
}

/**
 * A clock TICKS, it does not blink: only the characters that actually changed
 * are animated. DNA §8.6.
 */
export function Digits({ text }: { text: string }) {
  const chars = splitDigits(text);
  const prev = useRef<string[]>(chars);
  const [flipping, setFlipping] = useState<boolean[]>(() => chars.map(() => false));

  useEffect(() => {
    const changed = chars.map((c, i) => c !== prev.current[i]);
    prev.current = chars;
    if (changed.some(Boolean)) {
      setFlipping(changed);
      const id = window.setTimeout(() => setFlipping(chars.map(() => false)), 260);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [text]);

  return (
    <span className="digits">
      {chars.map((c, i) => (
        <span
          key={i}
          className={flipping[i] ? 'digit digit--flip' : 'digit'}
        >
          {c}
        </span>
      ))}
    </span>
  );
}
