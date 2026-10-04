import Link from "next/link";

export interface ChipOption {
  value: string | null;
  label: string;
  count?: number;
}

/** Link-based filter chips: state lives in the URL, so filters are shareable and server-rendered. */
export function FilterChips({ options, current, hrefFor, label }: { options: ChipOption[]; current: string | null; hrefFor: (v: string | null) => string; label: string }) {
  return (
    <nav className="chips-row" aria-label={label}>
      {options.map((o) => (
        <Link key={o.value ?? "all"} href={hrefFor(o.value)} className={`chip ${current === o.value ? "is-selected" : ""}`} aria-current={current === o.value ? "true" : undefined} scroll={false} prefetch={false}>
          {o.label}
          {o.count !== undefined && <span className="n">{o.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function TypeTabs({ options, current, hrefFor }: { options: ChipOption[]; current: string | null; hrefFor: (v: string | null) => string }) {
  return (
    <nav className="tabs" aria-label="Тип материала">
      {options.map((o) => (
        <Link key={o.value ?? "all"} href={hrefFor(o.value)} className={`tab ${current === o.value ? "is-selected" : ""}`} aria-current={current === o.value ? "true" : undefined} scroll={false} prefetch={false}>
          {o.label}
          {o.count !== undefined && <span className="muted mono" style={{ fontSize: 11, marginLeft: 6 }}>{o.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
