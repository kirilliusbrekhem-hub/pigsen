import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { inviteInfo } from "@/lib/biz/service";
import { BizJoin } from "@/components/biz/BizJoin";

export const metadata: Metadata = { title: "Приглашение в бизнес", robots: { index: false } };

export default async function BizJoinPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const { code } = await params;
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(code)) notFound();
  const info = await inviteInfo(code);
  if (!info) notFound();
  if (info.memberIds.includes(user.id)) redirect("/biz");
  return <BizJoin code={code} name={info.name} kindTitle={info.kindTitle} founder={info.founder} members={info.members} full={info.full} />;
}
