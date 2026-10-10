import type { Metadata } from "next";
import Link from "next/link";
import { Disclaimer } from "@/components/legal/Disclaimer";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/States";
import { requireUser } from "@/lib/auth/session";
import { FREE_PLANS, listPlans, planPro } from "@/lib/bizplan/service";
import { dateRu } from "@/lib/client/format";

export const metadata: Metadata = { title: "Бизнес-план за 10 минут" };

export default async function PlansPage() {
  const user = await requireUser();
  const plans = await listPlans(user.id);
  const pro = planPro(user);
  const canCreate = pro || plans.length < FREE_PLANS;
  return (
    <div className="bp-page">
      <section className="page-head">
        <div>
          <span className="label">Инструменты</span>
          <h1>Бизнес-план за 10 минут</h1>
          <p>Ответьте на 10 вопросов: финмодель посчитается сама, а $PIG напишет резюме, маркетинг и разбор рисков. В конце — PDF.</p>
        </div>
        {canCreate ? (
          <Link className="btn btn-primary" href="/plan/new" data-testid="bp-new">
            <Icon name="plus" size="sm" /> Новый план
          </Link>
        ) : (
          <Link className="btn btn-secondary" href="/pro" data-testid="bp-upgrade">
            <Icon name="crown" size="sm" /> Pro: безлимит планов
          </Link>
        )}
      </section>
      {!pro && <p className="bp-note">На Free — {FREE_PLANS} план и PDF с водяным знаком. В Pro — сколько угодно планов и чистый PDF.</p>}
      {plans.length === 0 ? (
        <EmptyState icon="briefcase" title="Планов пока нет" text="Начните с идеи — остальное подскажем по шагам." action={<Link className="btn btn-primary" href="/plan/new">Составить план</Link>} />
      ) : (
        <ul className="bp-plans" data-testid="bp-list">
          {plans.map((p) => (
            <li key={p.id}>
              <Link href={`/plan/${p.id}`} className="card clickable">
                <Icon name="briefcase" />
                <span>
                  <b>{p.title}</b>
                  <small>Обновлён {dateRu(p.updatedAt)}</small>
                </span>
                <Icon name="chevR" size="sm" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Disclaimer kind="general" compact />
    </div>
  );
}
