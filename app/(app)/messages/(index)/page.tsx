import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DmList } from "@/components/social/DmList";
import { ModerationNote } from "@/components/social/CommunityTabs";
import { listConversations } from "@/lib/social/dm";

export const metadata: Metadata = { title: "Сообщения" };

export default async function MessagesPage() {
  const user = await requireUser();
  return (
    <>
      <section className="page-head">
        <div>
          <span className="label">Личные сообщения</span>
          <h1>Сообщения</h1>
          <p>Переписка с участниками комьюнити.</p>
        </div>
      </section>
      <DmList initial={await listConversations(user.id)} />
      <ModerationNote />
    </>
  );
}
