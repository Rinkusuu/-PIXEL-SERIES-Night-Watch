import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '../components/Button';
import { Meter } from '../components/Meter';
import { Panel } from '../components/Panel';
import { COPY } from '../app/copy';
import { noteText } from '../session/notes';

/**
 * Five bands of ink, zero included.
 *
 * A continuous opacity ramp would be the obvious thing and it is the wrong one:
 * the world layer is flat stepped values everywhere — the value ladder, the
 * dithered river, the stepped roofs — and a smooth gradient in the chrome would
 * be the only continuous tone on screen. Five is also as many steps as anyone
 * can actually rank by eye at this cell size.
 */
const BANDS = 4;

function band(minutes: number, peak: number): number {
  if (minutes <= 0) return 0;
  // `ceil` so ANY kept night lights at least the first band. A night with ten
  // minutes on it rounding down to the same empty cell as a night with none is
  // the one thing a grid like this must never do.
  return Math.min(BANDS, Math.ceil((minutes / peak) * BANDS));
}

/**
 * One night's entry.
 *
 * Saved on BLUR and on unmount rather than on every keystroke: a save writes
 * the whole schema to localStorage and serialises ninety days of sessions to
 * do it, and doing that per character is how a text box starts dropping
 * letters. The unmount save is the one that matters — closing the book, or
 * clicking another night, would otherwise throw away everything typed since
 * the last blur.
 */
