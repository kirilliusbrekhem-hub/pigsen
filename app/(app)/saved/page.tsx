import type { Metadata } from "next";
import Link from "next/link";
import { ContentCard } from "@/components/content/ContentCard";
import { TypeTabs } from "@/components/content/FilterChips";
import { EmptyState } from "@/components/ui/States";
import { requireUser } from "@/lib/auth/session";
import { TYPE_LABELS } from "@/lib/content/mappers";
import { listSaved } from "@/lib/content/saved";
import { CONTENT_TYPES, type ContentType } from "@/types";

export const metadata: Metadata = { title: "Сохранённое" };

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const type = (CONTENT_TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as ContentType) : null;
  const all = await listSaved(user.id);
  const items = type ? all.filter((s) => s.item.type === type) : all;
  const present = CONTENT_TYPES.filter((t) => all.some((s) => s.item.type === t));

  return (
    <>
      <section className="page-head">
        <div>
          <span className="label">Ваша библиотека</span>
          <h1>Сохранённое</h1>
          <p>Материалы и курсы, к которым вы хотите вернуться. Сохранения также помогают PìgBiz точнее подбирать рекомендации.</p>
        </div>
      </section>
      {all.length > 0 && (
        <TypeTabs
          current={type}
          hrefFor={(v) => (v ? `/saved?type=${v}` : "/saved")}
          options={[{ value: null, label: "Все", count: all.length }, ...present.map((t) => ({ value: t, label: TYPE_LABELS[t].many, count: all.filter((s) => s.item.type === t).length }))]}
        />
      )}
      {items.length ? (
        <section className="c-grid">
          {items.map((s) => (
            <ContentCard key={s.item.id} item={s.item} reason={`Сохранено ${new Date(s.savedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`} />
          ))}
        </section>
      ) : (
        <div className="card">
          <EmptyState
            icon="bookmark"
            title={all.length ? "В этой категории пусто" : "Вы пока ничего не сохранили"}
            text="Нажмите на закладку у статьи, книги, видео или курса, и материал появится здесь."
            action={
              <Link className="btn btn-primary" href="/library">
                Открыть библиотеку
              </Link>
            }
          />
        </div>
      )}
    </>
  );
}
