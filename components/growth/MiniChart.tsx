/** Dependency-free SVG chart for admin stats: bars or a line over daily points. */
export function MiniChart({ title, data, kind = "bar" }: { title: string; data: { day: string; value: number }[]; kind?: "bar" | "line" }) {
  const W = 300, H = 100;
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  const step = W / Math.max(1, data.length);
  const y = (v: number) => H - (v / max) * (H - 6);
  const points = data.map((d, i) => `${(i + 0.5) * step},${y(d.value)}`).join(" ");
  return (
    <section className="card card-pad stack growth-chart" style={{ gap: 8 }}>
      <div className="growth-chart-head">
        <b>{title}</b>
        <span className="muted num">всего {total.toLocaleString("ru-RU")} · макс {max.toLocaleString("ru-RU")}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${title}: ${data.map((d) => `${d.day} ${d.value}`).join(", ")}`}>
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="growth-chart-axis" />
        {kind === "bar"
          ? data.map((d, i) => (
              <rect key={d.day} x={i * step + step * 0.15} width={step * 0.7} y={y(d.value)} height={H - y(d.value)} rx="1.5" className="growth-chart-bar">
                <title>{`${d.day}: ${d.value}`}</title>
              </rect>
            ))
          : (
            <>
              <polyline points={points} className="growth-chart-line" vectorEffect="non-scaling-stroke" />
              {data.map((d, i) => (
                <circle key={d.day} cx={(i + 0.5) * step} cy={y(d.value)} r="1.6" className="growth-chart-dot">
                  <title>{`${d.day}: ${d.value}`}</title>
                </circle>
              ))}
            </>
          )}
      </svg>
      <div className="growth-chart-x muted">
        <span>{data[0]?.day.slice(5)}</span>
        <span>{data[data.length - 1]?.day.slice(5)}</span>
      </div>
    </section>
  );
}
