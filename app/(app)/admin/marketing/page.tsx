import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { UtmBuilder } from "@/components/analytics/UtmBuilder";
import { requireAdmin } from "@/lib/admin/auth";
import { marketingStats } from "@/lib/admin/service";

export const metadata: Metadata = { title: "Маркетинг", robots: { index: false } };

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "—");

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  await requireAdmin();
  const period = (await searchParams).d === "7" ? 7 : 30;
  const rows = await marketingStats(period);
  return (
    <div className="stack" style={{ gap: 20 }}>
      <AdminNav active="/admin/marketing" title="Маркетинг" />
      <section className="card card-pad stack" style={{ gap: 12 }}>
        <div className="funnel-top">
          <b>Источники регистраций за {period} дней</b>
          <nav className="chips-row" aria-label="Период">
            {[7, 30].map((d) => (
              <Link key={d} href={`/admin/marketing?d=${d}`} className={`chip ${d === period ? "is-selected" : ""}`} aria-current={d === period ? "page" : undefined}>
                {d} дней
              </Link>
            ))}
          </nav>
        </div>
        {rows.length === 0 ? (
          <span className="muted">За период нет регистраций.</span>
        ) : (
          <div className="mkt-scroll">
            <table className="mkt-table">
              <thead>
                <tr>
                  <th>Источник</th>
                  <th>Кампания</th>
                  <th>Рег.</th>
                  <th>Актив.</th>
                  <th>Вернулись</th>
                  <th>Pro</th>
                  <th>Конв. в Pro</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.source}|${r.campaign}`}>
                    <td>{r.source}</td>
                    <td>{r.campaign}</td>
                    <td className="num">{r.registrations}</td>
                    <td className="num">{r.activated}</td>
                    <td className="num">{r.returned}</td>
                    <td className="num">{r.pro}{r.trial ? ` (+${r.trial} проб.)` : ""}</td>
                    <td className="num">{pct(r.pro, r.registrations)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card card-pad stack" style={{ gap: 12 }}>
        <b>Конструктор UTM-ссылок</b>
        <span className="muted">Источник первого визита сохраняется на 30 дней и привязывается к аккаунту при регистрации.</span>
        <UtmBuilder />
      </section>
    </div>
  );
}
