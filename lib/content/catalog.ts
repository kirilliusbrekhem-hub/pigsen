import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import type { Category, ContentItem } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Cross-request cache for the content catalog (categories, lesson count, materials). It only changes on
 * deploy (seed) or when an admin edits content, which calls `invalidateCatalog()`. Each page otherwise paid
 * extra DB round trips for the same rows on every request.
 */
const TAG = "catalog";
const opts = { revalidate: 300, tags: [TAG] };

export function invalidateCatalog() {
  try {
    revalidateTag(TAG, { expire: 0 });
  } catch (e) {
    console.error("[catalog] revalidate failed", e);
  }
}

export const getCategories = cache(
  unstable_cache(() => prisma.category.findMany({ orderBy: { order: "asc" } }), ["catalog-categories-v1"], opts),
);

export const getCategoriesWithCounts = cache(
  unstable_cache(
    () => prisma.category.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { contents: true } } } }),
    ["catalog-categories-counts-v1"],
    opts,
  ),
);

export const getLessonCount = cache(unstable_cache(() => prisma.lesson.count(), ["catalog-lesson-count-v1"], opts));

type CatalogItem = ContentItem & { category: Category };

const loadItems = unstable_cache(() => prisma.contentItem.findMany({ include: { category: true } }), ["catalog-items-v1"], opts);

/** All materials with their category (Dates revived: the data cache stores JSON). */
export const getCatalogItems = cache(async (): Promise<CatalogItem[]> => {
  const rows = await loadItems();
  return rows.map((r) => ({ ...r, publishedAt: new Date(r.publishedAt), createdAt: new Date(r.createdAt) }));
});
