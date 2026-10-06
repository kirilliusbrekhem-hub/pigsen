import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin/auth";
import { MiniChart } from "@/components/growth/MiniChart";
import { adminStats, growthStats } from "@/lib/admin/service";
import { rub } from "@/lib/client/format";

export const metadata: Metadata = { title: "Админка", robots: { index: false } };

export default async function AdminPage() {
  await requireAdmin();
  const [s, g] = await Promise.all([adminStats(), growthStats()]);
  const peak = Math.max(1, ...s.signups.map((d) => d.count));
  const tiles = [
    { k: "Пользователей", v: s.users, d: `+${s.users7} за 7 дней` },
    { k: "Активны за 7 дней", v: s.active7, d: `${s.users ? Math.round((s.active7 / s.users) * 100) : 0}% от всех` },
    { k: "Pro сейчас", v: s.pro, d: `${s.payments} успешных оплат` },
    { k: "Выручка", v: `${s.stars} ⭐`, d: s.rub ? `и ${rub(s.rub)}` : "Telegram Stars" },
    { k: "Вопросов $PIG за 7 дней", v: s.messages7, d: `${s.convos} разговоров всего` },
    { k: "Цели в копилке", v: s.goals, d: `накоплено ${rub(s.goalsSaved)}` },
    { k: "Пройдено уроков", v: s.lessonsDone, d: `${s.saved} сохранений` },
    { k: "PigCoin$ на руках", v: s.coins, d: `${s.blocked} заблокировано` },
    { k: "Удержание D1", v: `${g.retention.d1}%`, d: `когорта ${g.retention.cohort} (8–30 дней назад)` },
    { k: "Удержание D7", v: `${g.retention.d7}%`, d: "вернулись в течение недели" },
    { k: "Рефералы", v: g.referrals.total, d: `${g.referrals.activated} прошли урок` },
    { k: "Отзывы", v: g.reviews.pending, d: `на проверке · ${g.reviews.approved} одобр. · ${g.reviews.rejected} откл.` },
  ];
  return (
    <div className="stack" style={{ gap: 20 }}>
      <AdminNav active="/admin" title="Статистика" />
      <div className="admin-tiles">
        {tiles.map((t) => (
          <div key={t.k} className="card admin-tile">
            <span className="label">{t.k}</span>
            <b className="num">{t.v}</b>
            <span className="muted">{t.d}</span>
          </div>
        ))}
      </div>
      <section className="card card-pad stack" style={{ gap: 12 }}>
        <b>Регистрации за 14 дней</b>
        <div className="admin-bars" role="img" aria-label="Регистрации по дням">
          {s.signups.map((d) => (
            <div key={d.day} className="admin-bar" title={`${d.day}: ${d.count}`}>
              <span className="n num">{d.count || ""}</span>
              <span className="b" style={{ height: `${(d.count / peak) * 100}%` }} />
              <i>{d.day.slice(8)}</i>
            </div>
          ))}
        </div>
      </section>
      <div className="growth-charts">
        <MiniChart title="Новые пользователи, 30 дней" data={g.signups} />
        <MiniChart title="Активные пользователи в день" data={g.active} kind="line" />
        <MiniChart title="Покупки Pro в день" data={g.purchases} />
        <MiniChart title="PigCoin$ заработано в день" data={g.coinsEarned} kind="line" />
      </div>
    </div>
  );
}
