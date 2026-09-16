import { useEffect, useMemo, useRef, useState } from 'react';
import { COPY } from '../app/copy';
import { fuzzy } from '../app/fuzzy';
import type { Command } from '../app/commands';

/** Enough to choose from, few enough to read without scanning. */
const LIMIT = 7;

export function Palette({
  open, commands, onClose,
}: {
  open: boolean;
  commands: Command[];
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // A palette that remembers what you typed last time is a palette that runs
  // the wrong command the next time you open it in a hurry.
  useEffect(() => {
    if (!open) return;
    setQ('');
    setActive(0);
    inputRef.current?.focus();
  }, [open]);

  const hits = useMemo(() => commands
    .map((c) => ({ c, score: fuzzy(q, `${c.label} ${c.hint}`) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, LIMIT)
    .map((r) => r.c), [commands, q]);

  if (!open) return null;

  const run = (c: Command | undefined) => {
    if (!c) return;
    // Close FIRST. Some commands move focus or open the settings fold, and a
    // palette still mounted over them steals it straight back.
    onClose();
    c.run();
  };

  return (
    <div
      className="cmd"
      // A click on the backdrop dismisses; a click inside must not. The check
      // is on the target rather than on stopPropagation in the panel, so the
      // panel does not have to know it lives in a backdrop.
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cmd__panel" role="dialog" aria-modal="true" aria-label={COPY.cmd.placeholder}>
        <div className="cmd__bar">
          <span className="cmd__prompt" aria-hidden="true">›</span>
          <input
            ref={inputRef}
            className="cmd__input"
            value={q}
            spellCheck={false}
            autoComplete="off"
            placeholder={COPY.cmd.placeholder}
            aria-label={COPY.cmd.placeholder}
            aria-controls="cmdlist"
            aria-activedescendant={hits[active] ? `cmd-${hits[active]!.id}` : undefined}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              // Arrows and Enter belong to the list while it is open, which is
              // why they are handled here and not in the global key map: the
              // input has focus, and the global map ignores anything typed
              // into a field.
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(hits.length - 1, i + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); run(hits[active]); }
              else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }}
          />
        </div>

        <ul className="cmd__list" id="cmdlist" role="listbox">
          {hits.length === 0 && <li className="cmd__empty label">{COPY.cmd.empty}</li>}
          {hits.map((c, i) => (
            <li
              key={c.id}
              id={`cmd-${c.id}`}
              role="option"
              aria-selected={i === active}
              className={`cmd__item ${i === active ? 'is-active' : ''}`}
              // Pointer, not click: the palette closes on pointerdown at the
              // backdrop, and a row must win that race.
              onPointerDown={(e) => { e.preventDefault(); run(c); }}
              onMouseMove={() => setActive(i)}
            >
              <span className="cmd__label">{c.label}</span>
              <span className="cmd__hint label">{c.hint}</span>
            </li>
          ))}
        </ul>

        <div className="cmd__foot label">{COPY.cmd.foot}</div>
      </div>
    </div>
  );
}
