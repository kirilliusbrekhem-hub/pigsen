import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { leaderboard } from "@/lib/biz/service";
import { btnClass } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Лидерборд бизнесов", robots: { index: false } };

export default async function BizTopPage() {
  const user = await requireUser();
  const rows = await leaderboard(50);
  return (
    <div className="biz stack">
      <section className="biz-head">
        <div>
          <span className="label">Мой бизнес</span>
          <h1>Лидерборд бизнесов</h1>
          <p className="muted">Уровень, рейтинг и рост капитала за неделю — то есть сколько команда реально отложила в копилки.</p>
        </div>
        <Link href="/biz" className={btnClass("secondary", "md")}>
          Мой бизнес
        </Link>
      </section>
      <section className="card card-pad">
        {rows.length ? (
          <ol className="biz-top" data-testid="biz-top">
            {rows.map((r, i) => (
              <li key={r.id} className={r.memberIds.includes(user.id) ? "is-me" : ""}>
                <span className="pos num">{i + 1}</span>
                <span className="who">
                  <b>{r.name}</b>
                  <span className="muted biz-small">
                    {r.kindTitle} · основатель {r.founder} · {r.members > 1 ? `команда ${r.members} чел.` : "соло"}
                  </span>
                </span>
                <span className="stat">
                  <b>{r.levelName}</b>
                  <span className="num">{r.rating.toFixed(1)} ★</span>
                  <span className="num muted">
                    {r.growth >= 0 ? "+" : ""}
                    {r.growth.toLocaleString("ru-RU")} ₽ за неделю
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">Пока ни одного бизнеса — откройте первый!</p>
        )}
      </section>
    </div>
  );
}
