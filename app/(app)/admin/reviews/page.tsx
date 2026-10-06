import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { ReviewModeration } from "@/components/growth/ReviewModeration";
import { requireAdmin } from "@/lib/admin/auth";
import { dateRu } from "@/lib/client/format";
import { listReviews } from "@/lib/growth/reviews";

export const metadata: Metadata = { title: "Отзывы · Админка", robots: { index: false } };

const TABS = [
  { k: "pending", l: "На проверке" },
  { k: "approved", l: "Одобренные" },
  { k: "rejected", l: "Отклонённые" },
];

export default async function AdminReviews({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status: raw } = await searchParams;
  const status = TABS.some((t) => t.k === raw) ? raw! : "pending";
  const rows = await listReviews(status);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <AdminNav active="/admin/reviews" title="Отзывы" />
      <nav className="chips-row" aria-label="Статус">
        {TABS.map((t) => (
          <Link key={t.k} href={`/admin/reviews?status=${t.k}`} className={`chip ${t.k === status ? "is-selected" : ""}`}>{t.l}</Link>
        ))}
      </nav>
      {rows.length === 0 && <p className="muted">Пусто</p>}
      <div className="admin-list">
        {rows.map((r) => (
          <div key={r.id} className="card card-pad stack growth-review" style={{ gap: 8 }}>
            <div className="growth-review-head">
              <b>{"★".repeat(r.rating)}<span className="muted">{"★".repeat(5 - r.rating)}</span></b>
              <Link href={`/admin/users/${r.user.id}`} className="muted">{r.user.name} · {r.user.email}</Link>
              <span className="muted">{dateRu(r.updatedAt)}</span>
            </div>
            <p className="growth-review-text">{r.text}</p>
            {r.status === "pending" && <ReviewModeration id={r.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
