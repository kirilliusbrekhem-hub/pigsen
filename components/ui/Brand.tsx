/** Kapital seal (green coin with K) used by the legacy screens' header and sidebar. */
export function Pig({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="26" height="26" viewBox="0 0 64 64" aria-hidden="true" style={{ flex: "none" }}>
      <circle cx="32" cy="32" r="31" fill="#85BB65" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="#06120B" strokeWidth="2" />
      <text x="32" y="43" textAnchor="middle" fontFamily="var(--font-playfair), Playfair Display, serif" fontWeight="800" fontSize="32" fill="#06120B">K</text>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark" aria-label="Kapital" style={{ fontFamily: "var(--font-playfair), Playfair Display, serif", fontWeight: 800 }}>
      Kapital
    </span>
  );
}

export function Brand({ sub = false }: { sub?: boolean }) {
  return (
    <div>
      <div className="brand">
        <Pig />
        <Wordmark />
      </div>
      {sub && (
        <div className="brand-sub" style={{ padding: "0 8px" }}>
          Savings that start businesses.
        </div>
      )}
    </div>
  );
}
