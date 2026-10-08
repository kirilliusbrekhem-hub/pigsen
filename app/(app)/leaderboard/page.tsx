import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { isPro } from "@/lib/billing/plan";
import { Avatar } from "@/components/ui/Avatar";
import { Coin } from "@/components/ui/Coin";
import { Icon } from "@/components/ui/Icon";
import { ProPromo } from "@/components/pro/ProPromo";
import { currentBoard, PRIZES, prizeFor, type Row } from "@/lib/social/leaderboard";

export const metadata: Metadata = { title: "Лидерборд" };

const fmtDay = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });

function RowView({ r, me }: { r: Row; me: boolean }) {
  const prize = prizeFor(r.place);
  return (
    <li className={`lb-row${me ? " is-me" : ""}${r.place <= 3 ? ` lb-top lb-p${r.place}` : ""}`}>
      <span className="lb-place">{r.place}</span>
      <Avatar name={r.name} src={r.avatarUrl} className={`lb-av${r.avatarRing ? ` ring-${r.avatarRing}` : ""}`} />
      <span className="lb-name">
        <b className={r.nameColor ? `name-${r.nameColor}` : undefined}>{r.name}{me ? " (вы)" : ""}</b>
        {r.title && <span className="muted">{r.title}</span>}
      </span>
      {prize && (
        <span className="lb-prize" title="Приз за место">
          {prize.proDays ? `${prize.proDays} дн. Pro + ` : "+"}
          {prize.coins} <Coin size={12} />
        </span>
      )}
      <span className="lb-pts">{r.points} XP</span>
    </li>
  );
}

export default async function LeaderboardPage() {
  const user = await requireUser();
  const pro = isPro(user.profile);
  const { week, top, me } = await currentBoard(user.id);
  const last = new Date(week.end.getTime() - 86_400_000);
  return (
    <>
      <section className="page-head">
        <div>
          <span className="label">Неделя {week.key.split("-W")[1]} · {fmtDay(week.start)} – {fmtDay(last)}</span>
          <h1>Лидерборд недели</h1>
          <p>Очки = XP за неделю: 20 за каждый новый пройденный урок и XP за квизы. Рейтинг обнуляется в понедельник (UTC), призы получают участники с Pro. <a href="/rules">Правила лидерборда</a>.</p>
        </div>
      </section>

      <section className="lb-prizes">
        {PRIZES.slice(0, 3).map((p) => (
          <div key={p.place} className={`card card-pad lb-prize-card lb-p${p.place}`}>
            <span className="lb-medal">{p.place}</span>
            <b>{p.proDays} дней Pro</b>
            <span>+{p.coins} <Coin size={14} /></span>
            {p.title && <span className="muted">титул «{p.title}»</span>}
          </div>
        ))}
        <div className="card card-pad lb-prize-card">
          <span className="lb-medal">4–10</span>
          <b>+200 <Coin size={14} /></b>
          <span className="muted">каждому</span>
        </div>
      </section>

      {!pro && (
        <div className="stack">
          <ProPromo place="leaderboard" />
          <Link href="/pro" className="btn btn-accent lb-cta">
            <Icon name="sparkle" size="sm" /> Участвовать с Pro
          </Link>
        </div>
      )}

      <section className="card card-pad">
        {top.length === 0 ? (
          <p className="muted">На этой неделе пока никто не набрал очков. Пройдите урок и станьте первым!</p>
        ) : (
          <ol className="lb-list">
            {top.map((r) => (
              <RowView key={r.userId} r={r} me={r.userId === user.id} />
            ))}
          </ol>
        )}
        {pro && (
          <div className="lb-me">
            {me ? (
              me.place > 20 && (
                <ol className="lb-list">
                  <RowView r={me} me />
                </ol>
              )
            ) : (
              <p className="muted">Вас пока нет в рейтинге: пройдите урок или квиз, чтобы получить очки.</p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
