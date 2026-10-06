import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin/auth";
import { listUsers } from "@/lib/admin/service";
import { isPro } from "@/lib/billing/plan";
import { dateRu } from "@/lib/client/format";

export const metadata: Metadata = { title: "Пользователи · Админка", robots: { index: false } };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; p?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(0, Math.min(1000, Number(sp.p) || 0));
  const { rows, total } = await listUsers(q, page);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <AdminNav active="/admin/users" title="Пользователи" />
      <form className="admin-search" action="/admin/users">
        <input className="input" name="q" defaultValue={q} placeholder="Поиск по имени или email" aria-label="Поиск пользователей" />
        <button className="btn btn-primary" type="submit">
          Найти
        </button>
      </form>
      <span className="muted">Найдено: {total}</span>
      <div className="admin-list">
        {rows.map((u) => {
          const pro = isPro(u.profile);
          return (
            <Link key={u.id} href={`/admin/users/${u.id}`} className="card admin-row clickable">
              <span className="admin-row-main">
                <b>{u.name}</b>
                <span className="muted">{u.email}</span>
              </span>
              <span className="admin-row-meta">
                {u.blocked && <span className="chip neg">Заблокирован</span>}
                {pro && <span className="chip">Pro</span>}
                <span className="muted num">{u.profile?.xp ?? 0} XP · {u.profile?.coins ?? 0} PigCoin$</span>
                <span className="muted">с {dateRu(u.createdAt)}</span>
              </span>
            </Link>
          );
        })}
        {!rows.length && <p className="muted">Никого не нашлось.</p>}
      </div>
      <div className="row" style={{ gap: 8 }}>
        {page > 0 && (
          <Link className="btn btn-secondary btn-sm" href={`/admin/users?q=${encodeURIComponent(q)}&p=${page - 1}`}>
            Назад
          </Link>
        )}
        {(page + 1) * 30 < total && (
          <Link className="btn btn-secondary btn-sm" href={`/admin/users?q=${encodeURIComponent(q)}&p=${page + 1}`}>
            Дальше
          </Link>
        )}
      </div>
    </div>
  );
}
