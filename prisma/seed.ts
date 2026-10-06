import { PrismaClient } from "@prisma/client";
import { categories } from "./seed-data/categories";
import { content as baseContent } from "./seed-data/content";
import { courses as baseCourses } from "./seed-data/courses";
import { coursesExtra } from "./seed-data/courses-extra";
import { contentExtra } from "./seed-data/content-extra";
import { contentCrypto } from "./seed-data/content-crypto";
import { coursesCrypto } from "./seed-data/courses-crypto";
const content = [...baseContent, ...contentExtra, ...contentCrypto];
const courses = [...baseCourses, ...coursesExtra, ...coursesCrypto];
import { buildSearchText } from "../lib/search/normalize";

const prisma = new PrismaClient();

async function main() {
  const categoryIds = new Map<string, string>();
  for (const [order, c] of categories.entries()) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, icon: c.icon, order },
      create: { ...c, order },
    });
    categoryIds.set(c.slug, row.id);
  }
  const cat = (slug: string) => {
    const id = categoryIds.get(slug);
    if (!id) throw new Error(`Unknown category ${slug}`);
    return id;
  };

  for (const item of content) {
    const data = {
      title: item.title,
      description: item.description,
      body: item.body,
      type: item.type,
      author: item.author,
      source: item.source,
      url: item.url,
      publishedAt: new Date(item.publishedAt),
      readingTime: item.readingTime,
      tags: item.tags.join(","),
      featured: item.featured ?? false,
      trending: item.trending ?? 0,
      categoryId: cat(item.category),
      searchText: buildSearchText(item.title, item.description, item.author, item.tags.join(" "), item.body),
    };
    // Items edited or deleted in the admin panel are not overwritten or recreated by the seed.
    const existing = await prisma.contentItem.findUnique({ where: { slug: item.slug }, select: { adminEdited: true } });
    if (existing?.adminEdited) continue;
    if (!existing && (await prisma.deletedSlug.findUnique({ where: { slug: item.slug } }))) continue;
    await prisma.contentItem.upsert({ where: { slug: item.slug }, update: data, create: { slug: item.slug, ...data } });
  }

  for (const [order, c] of courses.entries()) {
    const minutes = c.lessons.reduce((s, l) => s + l.durationMin, 0);
    // Every course is also a ContentItem (type "course") so it can be searched, recommended and saved.
    const itemData = {
      title: c.title,
      description: c.description,
      type: "course",
      author: "PIGSEN Academy",
      source: "PIGSEN",
      url: null,
      body: null,
      publishedAt: new Date("2026-09-01"),
      readingTime: minutes,
      tags: c.tags.join(","),
      featured: order === 0,
      trending: 3,
      categoryId: cat(c.category),
      searchText: buildSearchText(c.title, c.description, c.tags.join(" "), ...c.lessons.map((l) => l.title)),
    };
    const item = await prisma.contentItem.upsert({
      where: { slug: `course-${c.slug}` },
      update: itemData,
      create: { slug: `course-${c.slug}`, ...itemData },
    });
    const courseData = {
      title: c.title,
      description: c.description,
      level: c.level,
      order,
      categoryId: cat(c.category),
      contentItemId: item.id,
      searchText: buildSearchText(c.title, c.description, c.tags.join(" ")),
    };
    const course = await prisma.course.upsert({ where: { slug: c.slug }, update: courseData, create: { slug: c.slug, ...courseData } });
    for (const [i, l] of c.lessons.entries()) {
      const lessonData = {
        title: l.title,
        summary: l.summary,
        body: l.body,
        order: i + 1,
        durationMin: l.durationMin,
        searchText: buildSearchText(l.title, l.summary, l.body),
      };
      await prisma.lesson.upsert({
        where: { courseId_slug: { courseId: course.id, slug: l.slug } },
        update: lessonData,
        create: { ...lessonData, slug: l.slug, courseId: course.id },
      });
    }
  }

  const counts = await Promise.all([prisma.category.count(), prisma.contentItem.count(), prisma.course.count(), prisma.lesson.count()]);
  console.log(`Seeded: ${counts[0]} categories, ${counts[1]} content items, ${counts[2]} courses, ${counts[3]} lessons`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
