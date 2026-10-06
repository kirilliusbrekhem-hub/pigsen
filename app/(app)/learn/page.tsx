import type { Metadata } from "next";
import Link from "next/link";
import { FilterChips } from "@/components/content/FilterChips";
import { CourseCard } from "@/components/learning/CourseCard";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/States";
import { requireUser } from "@/lib/auth/session";
import { isPro } from "@/lib/billing/plan";
import { ProPromo } from "@/components/pro/ProPromo";
import { listCategories } from "@/lib/content/service";
import { learningHistory, learningStats, listCoursesWithProgress } from "@/lib/learning/service";

export const metadata: Metadata = { title: "Обучение" };

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const user = await requireUser();
  const { topic } = await searchParams;
  const [all, stats, categories, history] = await Promise.all([
    listCoursesWithProgress(user.id),
    learningStats(user.id),
    listCategories(),
    learningHistory(user.id, 5),
  ]);
  const topics = categories.filter((c) => all.some((x) => x.category.slug === c.slug));
  const current = topic && topics.some((t) => t.slug === topic) ? topic : null;
  const courses = current ? all.filter((c) => c.category.slug === current) : all;
  const metrics = [
    { k: "Общий прогресс", v: `${stats.percent}%`, f: `${stats.lessonsCompleted} из ${stats.totalLessons} уроков` },
    { k: "Курсов начато", v: `${stats.coursesStarted}`, f: `из ${all.length}` },
    { k: "Курсов завершено", v: `${all.filter((c) => c.percent === 100).length}`, f: "с прогрессом 100%" },
    { k: "Время обучения", v: `${stats.minutesLearned} мин`, f: "по пройденным урокам" },
  ];

  return (
    <>
      <section className="page-head">
        <div>
          <span className="label">Обучение</span>
          <h1>Курсы и прогресс</h1>
          <p>Выберите тему, проходите короткие уроки и отмечайте завершённые. $PIG поможет разобрать любой урок.</p>
        </div>
      </section>

      {!isPro(user.profile) && <ProPromo place="learn" />}
      <section className="kpis" aria-label="Прогресс">
        {metrics.map((m) => (
          <div key={m.k} className="card metric">
            <span className="label">{m.k}</span>
            <span className="v num">{m.v}</span>
            <span className="foot">{m.f}</span>
          </div>
        ))}
      </section>

      <section className="stack" style={{ gap: 16 }}>
        <FilterChips
          label="Темы"
          current={current}
          hrefFor={(v) => (v ? `/learn?topic=${v}` : "/learn")}
          options={[{ value: null, label: "Все темы", count: all.length }, ...topics.map((t) => ({ value: t.slug, label: t.name, count: all.filter((c) => c.category.slug === t.slug).length }))]}
        />
        {courses.length ? (
          <div className="grid cols-2">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState icon="cap" title="Курсов по этой теме пока нет" text="Мы готовим новые курсы. А пока посмотрите материалы в библиотеке." action={<Link className="btn btn-secondary" href={`/library?category=${current ?? ""}`}>Открыть библиотеку</Link>} />
          </div>
        )}
      </section>

      <section className="card" style={{ padding: "18px 22px 10px" }}>
        <div className="sec-head">
          <h2>История обучения</h2>
          <Link className="link-btn" href="/profile?tab=history">
            Вся история <Icon name="arrow" size="sm" />
          </Link>
        </div>
        {history.length ? (
          history.map((h) => (
            <Link key={h.id} href={h.href} className="hist-row">
              <span className={`ic ${h.status === "completed" ? "done" : ""}`}>
                <Icon name={h.status === "completed" ? "check" : "clock"} />
              </span>
              <span style={{ minWidth: 0 }}>
                <b style={{ fontWeight: 520, display: "block" }}>{h.lessonTitle}</b>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  {h.courseTitle} · {h.status === "completed" ? "пройден" : "в процессе"}
                </span>
              </span>
              <span className="muted mono" style={{ fontSize: 11.5 }}>
                {new Date(h.at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
              </span>
            </Link>
          ))
        ) : (
          <EmptyState icon="history" title="История пока пуста" text="Откройте первый урок любого курса, и он появится здесь." />
        )}
      </section>
    </>
  );
}
