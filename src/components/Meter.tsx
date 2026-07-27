export function Meter({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className="meter"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      {...(label ? { 'aria-label': label } : {})}
    >
      <div className="meter__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
