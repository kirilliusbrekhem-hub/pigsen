import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin/auth";
import { listPayments } from "@/lib/admin/service";
import { dateRu, rub } from "@/lib/client/format";

export const metadata: Metadata = { title: "Платежи · Админка", robots: { index: false } };

const STATUS: Record<string, string> = { pending: "Ожидает", succeeded: "Оплачен", canceled: "Отменён" };

export default async function AdminPayments() {
  await requireAdmin();
  const rows = await listPayments();
  return (
    <div className="stack" style={{ gap: 18 }}>
      <AdminNav active="/admin/payments" title="Платежи" />
      <div className="admin-list">
        {rows.map((p) => (
          <Link key={p.id} href={`/admin/users/${p.userId}`} className="card admin-row clickable">
            <span className="admin-row-main">
              <b className="num">{p.provider === "telegram" ? `${p.amount} ★` : rub(p.amount)}</b>
              <span className="muted">{p.user.name} · {p.user.email}</span>
            </span>
            <span className="admin-row-meta">
              <span className={`chip ${p.status === "succeeded" ? "pos" : ""}`}>{STATUS[p.status] ?? p.status}</span>
              <span className="muted">{p.plan.startsWith("coins-") ? `${p.plan.slice(6)} PigCoin$` : p.plan === "year" ? "Год" : "Месяц"}{p.id.startsWith("tgr_") ? " · продление" : ""}</span>
              <span className="muted">{dateRu(p.createdAt)}</span>
            </span>
          </Link>
        ))}
        {!rows.length && <p className="muted">Платежей пока нет.</p>}
      </div>
    </div>
  );
}
