import type { Metadata } from "next";
import Link from "next/link";
import { ContentCard } from "@/components/content/ContentCard";
import { TypeTabs } from "@/components/content/FilterChips";
import { SearchForm } from "@/components/search/SearchForm";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/States";
import { requireUser } from "@/lib/auth/session";
import { TYPE_LABELS } from "@/lib/content/mappers";
import { listCategories } from "@/lib/content/service";
import { recentSearches, search } from "@/lib/search/service";
import { CONTENT_TYPES, type ContentType } from "@/types";

export const metadata: Metadata = { title: "Поиск" };

const POPULAR = ["венчур", "юнит-экономика", "MVP", "AI", "инвестиции", "лидерство"];

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 120);
  const type = (CONTENT_TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as ContentType) : undefined;

  if (!q) {
    const [recent, categories] = await Promise.all([recentSearches(user.id), listCategories()]);
    return (
      <>
        <section className="page-head">
          <div>
            <span className="label">Поиск</span>
            <h1>Найти материалы и темы</h1>
          </div>
        </section>
        <SearchForm initial="" />
        {recent.length > 0 && (
          <section className="stack" style={{ gap: 10 }}>
            <span className="label">Недавние запросы</span>
            <div className="row-wrap">
              {recent.map((r) => (
                <Link key={r} className="chip" href={`/search?q=${encodeURIComponent(r)}`}>
                  <Icon name="history" size="sm" />
                  {r}
                </Link>
              ))}
            </div>
          </section>
        )}
        <section className="stack" style={{ gap: 10 }}>
          <span className="label">Популярное</span>
          <div className="row-wrap">
            {POPULAR.map((r) => (
              <Link key={r} className="chip" href={`/search?q=${encodeURIComponent(r)}`}>
                {r}
              </Link>
            ))}
          </div>
        </section>
        <section className="stack" style={{ gap: 10 }}>
          <span className="label">Темы</span>
          <div className="grid cols-3">
            {categories.map((c) => (
              <Link key={c.slug} href={`/library?category=${c.slug}`} className="card clickable" style={{ padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
                <span className="cat-ic">
                  <Icon name={c.icon} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <b style={{ fontWeight: 540, display: "block" }}>{c.name}</b>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {c.count} материалов
                  </span>
                </span>
                <Icon name="chevR" size="sm" />
              </Link>
            ))}
          </div>
        </section>
      </>
    );
  }

  const [res, full] = await Promise.all([search(user.id, q, type), type ? search(user.id, q, undefined, false) : Promise.resolve(null)]);
  const all = full ?? res;
  const tabCount = (t: ContentType) => all.content.filter((c) => c.type === t).length;
  const href = (t: string | null) => `/search?q=${encodeURIComponent(q)}${t ? `&type=${t}` : ""}`;

  return (
    <>
      <section className="page-head">
        <div>
          <span className="label">Поиск</span>
          <h1>
            «{q}» <span className="muted" style={{ fontSize: 18 }}>· {res.total} результатов</span>
          </h1>
        </div>
      </section>
      <SearchForm initial={q} />
      <TypeTabs current={type ?? null} hrefFor={href} options={[{ value: null, label: "Все", count: all.content.length }, ...CONTENT_TYPES.filter((t) => tabCount(t) > 0).map((t) => ({ value: t, label: TYPE_LABELS[t].many, count: tabCount(t) }))]} />

      {res.total === 0 ? (
        <div className="card">
          <EmptyState
            icon="search"
            title="Ничего не нашлось"
            text="Попробуйте другое слово или задайте вопрос $PIG: он объяснит тему и подскажет материалы."
            action={
              <Link className="btn btn-primary" href={`/ai?q=${encodeURIComponent(q)}`}>
                Спросить $PIG
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {res.categories.length > 0 && (
            <section className="stack" style={{ gap: 10 }}>
              <span className="label">Темы</span>
              <div className="row-wrap">
                {res.categories.map((c) => (
                  <Link key={c.slug} className="chip" href={`/library?category=${c.slug}`}>
                    <Icon name={c.icon} size="sm" />
                    {c.name}
                  </Link>
                ))}
              </div>
            </section>
          )}
          {res.content.length > 0 && (
            <section className="c-grid">
              {res.content.map((c) => (
                <ContentCard key={c.id} item={c} />
              ))}
            </section>
          )}
          {res.lessons.length > 0 && (
            <section className="card" style={{ padding: "18px 10px 6px" }}>
              <div className="sec-head" style={{ padding: "0 12px" }}>
                <h2>Уроки</h2>
              </div>
              {res.lessons.map((l) => (
                <Link key={l.id} href={l.href} className="lesson-row">
                  <span className="num">
                    <Icon name="cap" size="sm" />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="t" style={{ display: "block" }}>
                      {l.title}
                    </span>
                    <span className="s">
                      {l.courseTitle} · {l.summary}
                    </span>
                  </span>
                  <Icon name="chevR" size="sm" />
                </Link>
              ))}
            </section>
          )}
          <Link className="card clickable" href={`/ai?q=${encodeURIComponent(q)}`} style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span className="opp-icon">
              <Icon name="sparkle" />
            </span>
            <span style={{ flex: 1 }}>
              <b style={{ fontWeight: 540 }}>Спросить $PIG про «{q}»</b>
              <span className="muted" style={{ display: "block", fontSize: 12.5 }}>
                Объяснение простыми словами и подборка материалов
              </span>
            </span>
            <Icon name="arrow" size="sm" />
          </Link>
        </>
      )}
    </>
  );
}
