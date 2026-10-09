export function Pig({ className = "" }: { className?: string }) {
  return <span className={`pig ${className}`} aria-hidden="true" />;
}

export function Wordmark() {
  return (
    <span className="wordmark" aria-label="PìgBiz">
      Pìg<b>Biz</b>
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
          Make your money Smarter.
        </div>
      )}
    </div>
  );
}
