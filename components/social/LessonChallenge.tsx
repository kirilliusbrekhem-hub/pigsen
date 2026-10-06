import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { challengeForCourse } from "@/lib/social/challenges";

/** "Челлендж к уроку": links a course to its offline challenge. Renders nothing when the course has none. */
export function LessonChallenge({ courseSlug }: { courseSlug: string }) {
  const c = challengeForCourse(courseSlug);
  if (!c) return null;
  return (
    <Link href={`/challenges#${c.id}`} className="card lesson-ch" data-testid="lesson-challenge">
      <span className="lesson-ch-ic">
        <Icon name="target" />
      </span>
      <span className="lesson-ch-body">
        <span className="label">Челлендж к уроку</span>
        <b>{c.title}</b>
        <span className="muted">Закрепи знания в реальной жизни и получи {c.reward} PigCoin$</span>
      </span>
      <Icon name="arrow" />
    </Link>
  );
}
