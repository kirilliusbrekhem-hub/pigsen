// Kapital visual primitives: the K seal, banknote guilloche, rosette and icons. Pure SVG, server-safe.
import Link from "next/link";

export function Seal({ size = 32, variant = "solid", className }: { size?: number; variant?: "solid" | "hero" | "ink"; className?: string }) {
  if (variant === "ink")
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
        <circle cx="32" cy="32" r="30" fill="none" stroke="#06120B" strokeWidth="2" />
        <circle cx="32" cy="32" r="24" fill="none" stroke="#06120B" strokeWidth="1" strokeDasharray="1.5 1.5" />
        <text x="32" y="42" textAnchor="middle" fontFamily="var(--font-playfair), Playfair Display, serif" fontWeight="800" fontSize="28" fill="#06120B">K</text>
      </svg>
    );
  if (variant === "hero")
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
        <circle cx="32" cy="32" r="31" fill="#85BB65" />
        <circle cx="32" cy="32" r="26.5" fill="none" stroke="#06120B" strokeWidth=".8" strokeDasharray="1.2 1.4" />
        <circle cx="32" cy="32" r="23" fill="none" stroke="#06120B" strokeWidth="1.2" />
        <text x="32" y="42" textAnchor="middle" fontFamily="var(--font-playfair), Playfair Display, serif" fontWeight="800" fontSize="30" fill="#06120B">K</text>
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <circle cx="32" cy="32" r="31" fill="#85BB65" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="#06120B" strokeWidth="2" />
      <text x="32" y="43" textAnchor="middle" fontFamily="var(--font-playfair), Playfair Display, serif" fontWeight="800" fontSize="32" fill="#06120B">K</text>
    </svg>
  );
}

export function Brand({ href = "/", pill = false, size = 32, label = "Kapital" }: { href?: string; pill?: boolean; size?: number; label?: string }) {
  return (
    <Link href={href} className={`k-brand ${pill ? "pill" : ""}`} aria-label={`${label}`}>
      <Seal size={size} />
      <b>Kapital</b>
    </Link>
  );
}

/** Banknote guilloche: wave bands plus a rosette. Sized by the caller, positioned absolutely inside .note. */
export function Guilloche({ width = 420, height = 260, waves = 5, style }: { width?: number; height?: number; waves?: number; style?: React.CSSProperties }) {
  const mid = height / 2;
  const q = width / 8;
  const rows = Array.from({ length: waves }, (_, i) => mid + i * 10 - ((waves - 1) * 10) / 2 + 10);
  const cx = width * 0.78;
  const cy = height * 0.35;
  const r = Math.min(height * 0.25, 70);
  return (
    <svg className="guil" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={style}>
      <g fill="none" stroke="#3E7A3A" strokeWidth=".7">
        {rows.map((y) => (
          <path key={y} d={`M0 ${y} Q ${q} ${y - 70} ${q * 2} ${y} T ${q * 4} ${y} T ${q * 6} ${y} T ${q * 8} ${y}`} />
        ))}
        <circle cx={cx} cy={cy} r={r} />
        <circle cx={cx} cy={cy} r={r * 0.82} strokeDasharray="2 2" />
        <circle cx={cx} cy={cy} r={r * 0.64} />
      </g>
    </svg>
  );
}

/** Large slowly turning rosette used behind welcome/landing/auth screens. */
export function Rosette({ size = 620, stroke = "#2E5E36", opacity = 0.5, style }: { size?: number; stroke?: string; opacity?: number; style?: React.CSSProperties }) {
  return (
    <svg className="rosette spin-slow" width={size} height={size} viewBox="0 0 200 200" aria-hidden="true" style={{ position: "absolute", pointerEvents: "none", opacity, ...style }}>
      <g fill="none" stroke={stroke} strokeWidth=".35">
        <circle cx="100" cy="100" r="96" />
        <circle cx="100" cy="100" r="90" strokeDasharray="1 2" />
        <circle cx="100" cy="100" r="80" />
        <circle cx="100" cy="100" r="66" strokeDasharray="3 1.5" />
        <circle cx="100" cy="100" r="52" />
        <path d="M100 4C130 40 170 70 196 100C170 130 130 160 100 196C70 160 30 130 4 100C30 70 70 40 100 4z" />
        <path d="M100 14C126 46 160 74 186 100C160 126 126 154 100 186C74 154 40 126 14 100C40 74 74 46 100 14z" />
        <path d="M32 32C70 50 130 50 168 32C150 70 150 130 168 168C130 150 70 150 32 168C50 130 50 70 32 32z" />
      </g>
    </svg>
  );
}

