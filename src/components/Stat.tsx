import type { ReactNode } from 'react';

/**
 * A label above a value, and nothing else.
 *
 * The reference packs its cards with these — six facts in the space this
 * project was giving to one clock — and it is the difference between a card
 * that reads as an instrument and one that reads as a slide. The label is the
 * micro type the panel titles use, so the whole chrome layer keeps one voice
 * for "what this is" and one for "what it says".
 */
export function Stat({ label, value, tone }: {
  label: string;
  value: ReactNode;
  /** A rare accent (addendum §D). Left off, the value is plain ink. */
  tone?: 'glow' | 'brass' | 'dusk' | 'blood';
}) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value" {...(tone ? { 'data-tone': tone } : {})}>{value}</span>
    </div>
  );
}
