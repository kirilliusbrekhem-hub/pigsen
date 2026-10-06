import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { Icon } from "@/components/ui/Icon";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Материалы · Админка", robots: { index: false } };

const TYPE: Record<string, string> = { article: "Статья", book: "Книга", video: "Видео", podcast: "Подкаст" };

export default async function AdminContent({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const rows = await prisma.contentItem.findMany({
    where: { type: { not: "course" }, ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}) },
    orderBy: { publishedAt: "desc" },
    take: 200,
    select: { id: true, title: true, type: true, featured: true, adminEdited: true, publishedAt: true, category: { select: { name: true } }, _count: { select: { views: true, savedBy: true } } },
  });
  return (
    <div className="stack" style={{ gap: 18 }}>
      <AdminNav active="/admin/content" title="Материалы" />
      <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
        <form className="admin-search" action="/admin/content">
          <input className="input" name="q" defaultValue={q} placeholder="Поиск по заголовку" aria-label="Поиск материалов" />
          <button className="btn btn-secondary" type="submit">
            Найти
          </button>
        </form>
        <Link className="btn btn-accent" href="/admin/content/new">
          <Icon name="plus" size="sm" /> Новый материал
        </Link>
      </div>
      <div className="admin-list">
        {rows.map((c) => (
          <Link key={c.id} href={`/admin/content/${c.id}`} className="card admin-row clickable">
            <span className="admin-row-main">
              <b>{c.title}</b>
              <span className="muted">{TYPE[c.type] ?? c.type} · {c.category.name}</span>
            </span>
            <span className="admin-row-meta">
              {c.featured && <span className="chip">Рекомендуемый</span>}
              {c.adminEdited && <span className="chip">Изменён в админке</span>}
              <span className="muted num">{c._count.views} просм. · {c._count.savedBy} сохр.</span>
            </span>
          </Link>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12 }}>Курсы и уроки меняются в коде. Материалы, изменённые здесь, не перезаписываются при обновлении сайта.</p>
    </div>
  );
}
