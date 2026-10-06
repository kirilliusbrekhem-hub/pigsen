import { GoalArt } from "./GoalArt";

/** Goal cover: the user's own picture (with progress and motivation text) or the theme art as fallback. */
export function GoalCover({ imageUrl, theme, percent, title, why, size = "md" }: { imageUrl: string | null; theme: string; percent: number; title: string; why?: string; size?: "md" | "lg" }) {
  if (!imageUrl) return <GoalArt theme={theme} percent={percent} size={size} title={title} />;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className={`goal-art goal-art-${size} goal-photo`} role="img" aria-label={`${title}: накоплено ${p}%`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="" loading="lazy" />
      <span className="goal-photo-shade" />
      {why && <span className="goal-photo-why">«{why}»</span>}
      <b className="goal-art-pct">{p}%</b>
    </div>
  );
}
