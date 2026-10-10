/** The CAP glyph: a lens with a moving focal point (from the prototype). */
export function Orb({ thinking = false, className = "" }: { thinking?: boolean; className?: string }) {
  return (
    <span className={`orb ${thinking ? "thinking" : ""} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".45" />
        <g className="focal">
          <circle cx="12" cy="4.5" r="2.4" fill="var(--ai-accent)" />
        </g>
      </svg>
    </span>
  );
}
