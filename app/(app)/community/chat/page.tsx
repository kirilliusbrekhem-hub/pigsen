import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { isPro } from "@/lib/billing/plan";
import { isAdmin } from "@/lib/admin/auth";
import { ProPromo } from "@/components/pro/ProPromo";
import { PremiumLock } from "@/components/pro/PremiumLock";
import { CommunityTabs, ModerationNote } from "@/components/social/CommunityTabs";
import { ChatRoom } from "@/components/social/ChatRoom";
import { listChat } from "@/lib/social/chat";
import { CHAT_ROOMS, isRoom } from "@/lib/social/meta";

export const metadata: Metadata = { title: "Чаты комьюнити" };

export default async function CommunityChatPage({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const user = await requireUser();
  const pro = isPro(user.profile);
  const { room: raw } = await searchParams;
  const room = raw && isRoom(raw) ? raw : CHAT_ROOMS[0].id;
  const [initial, admin] = pro ? await Promise.all([listChat(user.id, room), isAdmin(user)]) : [null, false];
  return (
    <>
      <section className="page-head">
        <div>
          <span className="label">Комьюнити Pro</span>
          <h1>Чаты по темам</h1>
          <p>Живое общение с теми, кто строит бизнес и копит деньги.</p>
        </div>
      </section>
      <CommunityTabs active="chat" />
      {pro ? (
        <>
          <ChatRoom key={room} room={room} initial={initial ?? []} admin={admin} />
          <ModerationNote />
        </>
      ) : (
        <div className="stack">
          <ProPromo place="community" />
          <PremiumLock what="раздел" />
        </div>
      )}
    </>
  );
}
