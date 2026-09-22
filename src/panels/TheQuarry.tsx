import { useState } from 'react';
import { Button } from '../components/Button';
import { Ico } from '../components/Ico';
import { Meter } from '../components/Meter';
import { Panel } from '../components/Panel';
import { COPY } from '../app/copy';
import { ESTIMATE_MAX, type Quarry } from '../store/schema';

/**
 * Where a quarry stands against its own estimate.
 *
 * `over` is not a rounding artefact to be hidden — a task that took seven
 * watches against an estimate of five is the single most useful thing this
 * feature can tell you, and a bar that silently stops at full would throw it
 * away. `Meter` clamps, correctly, so the overrun is drawn as its own mark.
 */
function against(q: Quarry, huntMinutes: number): {
  done: number; target: number; ratio: number; over: boolean;
} | null {
  if (q.estimate === undefined || huntMinutes <= 0) return null;
  // Converted here and never stored: `huntMinutes` is a setting and may change,
  // and an estimate that silently rewrote itself when you shortened your
  // watches would be a plan you never made.
  const target = q.estimate * huntMinutes;
  return {
    done: Math.floor(q.minutes / huntMinutes),
    target: q.estimate,
    ratio: q.minutes / target,
    over: q.minutes > target,
  };
}

export function TheQuarry({
  quarry, selectedId, onAdd, onSelect, onToggleDone, onRemove, onRename,
  huntMinutes, onEstimate,
}: {
  quarry: readonly Quarry[];
  selectedId: string | null;
  /** To turn an estimate in watches into the minutes it is measured against. */
  huntMinutes: number;
  onEstimate: (id: string, watches: number) => void;
  onAdd: (name: string) => void;
  onSelect: (id: string | null) => void;
  onToggleDone: (id: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [draft, setDraft] = useState('');
  // Which row is being renamed, and the text so far. One at a time: two open
  // editors in a list this small is a way to lose the one you meant to keep.
  const [editing, setEditing] = useState<{ id: string; text: string; est: string } | null>(null);
  const peak = Math.max(0, ...quarry.map((q) => q.minutes));
  const plan = (q: Quarry) => against(q, huntMinutes);

  /** One editor, two fields, one commit. */
  const commit = (e: { id: string; text: string; est: string }) => {
    onRename(e.id, e.text);
    // An empty box is an instruction to clear the estimate, not a cancelled
    // edit — which is the opposite of how the name field reads an empty value,
    // and is why the two are committed by different actions.
    onEstimate(e.id, e.est.trim() === '' ? 0 : Number(e.est));
    setEditing(null);
  };

  // NOT floating: you cannot hit a moving target. DNA §8.5.
  return (
    <Panel title="The Quarry" index={1} className="span-2">
      <form
        onSubmit={(e) => { e.preventDefault(); onAdd(draft); setDraft(''); }}
        style={{ display: 'flex', gap: 'var(--px2)' }}
      >
        <input
          className="well"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="nama buruan"
          style={{
            flex: 1, border: 0, color: 'var(--amb-ink)', padding: 'var(--px2)',
            fontFamily: 'var(--font-body)', fontSize: 'var(--fs-small)',
          }}
        />
        <Button onClick={() => { onAdd(draft); setDraft(''); }}>{COPY.labels.add}</Button>
      </form>

      <hr className="divider" />

      {quarry.length === 0
        ? <p className="label">{COPY.quarryEmpty}</p>
        : (
          <ul className="list--scroll" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {quarry.map((q) => (
              <li key={q.id} className="quarry__row">
                {editing?.id === q.id ? (
                  <form
                    className="quarry__edit"
                    onSubmit={(e) => {
                      e.preventDefault();
                      commit(editing);
                    }}
                  >
                    <input
                      className="well quarry__input"
                      autoFocus
                      value={editing.text}
                      onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                      // Escape abandons the edit. Blur COMMITS it, because a
                      // rename lost by clicking elsewhere is the most annoying
                      // way for a list like this to behave.
                      onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
                      // Blur COMMITS, as before — but only when focus has left
                      // the editor entirely. Tabbing from the name to the
                      // estimate is still one edit, and closing the row
                      // underneath the cursor would have made the second field
                      // unreachable by keyboard.
                      onBlur={(e) => {
                        if (e.currentTarget.form?.contains(e.relatedTarget as Node)) return;
                        commit(editing);
                      }}
                      aria-label={`ubah nama: ${q.name}`}
                    />
                    {/* The estimate lives in the SAME editor as the name.
                        A separate control on every row would be a fifth thing
                        competing for a row that already holds a name, a bar, a
                        number, two tools and a checkbox — and the estimate is
                        something you set once, not something you press. */}
                    <input
                      className="well quarry__est"
                      type="number"
                      min={0}
                      max={ESTIMATE_MAX}
                      value={editing.est}
                      onChange={(e) => setEditing({ ...editing, est: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
                      onBlur={(e) => {
                        if (e.currentTarget.form?.contains(e.relatedTarget as Node)) return;
                        commit(editing);
                      }}
                      aria-label={`perkiraan jaga: ${q.name}`}
                      title={COPY.quarry.estimate}
                    />
                  </form>
                ) : (
                  <>
                    <Button
                      onClick={() => onSelect(selectedId === q.id ? null : q.id)}
                      pressed={selectedId === q.id}
                    >
                      <span style={{ textDecoration: q.done ? 'line-through' : 'none' }}>{q.name}</span>
                    </Button>
                    {/* The bar is what stops a wide card from being a name at
                        one edge and a number at the other with a metre of air
                        between them — and it ranks the list at a glance. */}
                    {/* Two meanings, and the text beside the bar says which
                        one you are looking at: with an estimate the bar is
                        PROGRESS and the text counts watches; without one it is
                        RANK against the longest task and the text is minutes.
                        A bar that meant one thing on some rows and another on
                        the rest with nothing to tell them apart would be worse
                        than either. */}
                    <div className={`quarry__bar${plan(q)?.over ? ' quarry__bar--over' : ''}`}>
                      <Meter
                        value={plan(q) ? plan(q)!.ratio : (peak === 0 ? 0 : q.minutes / peak)}
                        label={plan(q)
                          ? COPY.quarry.against(q.name, plan(q)!.done, plan(q)!.target)
                          : `${q.name}: ${q.minutes} menit`}
                      />
                    </div>
                    <span className="label quarry__mins">
                      {plan(q) ? `${plan(q)!.done}/${plan(q)!.target}×` : `${q.minutes}m`}
                    </span>
                    <div className="quarry__tools">
                      <button
                        type="button"
                        className="btn btn--bare"
                        onClick={() => setEditing({
                          id: q.id, text: q.name, est: q.estimate?.toString() ?? '',
                        })}
                        aria-label={`ubah nama: ${q.name}`}
                        title={COPY.quarry.rename}
                      ><Ico name="pen" /></button>
                      <button
                        type="button"
                        className="btn btn--bare"
                        onClick={() => onRemove(q.id)}
                        aria-label={`hapus: ${q.name}`}
                        title={COPY.quarry.remove}
                      ><Ico name="cross" /></button>
                    </div>
                    <input
                      type="checkbox"
                      checked={q.done}
                      onChange={() => onToggleDone(q.id)}
                      aria-label={`selesai: ${q.name}`}
                    />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
    </Panel>
  );
}
