import type { Metadata } from "next";
import Link from "next/link";
import { ContentRow } from "@/components/content/ContentCard";
import { CourseCard } from "@/components/learning/CourseCard";
import { InterestsForm } from "@/components/profile/InterestsForm";
import { PersonalForm } from "@/components/profile/PersonalForm";
import { SecurityForm } from "@/components/profile/SecurityForm";
import { SettingsForm } from "@/components/profile/SettingsForm";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/States";
import { requireUser } from "@/lib/auth/session";
import { listCategories, viewHistory } from "@/lib/content/service";
import { listSaved } from "@/lib/content/saved";
import { getGameStats } from "@/lib/gamification/service";
import { learningHistory, learningStats, listCoursesWithProgress } from "@/lib/learning/service";
import { ProgressBar } from "@/components/ui/Ring";
import { parseInterests, profileTheme, profileTone } from "@/lib/profile/service";

export const metadata: Metadata = { title: "Профиль" };

const SECTIONS = [
  ["personal", "Личные данные", "user"],
  ["interests", "Интересы", "target"],
  ["progress", "Прогресс", "trendUp"],
  ["saved", "Сохранённое", "bookmark"],
  ["history", "История обучения", "history"],
  ["settings", "Настройки", "sliders"],
  ["security", "Безопасность", "shield"],
] as const;
type Section = (typeof SECTIONS)[number][0];

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { tab } = await searchParams;
  const sec: Section = SECTIONS.some(([id]) => id === tab) ? (tab as Section) : "personal";
  const profile = user.profile;
  const memberSince = user.createdAt.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  return (
    <>
      <section className="page-head">
        <div>
          <span className="label">Профиль</span>
          <h1>{user.name}</h1>
        </div>
      </section>
      <div className="prof">
        <nav className="prof-nav" aria-label="Разделы профиля">
          {SECTIONS.map(([id, label, icon]) => (
            <Link key={id} href={`/profile?tab=${id}`} className={sec === id ? "is-selected" : ""} aria-current={sec === id ? "page" : undefined} scroll={false} style={{ textAlign: "left", padding: "8px 12px", borderRadius: 9, display: "flex", gap: 10, alignItems: "center", fontWeight: 500 }}>
              <Icon name={icon} size="sm" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="stack fade-in" style={{ minWidth: 0 }} key={sec}>
          <h2 style={{ fontSize: 18 }}>{SECTIONS.find(([id]) => id === sec)?.[1]}</h2>
          {sec === "personal" && <PersonalForm name={user.name} email={user.email} bio={profile?.bio ?? ""} avatar={profile?.avatar ?? null} memberSince={memberSince} />}
          {sec === "interests" && <InterestsSection userInterests={parseInterests(profile)} />}
          {sec === "progress" && <ProgressSection userId={user.id} />}
          {sec === "saved" && <SavedSection userId={user.id} />}
          {sec === "history" && <HistorySection userId={user.id} />}
          {sec === "settings" && (
            <SettingsForm
              initial={{
                theme: profileTheme(profile),
                aiTone: profileTone(profile),
                dailyGoalMinutes: profile?.dailyGoalMinutes ?? 15,
                notifyDigest: profile?.notifyDigest ?? true,
                notifyNewContent: profile?.notifyNewContent ?? true,
              }}
            />
          )}
          {sec === "security" && <SecurityForm />}
        </div>
      </div>
    </>
  );
}

async function InterestsSection({ userInterests }: { userInterests: string[] }) {
  const cats = await listCategories();
  return (
    <>
      <p className="ink2">Интересы влияют на рекомендации на главной и на то, как $PIG подбирает примеры.</p>
      <InterestsForm options={cats.map((c) => ({ slug: c.slug, name: c.name, description: c.description, icon: c.icon }))} initial={userInterests} />
    </>
  );
}

async function ProgressSection({ userId }: { userId: string }) {
  const [stats, courses, game] = await Promise.all([learningStats(userId), listCoursesWithProgress(userId), getGameStats(userId)]);
  const metrics = [
    { k: "Уровень", v: `${game.level.index} · ${game.level.name}` },
    { k: "Опыт", v: `${game.xp} XP` },
    { k: "Серия", v: `${game.streak} 🔥` },
    { k: "Общий прогресс", v: `${stats.percent}%` },
    { k: "Уроков пройдено", v: `${stats.lessonsCompleted}` },
    { k: "Курсов начато", v: `${stats.coursesStarted}` },
    { k: "Минут обучения", v: `${stats.minutesLearned}` },
  ];
  return (
    <>
      <div className="stat-grid">
        {metrics.map((m) => (
          <div key={m.k} className="card metric">
            <span className="label">{m.k}</span>
            <span className="v num">{m.v}</span>
          </div>
        ))}
      </div>
      <div className="card card-pad stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <b>
            Уровень {game.level.index}: {game.level.name}
          </b>
          <span className="muted num" style={{ fontSize: 13 }}>
            {game.level.nextMin !== null ? `${game.xp} / ${game.level.nextMin} XP до «${game.level.nextName}»` : `${game.xp} XP · максимальный уровень`}
          </span>
        </div>
        <ProgressBar percent={game.level.percent} label="Прогресс уровня" />
        <span className="muted" style={{ fontSize: 12.5 }}>
          XP начисляются за пройденные уроки (+20), верные ответы в квизах (+10) и разбор бизнес-идеи (+15).
        </span>
      </div>
      <h3 style={{ fontSize: 15 }}>
        Бейджи · {game.badges.filter((b) => b.earned).length} из {game.badges.length}
      </h3>
      <div className="badge-grid">
        {game.badges.map((b) => (
          <div key={b.id} className={`badge-tile ${b.earned ? "earned" : ""}`} title={b.earned ? "Получен" : "Ещё не получен"}>
            <span className="ic">
              <Icon name={b.earned ? b.icon : "lock"} />
            </span>
            <b>{b.name}</b>
            <span>{b.description}</span>
          </div>
        ))}
      </div>
      <div className="grid cols-2">
        {courses.map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </div>
    </>
  );
}

async function SavedSection({ userId }: { userId: string }) {
  const saved = await listSaved(userId);
  return saved.length ? (
    <div className="card" style={{ padding: 10 }}>
      <div className="row-list">
        {saved.slice(0, 8).map((s) => (
          <ContentRow key={s.item.id} item={s.item} />
        ))}
      </div>
      <div style={{ padding: "8px 12px" }}>
        <Link className="link-btn" href="/saved">
          Все сохранённые · {saved.length} <Icon name="arrow" size="sm" />
        </Link>
      </div>
    </div>
  ) : (
    <div className="card">
      <EmptyState icon="bookmark" title="Пока ничего не сохранено" text="Сохраняйте материалы из библиотеки, чтобы собрать свою подборку." action={<Link className="btn btn-primary" href="/library">Открыть библиотеку</Link>} />
    </div>
  );
}

async function HistorySection({ userId }: { userId: string }) {
  const [lessons, views] = await Promise.all([learningHistory(userId, 15), viewHistory(userId, 10)]);
  return (
    <>
      <div className="card" style={{ padding: "14px 22px" }}>
        <span className="label">Уроки</span>
        {lessons.length ? (
          lessons.map((h) => (
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
          <EmptyState icon="cap" title="Вы ещё не начали обучение" text="Откройте любой курс, и история появится здесь." />
        )}
      </div>
      <div className="card" style={{ padding: "14px 10px" }}>
        <span className="label" style={{ padding: "0 12px" }}>
          Просмотренные материалы
        </span>
        {views.length ? (
          <div className="row-list">
            {views.map((v) => (
              <ContentRow key={`${v.item.id}-${v.at}`} item={v.item} />
            ))}
          </div>
        ) : (
          <EmptyState icon="book" title="Нет просмотров" text="Открытые материалы из библиотеки появятся здесь." />
        )}
      </div>
    </>
  );
}
