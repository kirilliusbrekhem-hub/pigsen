import Link from "next/link";
import { Ring, ProgressBar } from "@/components/ui/Ring";
import { Icon } from "@/components/ui/Icon";
import type { CourseProgressDTO } from "@/types";

export const LEVELS: Record<string, string> = { beginner: "Начальный", intermediate: "Средний", advanced: "Продвинутый" };

export function CourseCard({ course }: { course: CourseProgressDTO }) {
  const done = course.percent === 100;
  return (
    <Link href={`/learn/${course.slug}`} className="card clickable course-card">
      <div className="top">
        <Ring percent={course.percent} />
        <div style={{ minWidth: 0 }}>
          <h3>{course.title}</h3>
          <div className="sub">
            {course.category.name} · {LEVELS[course.level] ?? course.level} · {course.totalLessons} уроков
          </div>
        </div>
      </div>
      <p className="desc">{course.description}</p>
      <ProgressBar percent={course.percent} label={`Прогресс курса ${course.title}`} />
      <div className="foot">
        <span>
          {course.completedLessons} из {course.totalLessons} пройдено
        </span>
        <span className="row" style={{ gap: 6, color: done ? "var(--accent)" : "var(--ink-2)" }}>
          {done ? (
            <>
              <Icon name="check" size="sm" /> Завершён
            </>
          ) : course.started ? (
            <>
              Продолжить <Icon name="arrow" size="sm" />
            </>
          ) : (
            <>
              Начать <Icon name="arrow" size="sm" />
            </>
          )}
        </span>
      </div>
    </Link>
  );
}
