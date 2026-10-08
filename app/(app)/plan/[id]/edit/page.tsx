import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wizard } from "@/components/bizplan/Wizard";
import { Disclaimer } from "@/components/legal/Disclaimer";
import { requireUser } from "@/lib/auth/session";
import { getPlan } from "@/lib/bizplan/service";

export const metadata: Metadata = { title: "Изменить бизнес-план", robots: { index: false } };

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const plan = /^[a-z0-9]{1,40}$/i.test(id) ? await getPlan(user.id, id) : null;
  if (!plan) notFound();
  return (
    <div className="bp-page">
      <section className="page-head">
        <div>
          <Link href={`/plan/${plan.id}`} className="label">← К плану</Link>
          <h1>{plan.title}</h1>
          <p>Измените ответы — модель пересчитается, $PIG перепишет тексты.</p>
        </div>
      </section>
      <Wizard initial={plan.input} planId={plan.id} />
      <Disclaimer kind="ai" compact />
    </div>
  );
}
