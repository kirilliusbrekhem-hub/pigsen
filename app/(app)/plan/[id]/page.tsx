import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanActions } from "@/components/bizplan/PlanActions";
import { Report } from "@/components/bizplan/Report";
import { Disclaimer } from "@/components/legal/Disclaimer";
import { requireUser } from "@/lib/auth/session";
import { getPlan, planPro } from "@/lib/bizplan/service";

export const metadata: Metadata = { title: "Бизнес-план", robots: { index: false } };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const plan = /^[a-z0-9]{1,40}$/i.test(id) ? await getPlan(user.id, id) : null;
  if (!plan) notFound();
  return (
    <div className="bp-page">
      <section className="page-head">
        <div>
          <Link href="/plan" className="label">← Мои планы</Link>
          <h1 data-testid="bp-title">{plan.title}</h1>
          {plan.demo && <p>Тексты собраны по шаблону: ИИ сейчас недоступен. Цифры посчитаны моделью и от ИИ не зависят.</p>}
        </div>
        <PlanActions id={plan.id} pro={planPro(user)} />
      </section>
      <Report plan={plan} />
      <Disclaimer kind="general" />
      <Disclaimer kind="ai" compact />
    </div>
  );
}
