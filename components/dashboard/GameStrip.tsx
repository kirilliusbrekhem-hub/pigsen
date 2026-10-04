import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Ring";
import type { DailyFact } from "@/lib/facts";
import type { GameStats } from "@/lib/gamification/service";

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export function GameStrip({ game, fact }: { game: GameStats; fact: DailyFact }) {
  const { level, streak, xp } = game;
  const earned = game.badges.filter((b) => b.earned).length;
  return (
    <section className="game-strip">
      <Link href="/profile?tab=progress" className="card clickable game-card">
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div>
            <span className="label">Уровень {level.index}</span>
            <b className="game-level">{level.name}</b>
          </div>
          <div className={`streak ${streak ? "on" : ""}`} title="Дней подряд с активностью">
            <span className="flame" aria-hidden>
              🔥
            </span>
            <span className="num">{streak}</span>
            <span className="muted">{plural(streak, "день", "дня", "дней")}</span>
          </div>
        </div>
        <ProgressBar percent={level.percent} label="Прогресс до следующего уровня" />
        <div className="row muted" style={{ justifyContent: "space-between", fontSize: 12.5, gap: 8 }}>
          <span className="num">{xp} XP</span>
          <span>{level.nextMin !== null ? `${level.nextMin - xp} XP до «${level.nextName}»` : "Максимальный уровень"}</span>
        </div>
        <div className="row muted" style={{ fontSize: 12.5, gap: 6 }}>
          <Icon name="target" size="sm" /> Бейджи: {earned} из {game.badges.length}
        </div>
      </Link>
      <div className="card fact-card">
        <span className="label">
          <Icon name="bulb" size="sm" /> Факт дня
        </span>
        <b>{fact.title}</b>
        <p>{fact.text}</p>
        <Link className="link-btn" href={`/ai?q=${encodeURIComponent(fact.ask)}`}>
          {fact.ask} <Icon name="arrow" size="sm" />
        </Link>
      </div>
    </section>
  );
}
