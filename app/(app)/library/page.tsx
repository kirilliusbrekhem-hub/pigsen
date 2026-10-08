import type { Metadata } from "next";
import Link from "next/link";
import { ContentCard } from "@/components/content/ContentCard";
import { FilterChips, TypeTabs } from "@/components/content/FilterChips";
import { EmptyState } from "@/components/ui/States";
import { requireUserWith } from "@/lib/auth/session";
import { TYPE_LABELS } from "@/lib/content/mappers";
import { countByType, listCategories, listContent } from "@/lib/content/service";
import { CONTENT_TYPES, type ContentType } from "@/types";

export const metadata: Metadata = { title: "Библиотека" };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ type?: string; category?: string }> }) {
  const sp = await searchParams;
  const type = (CONTENT_TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as ContentType) : undefined;
  // The list is fetched alongside the categories with the requested filter; only an unknown category needs a second pass.
  const asked = sp.category || undefined;
  const [user, [categories, counts, first]] = await requireUserWith((userId) => Promise.all([listCategories(), countByType(), listContent(userId, { type, category: asked })]));
  const category = categories.some((c) => c.slug === sp.category) ? sp.category : undefined;
  const items = category === asked ? first : await listContent(user.id, { type, category });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const href = (t: string | null | undefined, c: string | null | undefined) => {
    const p = new URLSearchParams();
    if (t) p.set("type", t);
    if (c) p.set("category", c);
    const s = p.toString();
    return s ? `/library?${s}` : "/library";
  };

  return (
    <>
      <section className="page-head">
        <div>
          <span className="label">Business Content</span>
          <h1>Библиотека</h1>
          <p>Статьи, книги, видео, подкасты и курсы о бизнесе, стартапах, финансах и технологиях. Сохраняйте лучшее, чтобы вернуться позже.</p>
        </div>
        <Link className="btn btn-secondary" href="/search">
          Искать в библиотеке
        </Link>
      </section>

      <section className="stack" style={{ gap: 14 }}>
        <TypeTabs
          current={type ?? null}
          hrefFor={(v) => href(v, category)}
          options={[{ value: null, label: "Все", count: total }, ...CONTENT_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t].many, count: counts[t] ?? 0 }))]}
        />
        <FilterChips
          label="Категории"
          current={category ?? null}
          hrefFor={(v) => href(type, v)}
          options={[{ value: null, label: "Все категории" }, ...categories.map((c) => ({ value: c.slug, label: c.name, count: c.count }))]}
        />
      </section>

      {items.length ? (
        <section className="c-grid">
          {items.map((i) => (
            <ContentCard key={i.id} item={i} />
          ))}
        </section>
      ) : (
        <div className="card">
          <EmptyState icon="book" title="Ничего не найдено" text="В этой категории пока нет материалов такого типа. Попробуйте другой фильтр." action={<Link className="btn btn-secondary" href="/library">Сбросить фильтры</Link>} />
        </div>
      )}
    </>
  );
}
