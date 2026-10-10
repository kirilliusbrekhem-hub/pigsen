import { Disclaimer, RISKY_CATEGORIES } from "@/components/legal/Disclaimer";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SetCrumb } from "@/components/layout/crumb";
import { ContentCard } from "@/components/content/ContentCard";
import { Markdown } from "@/components/content/Markdown";
import { SaveButton } from "@/components/content/SaveButton";
import { Icon } from "@/components/ui/Icon";
import { requireUser } from "@/lib/auth/session";
import { formatDuration, TYPE_LABELS } from "@/lib/content/mappers";
import { getContentBySlug, relatedContent } from "@/lib/content/service";
import { Track } from "@/components/ui/Track";
import { PremiumLock, ProChip } from "@/components/pro/PremiumLock";
import { hasPremium } from "@/lib/billing/plan";

export const metadata: Metadata = { title: "Материал" };

const OPEN_LABEL = { article: "Читать оригинал", book: "Подробнее о книге", video: "Смотреть видео", podcast: "Слушать подкаст", course: "Открыть курс" } as const;

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const item = await getContentBySlug(user.id, slug);
  if (!item) notFound();
  if (item.type === "course") redirect(item.href);
  const related = await relatedContent(user.id, item, 3);
  const locked = !!item.premium && !hasPremium(user.profile);
  const t = TYPE_LABELS[item.type];
  const published = new Date(item.publishedAt).toLocaleDateString("ru-RU", { year: "numeric", month: "long", ...(item.type === "book" ? {} : { day: "numeric" }) });

  return (
    <>
      <Track kind="view" id={item.id} />
      <SetCrumb title={item.title} />
      <section className="page-head">
        <div style={{ minWidth: 0 }}>
          <span className="label">
            {t.one} · {item.category.name} {item.premium && <ProChip />}
          </span>
          <h1>{item.title}</h1>
          <p>{item.description}</p>
          <div className="row muted" style={{ marginTop: 12, gap: 14, flexWrap: "wrap", fontSize: 13 }}>
            <span>{item.author}</span>
            <span>{item.source}</span>
            <span>{published}</span>
            <span>{formatDuration(item.type, item.readingTime)}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <SaveButton id={item.id} saved={item.saved} variant="button" />
          {item.url && (
            <a className="btn btn-secondary" href={item.url} target="_blank" rel="noopener noreferrer">
              {OPEN_LABEL[item.type]} <Icon name="external" size="sm" />
            </a>
          )}
        </div>
      </section>

      <section className="reader">
        <article className="card" style={{ overflow: "hidden" }}>
          <div className="reader-main">
            <span className="label" style={{ display: "block", marginBottom: 14 }}>
              Конспект Kapital
            </span>
            {locked ? (
              <>
                <div className="teaser-fade">
                  <Markdown>{(item.body ?? "").split("\n## ").slice(0, 2).join("\n## ")}</Markdown>
                </div>
                <PremiumLock />
              </>
            ) : item.body ? (
              <Markdown>{item.body}</Markdown>
            ) : (
              <p className="muted">Конспект для этого материала готовится.</p>
            )}
          </div>
          <div style={{ padding: "0 24px" }}>
            <Disclaimer kind={RISKY_CATEGORIES.has(item.category.slug) ? "invest" : "general"} compact={!RISKY_CATEGORIES.has(item.category.slug)} />
          </div>
          {item.tags.length > 0 && (
            <div className="reader-foot" style={{ justifyContent: "flex-start", gap: 6 }}>
              {item.tags.map((tag) => (
                <Link key={tag} className="badge" href={`/search?q=${encodeURIComponent(tag)}`}>
                  #{tag}
                </Link>
              ))}
            </div>
          )}
        </article>
        <aside className="reader-side">
          <div className="ai-card" style={{ padding: 22 }}>
            <div className="ai-tag">
              <span className="live" />
              CAP
            </div>
            <p style={{ marginTop: 14, fontSize: 15 }}>Разберите материал с CAP: главные идеи, примеры и как применить на практике.</p>
            <div className="stack" style={{ gap: 8, marginTop: 16 }}>
              <Link className="btn btn-light btn-sm" href={`/ai?q=${encodeURIComponent(`Объясни главные идеи «${item.title}» (${item.author}) и как их применить`)}`}>
                Обсудить с CAP <Icon name="arrow" size="sm" />
              </Link>
            </div>
          </div>
        </aside>
      </section>

      {related.length > 0 && (
        <section>
          <div className="sec-head">
            <h2>Ещё по теме {item.category.name}</h2>
            <Link className="link-btn" href={`/library?category=${item.category.slug}`}>
              Все <Icon name="arrow" size="sm" />
            </Link>
          </div>
          <div className="c-grid h-scroll">
            {related.map((r) => (
              <ContentCard key={r.id} item={r} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
