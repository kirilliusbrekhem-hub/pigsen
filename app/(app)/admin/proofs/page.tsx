import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { ProofModeration } from "@/components/admin/ProofModeration";
import { requireAdmin } from "@/lib/admin/auth";
import { dateRu, rub } from "@/lib/client/format";
import { listProofs, PROOF_TTL_DAYS, type ProofStatus } from "@/lib/savings/proof";

export const metadata: Metadata = { title: "Подтверждение взносов · Админка", robots: { index: false } };

const TABS: { k: ProofStatus; l: string }[] = [
  { k: "pending", l: "На проверке" },
  { k: "confirmed", l: "Подтверждённые" },
  { k: "rejected", l: "Отклонённые" },
];

export default async function AdminProofs({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status: raw } = await searchParams;
  const status = TABS.find((t) => t.k === raw)?.k ?? "pending";
  const rows = await listProofs(status);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <AdminNav active="/admin/proofs" title="Подтверждение взносов" />
      <p className="muted">Сверьте сумму и дату на скриншоте со взносом. Скриншоты удаляются через {PROOF_TTL_DAYS} дней, статус остаётся.</p>
      <nav className="chips-row" aria-label="Статус">
        {TABS.map((t) => (
          <Link key={t.k} href={`/admin/proofs?status=${t.k}`} className={`chip ${t.k === status ? "is-selected" : ""}`}>{t.l}</Link>
        ))}
      </nav>
      {rows.length === 0 && <p className="muted">Пусто</p>}
      <div className="admin-list" data-testid="admin-proofs">
        {rows.map((p) => (
          <div key={p.id} className="card card-pad proof-admin" data-proof={p.id}>
            {p.purgedAt ? (
              <div className="ph">Скриншот удалён</div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- private admin-only image, served with no-store
              <img src={`/api/savings/proofs/${p.id}/image`} alt={`Скриншот взноса ${rub(p.amount)}`} loading="lazy" />
            )}
            <div className="stack" style={{ gap: 6 }}>
              <b className="num">+{rub(p.amount)}</b>
              <span>Цель «{p.entry.goal.title}»{p.entry.note ? ` · ${p.entry.note}` : ""}</span>
              <Link href={`/admin/users/${p.entry.goal.user.id}`} className="muted">{p.entry.goal.user.name} · {p.entry.goal.user.email}</Link>
              <span className="muted">Взнос {dateRu(p.entry.createdAt)} · скрин {dateRu(p.createdAt)}</span>
              {p.note && <span className="muted">{p.note}</span>}
              {p.checkedBy && <span className="muted">Проверил: {p.checkedBy.startsWith("admin:") ? "админ" : "ИИ"}</span>}
              {p.status !== "confirmed" && <ProofModeration id={p.id} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
