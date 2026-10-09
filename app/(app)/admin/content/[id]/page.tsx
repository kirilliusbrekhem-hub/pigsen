import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { ContentForm, type ContentFormValue } from "@/components/admin/ContentForm";
import { Icon } from "@/components/ui/Icon";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Редактор · Админка", robots: { index: false } };

export default async function AdminContentEdit({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const categories = await prisma.category.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true } });
  let initial: ContentFormValue;
  if (id === "new") {
    initial = { title: "", description: "", body: "", type: "article", category: categories[0]?.slug ?? "business", author: "Редакция PìgBiz", source: "PìgBiz", url: "", readingTime: 5, tags: "", featured: false, premium: false, trending: 0 };
  } else {
    const c = await prisma.contentItem.findUnique({ where: { id }, include: { category: { select: { slug: true } } } });
    if (!c || c.type === "course") notFound();
    initial = {
      id: c.id, slug: c.slug, title: c.title, description: c.description, body: c.body ?? "",
      type: c.type as ContentFormValue["type"], category: c.category.slug, author: c.author, source: c.source,
      url: c.url ?? "", readingTime: c.readingTime, tags: c.tags.split(",").filter(Boolean).join(", "), featured: c.featured, premium: c.premium, trending: c.trending,
    };
  }
  return (
    <div className="stack" style={{ gap: 18 }}>
      <AdminNav active="/admin/content" title={id === "new" ? "Новый материал" : "Редактирование"} />
      <Link href="/admin/content" className="link-btn muted">
        <Icon name="back" size="sm" /> Все материалы
      </Link>
      <ContentForm initial={initial} categories={categories} />
    </div>
  );
}
