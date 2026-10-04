interface RingProps {
  percent: number;
  size?: number;
  stroke?: number;
  large?: boolean;
}

export function Ring({ percent, size = 52, stroke = 5, large = false }: RingProps) {
  const p = Math.max(0, Math.min(100, percent));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={`ring ${large ? "lg" : ""}`} role="img" aria-label={`Прогресс ${p}%`}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunken)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={p > 0 ? "var(--accent)" : "transparent"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * p) / 100} ${c}`}
          style={{ transition: "stroke-dasharray .6s var(--ease)" }}
        />
      </svg>
      <span className="pct">{p}%</span>
    </div>
  );
}

export function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="progress" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <i style={{ width: `${p}%` }} />
    </div>
  );
}
