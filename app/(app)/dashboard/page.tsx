import type { Metadata } from "next";
import Link from "next/link";
import { ActivityBars } from "@/components/dashboard/ActivityBars";
import { GameStrip } from "@/components/dashboard/GameStrip";
import { Greeting } from "@/components/dashboard/Greeting";
import { ContentRow } from "@/components/content/ContentCard";
import { CourseCard } from "@/components/learning/CourseCard";
import { Icon } from "@/components/ui/Icon";
import { Orb } from "@/components/ui/Orb";
import { EmptyState } from "@/components/ui/States";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { trendingContent } from "@/lib/content/service";
import { factOfTheDay } from "@/lib/facts";
import { getGameStats } from "@/lib/gamification/service";
import { listSaved } from "@/lib/content/saved";
import { learningActivity, learningStats, listCoursesWithProgress } from "@/lib/learning/service";
import { getInterestProfile, getRecommendations } from "@/lib/recommendations/service";

export const metadata: Metadata = { title: "Главная" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [stats, activity, courses, recs, interests, trending, saved, convoCount, game] = await Promise.all([
    learningStats(user.id),
    learningActivity(user.id, 14),
    listCoursesWithProgress(user.id),
    getRecommendations(user.id, 6),
    getInterestProfile(user.id),
    trendingContent(user.id, 6),
    listSaved(user.id),
    prisma.conversation.count({ where: { userId: user.id } }),
    getGameStats(user.id),
  ]);
  const weekLessons = activity.slice(-7).reduce((s, d) => s + d.count, 0);
  const coursesInProgress = courses.filter((c) => c.started && c.percent < 100);
  const continueCourses = [...courses].sort((a, b) => Number(b.started && b.percent < 100) - Number(a.started && a.percent < 100)).slice(0, 2);
  const [hero, ...moreRecs] = recs;
  const firstName = user.name.split(" ")[0];

  const cells = [
    { k: "Уроков пройдено", v: `${stats.lessonsCompleted}`, d: `из ${stats.totalLessons} в каталоге`, href: "/learn", sw: "var(--ink)" },
    { k: "Курсов в процессе", v: `${coursesInProgress.length}`, d: `${courses.length} курса доступно`, href: "/learn", sw: "var(--accent)" },
    { k: "Сохранено", v: `${saved.length}`, d: "материалов в библиотеке", href: "/saved", sw: "var(--accent-2)" },
    { k: "Разговоров с $PIG", v: `${convoCount}`, d: "история сохраняется", href: "/ai", sw: "var(--accent-3)" },
  ];

  return (
    <>
      <section className="hello">
        <Greeting name={firstName} />
      </section>

      <GameStrip game={game} fact={factOfTheDay()} />

      <section className="tool-tabs h-scroll" aria-label="Инструменты">
        {[
          { href: "/savings", label: "Умная копилка", desc: "Цели и $PIG-коуч", icon: "piggy" },
          { href: "/savings#spend", label: "Что если потрачу?", desc: "Проверить покупку", icon: "wallet" },
          { href: "/tools?tab=idea", label: "Разбор идеи", desc: "$PIG оценит бизнес-идею", icon: "rocket" },
          { href: "/tools?tab=compound", label: "Сложный процент", desc: "Как растут вложения", icon: "trendUp" },
          { href: "/tools?tab=unit", label: "Юнит-экономика", desc: "LTV, CAC, окупаемость", icon: "chart" },
        ].map((t) => (
          <Link key={t.href} href={t.href} className="tool-tab">
            <span className="ic">
              <Icon name={t.icon} />
            </span>
            <span>
              <b>{t.label}</b>
              <span className="muted">{t.desc}</span>
            </span>
          </Link>
        ))}
      </section>

      <section>
        <div className="hero-stats">
          <div>
            <span className="label">Прогресс обучения</span>
            <div className="big num">
              {stats.percent}
              <span className="unit">%</span>
            </div>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <span className={`badge ${weekLessons ? "pos" : ""}`}>
                <Icon name="trendUp" />
                {weekLessons ? `+${weekLessons} ${weekLessons === 1 ? "урок" : "урока"} за неделю` : "Начните первый урок"}
              </span>
              <span className="muted num">{stats.minutesLearned} мин обучения</span>
            </div>
          </div>
          <ActivityBars days={activity} />
        </div>
        <div className="alloc-grid">
          {cells.map((c) => (
            <Link key={c.k} href={c.href} className="alloc-cell">
              <span className="k">
                <span className="sw" style={{ background: c.sw }} />
                {c.k}
              </span>
              <span className="v num">{c.v}</span>
              <span className="d">{c.d}</span>
              <Icon name="arrow" size="sm" className="go" />
            </Link>
          ))}
        </div>
      </section>

      {hero && (
        <section className="ai-card" aria-label="Рекомендация $PIG">
          <div className="ai-tag">
            <span className="live" />
            $PIG · подобрал для вас
          </div>
          <div className="ai-grid">
            <div>
              <h2>
                {hero.reason}: <em>{hero.item.title}</em>
              </h2>
              <p className="why">{hero.item.description}</p>
              <div className="row" style={{ marginTop: 22, flexWrap: "wrap", gap: 8 }}>
                <Link className="btn btn-light" href={hero.item.href}>
                  Открыть материал <Icon name="arrow" size="sm" />
                </Link>
                <Link className="btn btn-outline" href={`/ai?q=${encodeURIComponent(`Объясни главные идеи материала «${hero.item.title}»`)}`}>
                  Разобрать с $PIG
                </Link>
              </div>
            </div>
            <div className="drivers">
              <span className="label" style={{ color: "var(--ai-ink-2)" }}>
                Как PIGSEN видит ваши интересы
              </span>
              {interests.length ? (
                interests.map((i) => (
                  <div className="driver" key={i.slug}>
                    <span className="n">{i.name}</span>
                    <span className="track">
                      <span className={`fill ${i.weight < 0.6 ? "dim" : ""}`} style={{ width: `${Math.max(8, i.weight * 100)}%` }} />
                    </span>
                    <span className="v">{Math.round(i.weight * 100)}%</span>
                  </div>
                ))
              ) : (
                <Link href="/profile?tab=interests" className="link-btn" style={{ color: "var(--ai-ink)" }}>
                  Выберите интересы, чтобы рекомендации стали точнее <Icon name="arrow" size="sm" />
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      <Link className="m-ask card clickable" href="/ai" style={{ padding: "14px 16px", alignItems: "center", gap: 12, borderRadius: 16 }}>
        <Orb />
        <span className="muted" style={{ flex: 1 }}>
          Спросите $PIG о бизнесе и деньгах...
        </span>
        <Icon name="arrow" size="sm" />
      </Link>

      <section>
        <div className="sec-head">
          <h2>Продолжить обучение</h2>
          <Link className="link-btn" href="/learn">
            Все курсы <Icon name="arrow" size="sm" />
          </Link>
        </div>
        <div className="grid cols-3 h-scroll">
          {continueCourses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
          <Link className="goal-new" href="/learn">
            <Icon name="cap" size="lg" />
            <b style={{ color: "var(--ink)", fontWeight: 540 }}>Выбрать тему</b>
            <span style={{ fontSize: 12.5 }}>{courses.length} курса по бизнесу, финансам и AI</span>
          </Link>
        </div>
      </section>

      <section className="split">
        <div className="card" style={{ padding: "18px 10px 10px" }}>
          <div className="sec-head" style={{ padding: "0 12px", marginBottom: 6 }}>
            <h2>Актуальные темы</h2>
            <Link className="link-btn" href="/library">
              Библиотека <Icon name="arrow" size="sm" />
            </Link>
          </div>
          <div className="row-list">
            {trending.map((t) => (
              <ContentRow key={t.id} item={t} />
            ))}
          </div>
        </div>
        <div className="stack">
          <div className="card" style={{ padding: "18px 10px 10px" }}>
            <div className="sec-head" style={{ padding: "0 12px", marginBottom: 6 }}>
              <h3>Персонально для вас</h3>
              <span className="badge pos">
                <Icon name="sparkle" />
                AI-подбор
              </span>
            </div>
            {moreRecs.length ? (
              <div className="row-list">
                {moreRecs.slice(0, 4).map((r) => (
                  <div key={r.item.id}>
                    <ContentRow item={r.item} />
                    <div className="reason" style={{ fontSize: 12, color: "var(--accent)", padding: "0 12px 6px 64px", marginTop: -6 }}>
                      {r.reason}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="sparkle" title="Пока нечего предложить" text="Сохраните пару материалов или пройдите урок, и рекомендации станут персональными." />
            )}
          </div>
          <div className="card" style={{ padding: "18px 10px 10px" }}>
            <div className="sec-head" style={{ padding: "0 12px", marginBottom: 6 }}>
              <h3>Сохранённое</h3>
              <Link className="link-btn" href="/saved">
                Все <Icon name="arrow" size="sm" />
              </Link>
            </div>
            {saved.length ? (
              <div className="row-list">
                {saved.slice(0, 3).map((s) => (
                  <ContentRow key={s.item.id} item={s.item} />
                ))}
              </div>
            ) : (
              <EmptyState icon="bookmark" title="Здесь появятся ваши материалы" text="Нажмите на закладку у любого материала, чтобы вернуться к нему позже." />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
