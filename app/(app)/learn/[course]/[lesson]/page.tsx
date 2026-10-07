import { Disclaimer, RISKY_CATEGORIES } from "@/components/legal/Disclaimer";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SetCrumb } from "@/components/layout/crumb";
import { Markdown } from "@/components/content/Markdown";
import { CompleteLessonButton } from "@/components/learning/CompleteLessonButton";
import { LessonQuiz } from "@/components/learning/LessonQuiz";
import { prisma } from "@/lib/db/prisma";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Ring";
import { requireUser } from "@/lib/auth/session";
import { getLesson } from "@/lib/learning/service";
import { Track } from "@/components/ui/Track";
import { PremiumLock, ProChip } from "@/components/pro/PremiumLock";
import { isPro } from "@/lib/billing/plan";
import { lessonLocked } from "@/lib/learning/premium";
import { LessonChallenge } from "@/components/social/LessonChallenge";

export const metadata: Metadata = { title: "Урок" };

export default async function LessonPage({ params }: { params: Promise<{ course: string; lesson: string }> }) {
  const user = await requireUser();
  const { course: courseSlug, lesson: lessonSlug } = await params;
  const data = await getLesson(user.id, courseSlug, lessonSlug);
  if (!data) notFound();
  const { course, lessons, lesson, prev, next } = data;
  const courseHref = `/learn/${course.slug}`;
  const pro = isPro(user.profile);
  const locked = lessonLocked(!!course.premium, lesson.order, pro);
  const passedQuiz = (await prisma.quizAttempt.count({ where: { userId: user.id, lessonId: lesson.id, completedAt: { not: null } } })) > 0;

  return (
    <>
      {lesson.status === "not_started" && !locked && <Track kind="lesson" id={lesson.id} />}
      <SetCrumb title={course.title} />
      <section className="page-head">
        <div>
          <span className="label">
            Урок {lesson.order} из {lessons.length} · {lesson.durationMin} мин {course.premium && <ProChip />}
          </span>
          <h1>{lesson.title}</h1>
          <p>{lesson.summary}</p>
        </div>
      </section>

      <section className="reader">
        <div className="stack" style={{ minWidth: 0, gap: 20 }}>
          <article className="card" style={{ overflow: "hidden" }}>
            <div className="reader-main">
              {locked ? <PremiumLock what="урок" /> : <Markdown>{lesson.body}</Markdown>}
              <Disclaimer kind={RISKY_CATEGORIES.has(course.category.slug) ? "invest" : "general"} compact={!RISKY_CATEGORIES.has(course.category.slug)} />
              {!locked && course.premium && !pro && (
                <p className="premium-note">
                  Это бесплатный первый урок эксклюзивного курса. Остальные уроки открыты в <Link href="/pro">PIGSEN Pro</Link>.
                </p>
              )}
            </div>
            <div className="reader-foot">
              {prev ? (
                <Link className="btn btn-ghost" href={`${courseHref}/${prev.slug}`}>
                  <Icon name="back" size="sm" /> {prev.title}
                </Link>
              ) : (
                <span />
              )}
              {!locked && <CompleteLessonButton lessonId={lesson.id} completed={lesson.status === "completed"} nextHref={next ? `${courseHref}/${next.slug}` : null} courseHref={courseHref} isLast={!next} />}
            </div>
          </article>
          {!locked && <LessonQuiz lessonId={lesson.id} passedBefore={passedQuiz} />}
          {!locked && <LessonChallenge courseSlug={course.slug} />}
        </div>

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
                <Link
                  key={l.id}
                  href={`${courseHref}/${l.slug}`}
                  className={`ms-link ${l.id === lesson.id ? "cur" : ""} ${l.status === "completed" ? "done" : ""}`}
                  aria-current={l.id === lesson.id ? "page" : undefined}
                >
                  <i />
                  <span>{l.title}</span>
                  {lessonLocked(!!course.premium, l.order, pro) && <Icon name="lock" size="sm" />}
                </Link>
              ))}
            </div>
          </div>
          <Link
            className="card clickable"
            href={`/ai?q=${encodeURIComponent(`Объясни урок «${lesson.title}» из курса «${course.title}» на простом примере`)}`}
            style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}
          >
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
