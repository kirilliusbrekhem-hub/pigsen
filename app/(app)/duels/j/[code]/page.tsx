import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { inviteInfo } from "@/lib/duels/service";
import { DuelJoin } from "@/components/duels/DuelJoin";

export const metadata: Metadata = { title: "Вызов на дуэль" };

export default async function DuelInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const { code } = await params;
  const info = await inviteInfo(code.slice(0, 32));
  if (!info) notFound();
  if (info.players.includes(user.id)) redirect(`/duels/${info.id}`);
  return <DuelJoin code={code} creator={info.creatorName} stake={info.stake} open={info.open} />;
}