function NightBook({
  night, text, onWrite, onClose,
}: {
  night: string;
  text: string;
  onWrite: (night: string, text: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(text);
  // Read through a ref so the unmount effect can run with an empty dependency
  // list and still see the last thing typed.
  const latest = useRef({ night, draft });
  latest.current = { night, draft };

  // A different night is a different entry, not an edit of this one.
  useEffect(() => { setDraft(text); }, [night, text]);

  useEffect(() => () => {
    const l = latest.current;
    onWrite(l.night, l.draft);
  }, []);

  return (
    <div className="book">
      <div className="book__head">
        <span className="label">{COPY.ledger.bookFor(night)}</span>
        <Button onClick={onClose}>{COPY.ledger.bookClose}</Button>
      </div>
      <textarea
        className="well book__text"
        autoFocus
        value={draft}
        placeholder={COPY.ledger.bookPlaceholder}
        aria-label={COPY.ledger.bookOpen(night)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onWrite(night, draft)}
        // Escape closes; it does not discard. The unmount save has already run
        // by the time anything else sees this, so there is no way to lose work
        // by pressing the key that usually means "get me out of here".
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      />
      <p className="label book__hint">{COPY.ledger.bookHint}</p>
    </div>
  );
}

export function TheLedger({
  rows, grid, quarryTotals, streak, best, totals, days, notes, view, onToggleView,
  hours, peakHour, log, onWriteLog,
}: {
  rows: readonly { key: string; minutes: number }[];
  grid: readonly { key: string; minutes: number }[];
  quarryTotals: readonly { name: string; minutes: number }[];
  streak: number;
  best: number;
  totals: { minutes: number; nights: number };
  days: number;
  notes: readonly string[];
  /** 24 entries, already in the night's own order. The view does not reorder. */
  hours: readonly { hour: number; minutes: number }[];
  peakHour: { hour: number; minutes: number } | null;
  /** The night book, keyed by night. Absent keys are nights nobody wrote about. */
  log: Readonly<Record<string, string>>;
  onWriteLog: (night: string, text: string) => void;
  /** Lifted, so the palette can switch it too — one source, not two. */
  view: 'week' | 'window';
  onToggleView: () => void;
}) {
  /** Which night's book is open, or none. Lives here: it is a reading of the
      grid, and nothing outside this panel has an opinion about it. */
  const [open, setOpen] = useState<string | null>(null);
  const empty = totals.minutes === 0;
  const peak = Math.max(60, ...rows.map((r) => r.minutes));
  const gridPeak = Math.max(60, ...grid.map((r) => r.minutes));
  // Its own peak: an hour's total is a fraction of a night's, so sharing the
  // grid's scale would flatten this chart to nothing.
  const hourPeak = Math.max(30, ...hours.map((h) => h.minutes));

  return (
    <Panel
      title="The Ledger"
      index={2}
      float
      className="span-4"
      tools={!empty && (
        <Button onClick={onToggleView}>
          {view === 'week' ? COPY.ledger.toWindow : COPY.ledger.toWeek}
        </Button>
      )}
    >
      {empty ? <p className="label">{COPY.ledgerEmpty}</p> : view === 'week' ? (
        <>
          {rows.map((r) => (
            <div key={r.key} className="ledger__row">
              <span className="label ledger__day">{r.key.slice(5)}</span>
              <div style={{ flex: 1 }}>
                <Meter value={r.minutes / peak} label={`${r.key}: ${r.minutes} menit`} />
              </div>
            </div>
          ))}
          <hr className="divider" />
          <p className="label">
            {COPY.ledger.streak(streak)} · {COPY.ledger.week(rows.reduce((s, r) => s + r.minutes, 0))}
          </p>
        </>
      ) : (
        <>
          <div className="ledger__wide">
            <div>
              <div className="heat" role="img" aria-label={COPY.ledger.heatLabel(days, totals.nights)}>
                {grid.map((n) => (
                  /* A button, not an `<i>`. The cell was decoration; it is a
                     control now, and a control the keyboard cannot reach is a
                     control half the readers do not have. `data-written` marks
                     the nights that have something in the book — otherwise the
                     only way to find one is to click ninety cells. */
                  <button
                    key={n.key}
                    type="button"
                    className="heat__cell"
                    data-band={band(n.minutes, gridPeak)}
                    data-written={log[n.key] ? '' : undefined}
                    aria-pressed={open === n.key}
                    title={`${n.key} · ${n.minutes}m${log[n.key] ? ' · ✎' : ''}`}
                    aria-label={COPY.ledger.bookOpen(n.key)}
                    onClick={() => setOpen(open === n.key ? null : n.key)}
                  />
                ))}
              </div>
              <p className="label">
                {COPY.ledger.best(best)} · {COPY.ledger.window(totals.minutes, totals.nights, days)}
              </p>
            </div>

            {/* Its own column, not stacked under the heat grid.
                The panel's grid row is a HARD height — `App.tsx` measures its
                top edge to place the balustrade, so the row cannot grow — which
                means anything added below scrolls out of sight, and the answer
                this chart exists to give was the first thing to go. The panel
                is full width and had two columns in it; the room was already
                there sideways.

                The heat grid says which nights were kept; this says when in
                them the work happened — the one question ninety days of start
                times could answer and nothing was asking. Same four bands as
                the grid, because a second scale of ink in one panel is a second
                thing to learn. */}
            <div>
              <p className="label">{COPY.ledger.hours}</p>
              <div className="hours" role="img" aria-label={COPY.ledger.hoursLabel}>
                {hours.map((h) => (
                  <i
                    key={h.hour}
                    className="hours__bar"
                    data-band={band(h.minutes, hourPeak)}
                    // The bar's HEIGHT carries the number and the band carries
                    // the rank. Height alone at this size cannot separate ten
                    // minutes from twenty; band alone throws away everything
                    // between the four steps.
                    style={{ '--h': `${Math.round((h.minutes / hourPeak) * 100)}%` } as CSSProperties}
                    title={`${COPY.ledger.hourName(h.hour)} · ${h.minutes}m`}
                  />
                ))}
              </div>
              <div className="hours__axis">
                {hours.map((h) => (
                  // Every fourth hour is named. Twenty-four labels in this width
                  // is a grey smear; six is a clock you can read.
                  <span key={h.hour} className="label">
                    {h.hour % 4 === 0 ? COPY.ledger.hourName(h.hour).slice(0, 2) : ''}
                  </span>
                ))}
              </div>
              <p className="label">
                {peakHour
                  ? COPY.ledger.bestHour(peakHour.hour, peakHour.minutes)
                  : COPY.ledger.noHours}
              </p>
            </div>

            <div>
              {open !== null ? (
                /* The book takes this column's place rather than being added
                   below it. The panel's grid row is a HARD height — `App.tsx`
                   measures its top edge to place the balustrade — so there is
                   no room downward, and a night is only open because you asked
                   for it, so nothing disappears unasked. */
                <NightBook
                  night={open}
                  text={log[open] ?? ''}
                  onWrite={onWriteLog}
                  onClose={() => setOpen(null)}
                />
              ) : (
              <>
              {/* What the watch saw, newest last. No badge, no toast, no
                  count against a total — a total would turn a logbook into a
                  checklist, and then the point of the thing is collecting it. */}
              {notes.length > 0 && (
                <ul className="notes">
                  {notes.slice(-4).map((id) => (
                    <li key={id} className="label notes__line">{noteText(id)}</li>
                  ))}
                </ul>
              )}
              {quarryTotals.slice(0, 5).map((q) => (
                <div key={q.name} className="ledger__row">
                  <span className="label ledger__quarry">{q.name}</span>
                  <div className="ledger__bar"><Meter value={q.minutes / (quarryTotals[0]?.minutes || 1)} label={`${q.name}: ${q.minutes} menit`} /></div>
                  <span className="label ledger__mins">{q.minutes}m</span>
                </div>
              ))}
              {quarryTotals.length === 0 && <p className="label">{COPY.ledger.noQuarry}</p>}
              </>
              )}
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}
