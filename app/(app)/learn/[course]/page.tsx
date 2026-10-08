import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SetCrumb } from "@/components/layout/crumb";
import { SaveButton } from "@/components/content/SaveButton";
import { LEVELS } from "@/components/learning/CourseCard";
import { Icon } from "@/components/ui/Icon";
import { Ring } from "@/components/ui/Ring";
import { requireUserWith } from "@/lib/auth/session";
import { getCourseWithProgress } from "@/lib/learning/service";
import { hasPremium } from "@/lib/billing/plan";
import { lessonLocked } from "@/lib/learning/premium";

export async function generateMetadata({ params }: { params: Promise<{ course: string }> }): Promise<Metadata> {
  const { course } = await params;
  return { title: course.replace(/-/g, " ") };
}

export default async function CoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course: slug } = await params;
  const [user, data] = await requireUserWith((userId) => getCourseWithProgress(userId, slug));
  if (!data) notFound();
  const { course, lessons } = data;
  const pro = hasPremium(user.profile); // Pro or a PigCoin$ pass
  const next = lessons.find((l) => l.status !== "completed") ?? lessons[0];
  const cta = course.percent === 100 ? "Повторить курс" : course.started ? "Продолжить" : "Начать обучение";

  return (
    <>
      <SetCrumb title={course.title} />
      <section className="course-hero">
        <Ring percent={course.percent} size={132} stroke={9} large />
        <div style={{ minWidth: 0 }}>
          <span className="label">
            {course.category.name} · {LEVELS[course.level] ?? course.level} {course.premium && <span className="pro-badge">Pro</span>}
          </span>
          <h1 style={{ marginTop: 6 }}>{course.title}</h1>
          <p className="ink2" style={{ marginTop: 8, maxWidth: "62ch" }}>
            {course.description}
          </p>
          <div className="row muted" style={{ marginTop: 10, gap: 14, flexWrap: "wrap", fontSize: 13 }}>
            <span>{course.totalLessons} уроков</span>
            {course.premium && !pro && <Link href="/pro">Эксклюзив Pro: первый урок бесплатно</Link>}
            <span>≈ {course.totalMinutes} мин</span>
            <span>
              {course.completedLessons} из {course.totalLessons} пройдено
            </span>
          </div>
        </div>
        <div className="gh-act row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Link className="btn btn-primary btn-lg" href={`/learn/${course.slug}/${next.slug}`}>
            {cta} <Icon name="arrow" size="sm" />
          </Link>
          {course.contentItemId && <SaveButton id={course.contentItemId} saved={course.saved} variant="button" />}
        </div>
      </section>

      <section className="split">
        <div className="card" style={{ padding: "18px 10px 6px" }}>
          <div className="sec-head" style={{ padding: "0 12px", marginBottom: 6 }}>
            <h2>Уроки</h2>
            <span className="muted mono" style={{ fontSize: 12 }}>
              {course.percent}%
            </span>
          </div>
          {lessons.map((l) => (
            <Link key={l.id} href={`/learn/${course.slug}/${l.slug}`} className="lesson-row">
              <span className={`num ${l.status === "completed" ? "done" : l.status === "in_progress" ? "run" : ""}`}>{l.status === "completed" ? <Icon name="check" /> : l.order}</span>
              <span style={{ minWidth: 0 }}>
                <span className="t" style={{ display: "block" }}>
                  {l.title}
                </span>
                <span className="s">{l.summary}</span>
              </span>
              <span className="muted mono" style={{ fontSize: 11.5 }}>
                {lessonLocked(!!course.premium, l.order, pro) ? <Icon name="lock" size="sm" /> : `${l.durationMin} мин`}
              </span>
            </Link>
          ))}
        </div>
        <div className="stack">
          <div className="ai-card" style={{ padding: 22 }}>
            <div className="ai-tag">
              <span className="live" />
              $PIG · помощник по курсу
            </div>
            <p style={{ marginTop: 14, fontSize: 15 }}>Не понятен термин или пример? Спросите $PIG, и он объяснит на вашем уровне.</p>
            <Link className="btn btn-light btn-sm" style={{ marginTop: 16 }} href={`/ai?q=${encodeURIComponent(`Я прохожу курс «${course.title}». Объясни главные идеи курса простыми словами.`)}`}>
              Спросить $PIG <Icon name="arrow" size="sm" />
            </Link>
          </div>
          <div className="card card-pad stack" style={{ gap: 10 }}>
            <span className="label">Что вы узнаете</span>
            <ul className="ans-list">
              {lessons.map((l) => (
                <li key={l.id} className={l.status === "completed" ? "pos" : ""}>
                  <Icon name={l.status === "completed" ? "check" : "dots"} />
                  <span>{l.summary}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
