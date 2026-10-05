import { Icon } from "@/components/ui/Icon";
import { themeOf } from "@/lib/savings/themes";

/** Motivational cover: theme gradient, big icon and a "coin jar" that fills with progress. */
export function GoalArt({ theme, percent, size = "md", title }: { theme: string; percent: number; size?: "md" | "lg"; title?: string }) {
  const t = themeOf(theme);
  const p = Math.max(0, Math.min(100, percent));
  const id = `g-${theme}-${size}`;
  return (
    <div className={`goal-art goal-art-${size}`} style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }} role="img" aria-label={`${title ?? t.label}: накоплено ${p}%`}>
      <span className="goal-art-ic">
        <Icon name={t.icon} />
      </span>
      <svg className="goal-jar" viewBox="0 0 64 80" aria-hidden="true">
        <defs>
          <clipPath id={id}>
            <path d="M14 14h36v6c6 4 8 10 8 18v28c0 6-4 10-10 10H16C10 76 6 72 6 66V38c0-8 2-14 8-18z" />
          </clipPath>
        </defs>
        <path d="M14 14h36v6c6 4 8 10 8 18v28c0 6-4 10-10 10H16C10 76 6 72 6 66V38c0-8 2-14 8-18z" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.9)" strokeWidth="2.5" />
        <g clipPath={`url(#${id})`}>
          <rect className="jar-fill" x="0" y={76 - (62 * p) / 100} width="64" height="80" fill="#ffd54a" />
          {p > 8 && <circle cx="22" cy={Math.min(70, 78 - (62 * p) / 100 + 8)} r="4" fill="#f5b700" />}
          {p > 20 && <circle cx="40" cy={Math.min(70, 78 - (62 * p) / 100 + 12)} r="4" fill="#f5b700" />}
        </g>
        <rect x="12" y="8" width="40" height="7" rx="3" fill="rgba(255,255,255,.95)" />
      </svg>
      <b className="goal-art-pct">{p}%</b>
    </div>
  );
}
