import "server-only";
import { prisma } from "@/lib/db/prisma";
import { toCategoryDTO, toContentCard } from "@/lib/content/mappers";
import { getSavedIds } from "@/lib/content/saved";
import type { ContentType, SearchResultDTO } from "@/types";
import { normalize, queryTerms } from "./normalize";

function score(haystackTitle: string, haystack: string, terms: string[], phrase: string): number {
  const title = normalize(haystackTitle);
  let s = 0;
  if (title.includes(phrase)) s += 10;
  for (const t of terms) {
    if (title.includes(t)) s += 4;
    if (haystack.includes(t)) s += 1;
  }
  return s;
}

/**
 * Database search over content, courses (as content items), lessons and categories.
 * Every term must match (AND); results are ranked by title hits first.
 */
export async function search(userId: string, rawQuery: string, type?: ContentType, log = true): Promise<SearchResultDTO> {
  const phrase = normalize(rawQuery);
  const terms = queryTerms(rawQuery);
  if (!terms.length) return { query: rawQuery, content: [], lessons: [], categories: [], total: 0 };

  const [items, lessons, categories, saved] = await Promise.all([
    prisma.contentItem.findMany({
      where: { AND: terms.map((t) => ({ searchText: { contains: t } })), ...(type ? { type } : {}) },
      include: { category: true },
      take: 50,
    }),
    type && type !== "course"
      ? Promise.resolve([])
      : prisma.lesson.findMany({
          where: { AND: terms.map((t) => ({ searchText: { contains: t } })) },
          include: { course: true },
          take: 20,
        }),
    prisma.category.findMany(),
    getSavedIds(userId),
  ]);

  const content = items
    .map((i) => ({ i, s: score(i.title, i.searchText, terms, phrase) }))
    .sort((a, b) => b.s - a.s || b.i.trending - a.i.trending)
    .map(({ i }) => toContentCard(i, saved));

  const lessonResults = lessons
    .map((l) => ({ l, s: score(l.title, l.searchText, terms, phrase) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map(({ l }) => ({
      id: l.id,
      title: l.title,
      summary: l.summary,
      courseTitle: l.course.title,
      href: `/learn/${l.course.slug}/${l.slug}`,
    }));

  const cats = categories
    .filter((c) => terms.some((t) => normalize(`${c.name} ${c.slug} ${c.description}`).includes(t)))
    .map(toCategoryDTO);

  const total = content.length + lessonResults.length + cats.length;
  if (log) await prisma.searchQuery.create({ data: { userId, query: rawQuery.slice(0, 120), results: total } });
  return { query: rawQuery, content, lessons: lessonResults, categories: cats, total };
}

export async function recentSearches(userId: string, take = 6): Promise<string[]> {
  const rows = await prisma.searchQuery.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30, select: { query: true } });
  return Array.from(new Set(rows.map((r) => r.query))).slice(0, take);
}
