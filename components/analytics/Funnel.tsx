const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

export function Funnel({ steps }: { steps: { key: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="funnel" role="list">
      {steps.map((s, i) => (
        <div key={s.key} className="funnel-row" role="listitem">
          <div className="funnel-head">
            <span>{s.label}</span>
            <b className="num">{s.value}</b>
          </div>
          <div className="funnel-track">
            <span className="funnel-fill" style={{ width: `${Math.max(s.value ? 2 : 0, (s.value / max) * 100)}%` }} />
          </div>
          {i > 0 && <span className="muted funnel-conv">{pct(s.value, steps[i - 1].value)}% от предыдущего шага</span>}
        </div>
      ))}
    </div>
  );
}
