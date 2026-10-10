import type { Metadata } from "next";
import { PlansScreen } from "@/components/kapital/Plans";
import { requireUser } from "@/lib/auth/session";
import { PLANS, proTierOf } from "@/lib/billing/plan";
import { getLang } from "@/lib/kapital/lang";

export const metadata: Metadata = { title: "Тарифы" };

export default async function PlansPage() {
  const [user, lang] = await Promise.all([requireUser(), getLang()]);
  const prices = { pro: { month: PLANS.month.stars, year: PLANS.year.stars }, pro10: { month: PLANS.month10.stars, year: PLANS.year10.stars } };
  return <PlansScreen lang={lang} prices={prices} current={proTierOf(user.profile) ?? "free"} />;
}
