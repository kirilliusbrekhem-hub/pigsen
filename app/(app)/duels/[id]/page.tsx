import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { DuelRoom } from "@/components/duels/DuelRoom";

export const metadata: Metadata = { title: "Дуэль" };

export default async function DuelPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const p = await prisma.duelPlayer.findUnique({ where: { duelId_userId: { duelId: id.slice(0, 40), userId: user.id } }, select: { id: true } });
  if (!p) notFound();
  return <DuelRoom id={id} />;
}
