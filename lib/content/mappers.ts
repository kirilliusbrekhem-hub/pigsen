import type { Category, ContentItem } from "@prisma/client";
import type { CategoryDTO, ContentCardDTO, ContentType } from "@/types";
import { CONTENT_TYPES } from "@/types";

export const COURSE_SLUG_PREFIX = "course-";

export function toCategoryDTO(c: Category): CategoryDTO {
  return { id: c.id, slug: c.slug, name: c.name, icon: c.icon };
}

export function asContentType(t: string): ContentType {
  return (CONTENT_TYPES as readonly string[]).includes(t) ? (t as ContentType) : "article";
}

export function contentHref(item: Pick<ContentItem, "slug" | "type">): string {
  return item.type === "course" ? `/learn/${item.slug.slice(COURSE_SLUG_PREFIX.length)}` : `/library/${item.slug}`;
}

export function toContentCard(item: ContentItem & { category: Category }, savedIds: Set<string>): ContentCardDTO {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    description: item.description,
    type: asContentType(item.type),
    author: item.author,
    source: item.source,
    readingTime: item.readingTime,
    publishedAt: item.publishedAt.toISOString(),
    category: toCategoryDTO(item.category),
    saved: savedIds.has(item.id),
    href: contentHref(item),
    premium: item.premium,
  };
}

export const TYPE_LABELS: Record<ContentType, { one: string; many: string; icon: string }> = {
  article: { one: "Статья", many: "Статьи", icon: "article" },
  book: { one: "Книга", many: "Книги", icon: "book" },
  video: { one: "Видео", many: "Видео", icon: "play" },
  podcast: { one: "Подкаст", many: "Подкасты", icon: "mic" },
  course: { one: "Курс", many: "Курсы", icon: "cap" },
};

export function formatDuration(type: ContentType, minutes: number): string {
  if (type === "book") return minutes >= 60 ? `≈ ${Math.round(minutes / 60)} ч чтения` : `${minutes} мин`;
  if (type === "video" || type === "podcast") return minutes >= 60 ? `${Math.floor(minutes / 60)} ч ${minutes % 60 ? (minutes % 60) + " мин" : ""}`.trim() : `${minutes} мин`;
  if (type === "course") return `${minutes} мин курса`;
  return `${minutes} мин чтения`;
}
