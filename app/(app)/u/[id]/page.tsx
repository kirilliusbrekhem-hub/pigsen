import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isPro } from "@/lib/billing/plan";
import { getGameStats } from "@/lib/gamification/service";
import { avatarUrl } from "@/lib/profile/avatar-url";
import { LOOK_SELECT, lookOf } from "@/lib/profile/cosmetics";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Профиль участника" };

/** Read-only profile card of another member: what they chose to show (no email, no private data). */
export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const u = await prisma.user.findUnique({
    where: { id: id.slice(0, 40) },
    select: { id: true, name: true, blocked: true, createdAt: true, profile: { select: { avatar: true, updatedAt: true, proUntil: true, title: true, bio: true, ...LOOK_SELECT } } },
  });
  if (!u || u.blocked) notFound();
  const game = await getGameStats(u.id);
  const since = u.createdAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const self = u.id === me.id;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <ProfileCard name={u.name} avatarUrl={avatarUrl(u.id, u.profile)} look={lookOf(u.profile)} pro={isPro(u.profile)} title={u.profile?.title || undefined} sub={<span>С нами с {since}</span>}>
        {u.profile?.bio && <p style={{ fontSize: 14, maxWidth: "60ch", overflowWrap: "anywhere" }}>{u.profile.bio}</p>}
      </ProfileCard>
      <div className="stat-grid">
        <div className="card metric"><span className="label">Уровень</span><span className="v num">{game.level.index} · {game.level.name}</span></div>
        <div className="card metric"><span className="label">Опыт</span><span className="v num">{game.xp} XP</span></div>
        <div className="card metric"><span className="label">Серия</span><span className="v num">{game.streak} дн.</span></div>
        <div className="card metric"><span className="label">Бейджи</span><span className="v num">{game.badges.filter((b) => b.earned).length}</span></div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {self ? (
          <Link href="/profile?tab=style" className="btn btn-primary"><Icon name="palette" size="sm" /> Изменить оформление</Link>
        ) : (
          <Link href={`/messages/${u.id}`} className="btn btn-primary"><Icon name="message" size="sm" /> Написать</Link>
        )}
        <Link href="/leaderboard" className="btn btn-secondary">Лидерборд</Link>
      </div>
    </div>
  );
}
