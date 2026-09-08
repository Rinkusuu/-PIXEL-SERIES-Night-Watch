import { COPY } from '../app/copy';

/**
 * The top of the frame carried nothing at all — five hundred pixels of world
 * with no chrome on it, while the reference puts its identity, its mood line
 * and its controls up there.
 *
 * It does NOT move the panel row. `.app` is `justify-content: space-between`
 * rather than `flex-end`, so this is pushed to the top and the grid stays on
 * the bottom edge where `App.tsx` measures it — the balustrade does not care
 * that anything was added above it.
 */
export function Header({ streak, line }: { streak: number; line: string }) {
  return (
    <header className="topbar">
      <div className="topbar__id">
        <span className="topbar__title">{COPY.title}</span>
        <span className="label">{line}</span>
      </div>
      {streak > 0 && (
        <div className="topbar__chip">
          <span className="panel__spark" />
          <span className="label">{COPY.ledger.streak(streak)}</span>
        </div>
      )}
    </header>
  );
}
