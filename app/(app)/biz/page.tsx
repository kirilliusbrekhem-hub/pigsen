import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isPro } from "@/lib/billing/plan";
import { KINDS } from "@/lib/biz/catalog";
import { getView } from "@/lib/biz/service";
import { BizApp } from "@/components/biz/BizApp";
import { BizStart } from "@/components/biz/BizStart";
import "../../styles/biz-game.css";

export const metadata: Metadata = { title: "Мой бизнес", robots: { index: false } };

export default async function BizPage() {
  const user = await requireUser();
  const view = await getView(user);
  if (view) return <BizApp key={view.business.id} initial={view} />;
  const hasGoals = (await prisma.savingsGoal.count({ where: { userId: user.id } })) > 0;
  const kinds = Object.values(KINDS).map((k) => ({ kind: k.kind, title: k.title, blurb: k.blurb, available: k.available, levels: k.levels, template: k.template, emoji: k.emoji }));
  return <BizStart kinds={kinds} defaultName={`Кофейня ${user.name.split(" ")[0]}`.slice(0, 40)} hasGoals={hasGoals} pro={isPro(user.profile)} />;
}