export function Ico({ name, size = 18, color = "currentColor" }: { name: "back" | "up" | "right" | "check" | "plus" | "photo" | "close"; size?: number; color?: string }) {
  const p = { stroke: color, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {name === "back" && <path d="M15 6l-6 6 6 6" strokeWidth="2.2" {...p} />}
      {name === "up" && <path d="M12 19V5M6 11l6-6 6 6" strokeWidth="2.6" {...p} />}
      {name === "right" && <path d="M5 12h14M13 6l6 6-6 6" strokeWidth="2.6" {...p} />}
      {name === "check" && <path d="M4 12l5 5L20 6" strokeWidth="3.5" {...p} />}
      {name === "plus" && <path d="M12 5v14M5 12h14" strokeWidth="2.6" {...p} />}
      {name === "close" && <path d="M6 6l12 12M18 6L6 18" strokeWidth="2.2" {...p} />}
      {name === "photo" && (
        <>
          <rect x="3" y="5" width="18" height="14" rx="3" strokeWidth="2" {...p} />
          <circle cx="9" cy="10" r="2" fill={color} />
          <path d="M21 16l-5-5-8 8" strokeWidth="2" {...p} />
        </>
      )}
    </svg>
  );
}

export function TabIcon({ name, on }: { name: "biz" | "cap" | "team" | "profile"; on: boolean }) {
  const c = on ? "#85BB65" : "#8FA593";
  const line = { stroke: c, strokeWidth: 1.8, fill: "none" };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      {name === "biz" && (
        <>
          <rect x="4" y="4" width="7" height="7" rx="2" {...(on ? { fill: c } : line)} />
          <rect x="13" y="4" width="7" height="7" rx="2" {...(on ? { fill: c } : line)} />
          <rect x="4" y="13" width="7" height="7" rx="2" {...(on ? { fill: c } : line)} />
          <rect x="13" y="13" width="7" height="7" rx="2" {...line} />
        </>
      )}
      {name === "cap" && <path d="M4 6h16v10H9l-5 4z" {...(on ? { fill: c } : { ...line, strokeLinejoin: "round" as const })} />}
      {name === "team" && (
        <>
          <circle cx="9" cy="9" r="3.2" {...(on ? { fill: c } : line)} />
          <circle cx="17" cy="10" r="2.6" {...(on ? { fill: c } : line)} />
          <path d="M3 19c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5M15 15c2.6 0 4.6 1.3 5.4 3.8" {...line} strokeLinecap="round" />
        </>
      )}
      {name === "profile" && (
        <>
          <circle cx="12" cy="8.5" r="3.5" {...(on ? { fill: c } : line)} />
          <path d="M5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5" {...(on ? { fill: c } : { ...line, strokeLinecap: "round" as const })} />
        </>
      )}
    </svg>
  );
}

/** 100 capital cells: `lit` filled, cells in [from, lit) pop in as new. */
export function Cells({ lit, from = lit, count = 100, cols = 10, ink = false }: { lit: number; from?: number; count?: number; cols?: 10 | 20; ink?: boolean }) {
  return (
    <div className={`cells ${cols === 20 ? "c20" : ""} ${ink ? "ink" : ""}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const on = i < lit;
        const isNew = on && i >= from;
        return <i key={i} className={isNew ? "new" : on ? "on" : ""} style={isNew ? { animationDelay: `${(i - from) * 0.12}s` } : undefined} />;
      })}
    </div>
  );
}
