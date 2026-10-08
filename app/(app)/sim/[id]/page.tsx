import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SimGame } from "@/components/sim/SimGame";
import { isPro } from "@/lib/billing/plan";
import { requireSimPageUser } from "@/lib/sim/gate";
import { getRun } from "@/lib/sim/service";

export const metadata: Metadata = { title: "Бизнес-симулятор", robots: { index: false } };

export default async function SimRunPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSimPageUser();
  const { id } = await params;
  const run = /^[a-z0-9]{10,40}$/i.test(id) ? await getRun(user.id, id) : null;
  if (!run) notFound();
  return (
    <>
      <section className="page-head">
        <div>
          <Link href="/sim" className="label">← Бизнес-симулятор</Link>
          <h1>{run.emoji} {run.title}</h1>
        </div>
      </section>
      <SimGame initial={run} kinds={[]} recent={[]} runsLeft={null} pro={isPro(user.profile)} />
    </>
  );
}
