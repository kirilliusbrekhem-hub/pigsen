import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wizard } from "@/components/bizplan/Wizard";
import { Disclaimer } from "@/components/legal/Disclaimer";
import { requireUser } from "@/lib/auth/session";
import { DEFAULT_INPUT } from "@/lib/bizplan/schema";
import { FREE_PLANS, listPlans, planPro } from "@/lib/bizplan/service";

export const metadata: Metadata = { title: "Новый бизнес-план" };

export default async function NewPlanPage() {
  const user = await requireUser();
  if (!planPro(user) && (await listPlans(user.id)).length >= FREE_PLANS) redirect("/plan");
  return (
    <div className="bp-page">
      <section className="page-head">
        <div>
          <Link href="/plan" className="label">← Мои планы</Link>
          <h1>Новый бизнес-план</h1>
          <p>Мы заполнили примерные цифры — замените их своими.</p>
        </div>
      </section>
      <Wizard initial={DEFAULT_INPUT} />
      <Disclaimer kind="ai" compact />
    </div>
  );
}
