/** Progress ring whose arc draws in on mount (CSS only, see .fx-ring in app/styles/fx.css). */
export function ProgressRing({ percent, size = 76, stroke = 7, children, label }: { percent: number; size?: number; stroke?: number; children?: React.ReactNode; label: string }) {
  const p = Math.max(0, Math.min(100, percent));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="fx-ring" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${p}%`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunken)" strokeWidth={stroke} />
        <circle
          className="arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          style={{ strokeDashoffset: c * (1 - p / 100), ["--c" as string]: c } as React.CSSProperties}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="in">{children}</span>
    </div>
  );
}
