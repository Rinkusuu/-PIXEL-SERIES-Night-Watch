import { useState } from 'react';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { COPY } from '../app/copy';
import type { Quarry } from '../store/schema';

export function TheQuarry({
  quarry, selectedId, onAdd, onSelect, onToggleDone, onRemove, onRename,
}: {
  quarry: readonly Quarry[];
  selectedId: string | null;
  onAdd: (name: string) => void;
  onSelect: (id: string | null) => void;
  onToggleDone: (id: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [draft, setDraft] = useState('');
  // Which row is being renamed, and the text so far. One at a time: two open
  // editors in a list this small is a way to lose the one you meant to keep.
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  // NOT floating: you cannot hit a moving target. DNA §8.5.
  return (
    <Panel title="The Quarry" index={1}>
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
                      onRename(q.id, editing.text);
                      setEditing(null);
                    }}
                  >
                    <input
                      className="well quarry__input"
                      autoFocus
                      value={editing.text}
                      onChange={(e) => setEditing({ id: q.id, text: e.target.value })}
                      // Escape abandons the edit. Blur COMMITS it, because a
                      // rename lost by clicking elsewhere is the most annoying
                      // way for a list like this to behave.
                      onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
                      onBlur={() => { onRename(q.id, editing.text); setEditing(null); }}
                      aria-label={`ubah nama: ${q.name}`}
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
                    <span className="label quarry__mins">{q.minutes}m</span>
                    <div className="quarry__tools">
                      <button
                        type="button"
                        className="btn btn--bare"
                        onClick={() => setEditing({ id: q.id, text: q.name })}
                        aria-label={`ubah nama: ${q.name}`}
                        title={COPY.quarry.rename}
                      >{COPY.quarry.renameMark}</button>
                      <button
                        type="button"
                        className="btn btn--bare"
                        onClick={() => onRemove(q.id)}
                        aria-label={`hapus: ${q.name}`}
                        title={COPY.quarry.remove}
                      >{COPY.quarry.removeMark}</button>
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
