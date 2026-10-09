import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { ChallengeModeration } from "@/components/admin/ChallengeModeration";
import { requireAdmin } from "@/lib/admin/auth";
import { dateRu, rub } from "@/lib/client/format";
import { listProofs } from "@/lib/biz/proofs";
import "../../../styles/biz-game.css";

export const metadata: Metadata = { title: "Челленджи · Админка", robots: { index: false } };

const TABS = [
  { k: "pending", l: "На проверке" },
  { k: "approved", l: "Одобренные" },
  { k: "rejected", l: "Отклонённые" },
];

export default async function AdminChallenges({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status: raw } = await searchParams;
  const status = TABS.some((t) => t.k === raw) ? raw! : "pending";
  const rows = await listProofs(status);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <AdminNav active="/admin/challenges" title="Челленджи" />
      <nav className="chips-row" aria-label="Статус">
        {TABS.map((t) => (
          <Link key={t.k} href={`/admin/challenges?status=${t.k}`} className={`chip ${t.k === status ? "is-selected" : ""}`}>
            {t.l}
          </Link>
        ))}
      </nav>
      {rows.length === 0 && <p className="muted">Пусто</p>}
      <div className="admin-list" data-testid="admin-challenges">
        {rows.map((r) => (
          <div key={r.id} className="card card-pad stack" style={{ gap: 8 }} data-testid={`chs-${r.id}`}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <b>{r.title}</b>
              <span className="badge">{r.source === "biz" ? "Бизнес · команда" : "Офлайн"}</span>
              <span className="muted">награда: «{r.item}»</span>
            </div>
            <Link href={`/admin/users/${r.user.id}`} className="muted">
              {r.user.name} · {r.user.email} · {dateRu(r.createdAt)}
            </Link>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{r.text}</p>
            {r.savings && (
              <span className="muted">
                Подтверждённые взносы за неделю: {rub(r.savings.saved)} из {rub(r.savings.target)}
              </span>
            )}
            {r.hasImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="bg-proof-img" src={`/api/challenges/proofs/${r.id}/image`} alt="Фото к челленджу" />
            )}
            {r.comment && <span className="muted">Комментарий: {r.comment}</span>}
            {r.status === "pending" && <ChallengeModeration id={r.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
