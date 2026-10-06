import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { UserActions } from "@/components/admin/UserActions";
import { Icon } from "@/components/ui/Icon";
import { requireAdmin } from "@/lib/admin/auth";
import { userDetail } from "@/lib/admin/service";
import { isPro } from "@/lib/billing/plan";
import { dateRu, rub } from "@/lib/client/format";

export const metadata: Metadata = { title: "Пользователь · Админка", robots: { index: false } };

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const d = await userDetail(id);
  if (!d) notFound();
  const { user, lessons, payments, txs, goals } = d;
  const pro = isPro(user.profile);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <AdminNav active="/admin/users" title={user.name} />
      <Link href="/admin/users" className="link-btn muted">
        <Icon name="back" size="sm" /> Все пользователи
      </Link>
      <section className="card card-pad stack" style={{ gap: 10 }}>
        <span className="muted">{user.email}</span>
        <div className="admin-tiles">
          <div className="admin-tile"><span className="label">Статус</span><b>{user.blocked ? "Заблокирован" : pro ? `Pro до ${dateRu(user.profile!.proUntil!)}` : "Free"}</b></div>
          <div className="admin-tile"><span className="label">С нами с</span><b>{dateRu(user.createdAt)}</b></div>
          <div className="admin-tile"><span className="label">Был активен</span><b>{user.profile ? dateRu(user.profile.lastActiveAt) : "—"}</b></div>
          <div className="admin-tile"><span className="label">XP / PigCoin$</span><b className="num">{user.profile?.xp ?? 0} / {user.profile?.coins ?? 0}</b></div>
          <div className="admin-tile"><span className="label">Уроков</span><b className="num">{lessons}</b></div>
          <div className="admin-tile"><span className="label">Разговоров $PIG</span><b className="num">{user._count.conversations}</b></div>
          <div className="admin-tile"><span className="label">Сохранено</span><b className="num">{user._count.savedItems}</b></div>
          <div className="admin-tile"><span className="label">Разборов идей</span><b className="num">{user._count.ideaReviews}</b></div>
        </div>
      </section>
      <UserActions id={user.id} blocked={user.blocked} pro={pro} self={user.id === admin.id} />
      <section className="card card-pad stack" style={{ gap: 8 }}>
        <b>Цели в копилке</b>
        {goals.length ? goals.map((g, i) => <div key={i} className="ledger-row"><span className="num">{rub(g.saved)}</span><span className="muted">{g.title}</span><span className="muted num">из {rub(g.target)}</span></div>) : <p className="muted">Нет целей.</p>}
      </section>
      <section className="card card-pad stack" style={{ gap: 8 }}>
        <b>Платежи</b>
        {payments.length ? payments.map((p) => <div key={p.id} className="ledger-row"><span className="num">{p.provider === "telegram" ? `${p.amount} ⭐` : rub(p.amount)}</span><span className="muted">{p.plan === "year" ? "Год" : "Месяц"} · {p.status}</span><span className="muted">{dateRu(p.createdAt)}</span></div>) : <p className="muted">Платежей нет.</p>}
      </section>
      <section className="card card-pad stack" style={{ gap: 8 }}>
        <b>Движение PigCoin$</b>
        {txs.length ? txs.map((t) => <div key={t.id} className="ledger-row"><span className={`num ${t.amount > 0 ? "pos" : "neg"}`}>{t.amount > 0 ? "+" : ""}{t.amount}</span><span className="muted">{t.reason}</span><span className="muted">{dateRu(t.createdAt)}</span></div>) : <p className="muted">Пусто.</p>}
      </section>
    </div>
  );
}
