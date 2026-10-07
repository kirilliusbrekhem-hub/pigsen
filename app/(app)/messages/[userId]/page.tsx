import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { isPro } from "@/lib/billing/plan";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { DmThread } from "@/components/social/DmThread";
import { ModerationNote } from "@/components/social/CommunityTabs";
import { listThread, publicUser } from "@/lib/social/dm";

export const metadata: Metadata = { title: "Переписка" };

export default async function ThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  const user = await requireUser();
  const { userId } = await params;
  if (userId === user.id) redirect("/messages");
  const other = await publicUser(userId.slice(0, 40));
  if (!other) notFound();
  const msgs = await listThread(user.id, other.id);
  return (
    <>
      <div className="dm-head">
        <Link href="/messages" className="btn btn-secondary btn-sm" aria-label="Назад"><Icon name="back" size="sm" /></Link>
        <Avatar name={other.name} src={other.avatarUrl} className="dm-av" />
        <div className="dm-head-name">
          <b>{other.name}</b>
          {other.pro && <span className="pro-badge">Pro</span>}
          {other.title && <span className="cm-title">{other.title}</span>}
        </div>
      </div>
      <DmThread otherId={other.id} initial={msgs} canStart={isPro(user.profile)} />
      <ModerationNote />
    </>
  );
}
