export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "•"
  );
}

export function Avatar({ name, src, className = "" }: { name: string; src?: string | null; className?: string }) {
  return (
    <span className={`avatar ${className}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- user data URL, not an optimizable asset */}
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}
