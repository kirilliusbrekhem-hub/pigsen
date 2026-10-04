import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SetCrumb } from "@/components/layout/crumb";
import { Markdown } from "@/components/content/Markdown";
import { CompleteLessonButton } from "@/components/learning/CompleteLessonButton";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Ring";
import { requireUser } from "@/lib/auth/session";
import { getLesson, startLesson } from "@/lib/learning/service";

export const metadata: Metadata = { title: "Урок" };

export default async function LessonPage({ params }: { params: Promise<{ course: string; lesson: string }> }) {
  const user = await requireUser();
  const { course: courseSlug, lesson: lessonSlug } = await params;
  const data = await getLesson(user.id, courseSlug, lessonSlug);
  if (!data) notFound();
  if (data.lesson.status === "not_started") await startLesson(user.id, data.lesson.id);
  const { course, lessons, lesson, prev, next } = data;
  const courseHref = `/learn/${course.slug}`;

  return (
    <>
      <SetCrumb title={course.title} />
      <section className="page-head">
        <div>
          <span className="label">
            Урок {lesson.order} из {lessons.length} · {lesson.durationMin} мин
          </span>
          <h1>{lesson.title}</h1>
          <p>{lesson.summary}</p>
        </div>
      </section>

      <section className="reader">
        <article className="card" style={{ overflow: "hidden" }}>
          <div className="reader-main">
            <Markdown>{lesson.body}</Markdown>
          </div>
          <div className="reader-foot">
            {prev ? (
              <Link className="btn btn-ghost" href={`${courseHref}/${prev.slug}`}>
                <Icon name="back" size="sm" /> {prev.title}
              </Link>
            ) : (
              <span />
            )}
            <CompleteLessonButton lessonId={lesson.id} completed={lesson.status === "completed"} nextHref={next ? `${courseHref}/${next.slug}` : null} courseHref={courseHref} isLast={!next} />
          </div>
        </article>

        <aside className="reader-side">
          <div className="card card-pad stack" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <Link href={courseHref} className="link-btn">
                {course.title}
              </Link>
              <span className="mono muted" style={{ fontSize: 12 }}>
                {course.percent}%
              </span>
            </div>
            <ProgressBar percent={course.percent} label="Прогресс курса" />
            <div className="stack" style={{ gap: 2 }}>
              {lessons.map((l) => (
                <Link key={l.id} href={`${courseHref}/${l.slug}`} className={`ms-link ${l.id === lesson.id ? "cur" : ""} ${l.status === "completed" ? "done" : ""}`} aria-current={l.id === lesson.id ? "page" : undefined}>
                  <i />
                  <span>{l.title}</span>
                </Link>
              ))}
            </div>
          </div>
          <Link className="card clickable" href={`/ai?q=${encodeURIComponent(`Объясни урок «${lesson.title}» из курса «${course.title}» на простом примере`)}`} style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span className="opp-icon">
              <Icon name="sparkle" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontWeight: 540, display: "block" }}>Разобрать с $PIG</b>
              <span className="muted" style={{ fontSize: 12.5 }}>
                Объяснение на простом примере
              </span>
            </span>
            <Icon name="arrow" size="sm" />
          </Link>
        </aside>
      </section>
    </>
  );
}
