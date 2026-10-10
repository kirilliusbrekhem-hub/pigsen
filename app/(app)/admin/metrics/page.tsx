import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin/auth";
import { MiniChart } from "@/components/growth/MiniChart";
import { Funnel } from "@/components/analytics/Funnel";
import { investorMetrics } from "@/lib/admin/metrics";
import { rub } from "@/lib/client/format";

export const metadata: Metadata = { title: "Метрики", robots: { index: false } };
export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("ru-RU");
const time = (d: Date) => d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

function Ret({ v }: { v: number | null }) {
  if (v === null) return <td className="muted">—</td>;
  return (
    <td>
      <span className="met-heat num" style={{ ["--p" as string]: `${Math.min(100, v)}%` }}>{v}%</span>
    </td>
  );
}

export default async function MetricsPage() {
  await requireAdmin();
  const m = await investorMetrics();
  const kpis = [
    { k: "DAU", v: n(m.dau), d: `${m.stickiness}% от MAU` },
    { k: "WAU", v: n(m.wau), d: "за 7 дней" },
    { k: "MAU", v: n(m.mau), d: `из ${n(m.totalUsers)} пользователей` },
    { k: "Удержание D1", v: `${m.retention.d1.value}%`, d: `база ${n(m.retention.d1.base)}` },
    { k: "Удержание D7", v: `${m.retention.d7.value}%`, d: `дни 7–13 · база ${n(m.retention.d7.base)}` },
    { k: "Удержание D30", v: `${m.retention.d30.value}%`, d: `дни 30–36 · база ${n(m.retention.d30.base)}` },
    { k: "Конверсия в Pro", v: `${m.pro.conversion}%`, d: `${n(m.pro.payers)} платящих` },
    { k: "Pro, ₽ (всего)", v: rub(m.pro.rev.proRub), d: `за 30 дней ${rub(m.pro.rev30.proRub)}` },
    { k: "Pro, ★ (всего)", v: `${n(m.pro.rev.proStars)} ★`, d: `за 30 дней ${n(m.pro.rev30.proStars)} ★` },
    { k: "PigCoin$, ₽ (всего)", v: rub(m.pro.rev.coinsRub), d: `за 30 дней ${rub(m.pro.rev30.coinsRub)}` },
    { k: "PigCoin$, ★ (всего)", v: `${n(m.pro.rev.coinsStars)} ★`, d: `за 30 дней ${n(m.pro.rev30.coinsStars)} ★ · ${n(m.pro.payments)} оплат всего` },
    { k: "Подтверждённые накопления", v: rub(m.savings.confirmedTotal), d: `${n(m.savings.confirmedCount)} взносов со скрином` },
    { k: "Средне на сберегателя", v: rub(m.savings.avgPerSaver), d: `${n(m.savings.savers)} с подтверждением` },
    { k: "Играют командой", v: `${m.team.share}%`, d: `${n(m.team.inTeam)} из ${n(m.team.members)} в бизнесах` },
    { k: "K-фактор", v: String(m.viral.k), d: `${n(m.viral.invites)} приглашённых всего` },
    { k: "K-фактор 30 дней", v: String(m.viral.k30), d: `${n(m.viral.invites30)} за 30 дней` },
  ];
  return (
    <div className="stack" style={{ gap: 20 }}>
      <AdminNav active="/admin/metrics" title="Метрики для инвесторов" />
      <div className="admin-tiles">
        {kpis.map((t) => (
          <div key={t.k} className="card admin-tile">
            <span className="label">{t.k}</span>
            <b className="num">{t.v}</b>
            <span className="muted">{t.d}</span>
          </div>
        ))}
      </div>
      <div className="growth-charts">
        <MiniChart title="Регистрации в день, 30 дней" data={m.signups} />
        <MiniChart title="Активные пользователи в день (DAU)" data={m.dauSeries} kind="line" />
      </div>
      <section className="card card-pad stack" style={{ gap: 12 }}>
        <b>Воронка: регистрация → взнос → бизнес → возврат на 7-й день</b>
        <Funnel steps={m.funnel} />
        <span className="muted">Пользователи, зарегистрированные за последние 90 дней.</span>
      </section>
      <section className="card card-pad stack" style={{ gap: 12 }}>
        <b>Когорты по неделям регистрации</b>
        <div className="met-table-wrap">
          <table className="met-table">
            <thead>
              <tr><th>Неделя с</th><th>Новых</th><th>D1</th><th>D7</th><th>D30</th></tr>
            </thead>
            <tbody>
              {m.cohorts.map((c) => (
                <tr key={c.label}>
                  <td className="num">{c.label}</td>
                  <td className="num">{c.size}</td>
                  <Ret v={c.d1} /><Ret v={c.d7} /><Ret v={c.d30} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <span className="muted">D1 — активны на 1-й день, D7 — в дни 7–13, D30 — в дни 30–36 после регистрации; «—» — когорта ещё не прожила окно.</span>
      </section>
      <section className="card card-pad stack" style={{ gap: 10 }}>
        <b>Последние ошибки сервера</b>
        {m.errors.length === 0 ? (
          <span className="muted">Ошибок не зафиксировано.</span>
        ) : (
          <ul className="met-errors">
            {m.errors.map((e) => (
              <li key={e.id}>
                <div className="met-err-head">
                  <code>{e.method} {e.path || e.routePath}</code>
                  <span className="muted num">{time(e.createdAt)}</span>
                </div>
                <span className="met-err-msg">{e.message}</span>
                {e.digest && <span className="muted">digest {e.digest} · {e.routeType}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
