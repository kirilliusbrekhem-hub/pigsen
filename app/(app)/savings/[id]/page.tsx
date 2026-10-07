import { Disclaimer } from "@/components/legal/Disclaimer";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GoalCover } from "@/components/savings/GoalCover";
import { GoalImageEdit } from "@/components/savings/GoalImage";
import { Coach, GoalActions, GoalDanger, GoalNumbers } from "@/components/savings/GoalDetail";
import { SpendCheck } from "@/components/savings/SpendCheck";
import { Icon } from "@/components/ui/Icon";
import { requireUser } from "@/lib/auth/session";
import { dateRu, rub } from "@/lib/client/format";
import { getGoal, listEntries } from "@/lib/savings/service";
import { MOTIVATION } from "@/lib/savings/themes";
import { toView } from "@/lib/savings/view";

export const metadata: Metadata = { title: "Цель" };

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const goal = await getGoal(user.id, id);
  if (!goal) notFound();
  const [{ view, pacePerMonth }, entries] = await Promise.all([toView(goal), listEntries(goal.id)]);
  const quote = MOTIVATION[(goal.saved + entries.length) % MOTIVATION.length];
  return (
    <div className="stack" style={{ gap: 20 }}>
      <Link href="/savings" className="link-btn muted">
        <Icon name="back" size="sm" /> Все цели
      </Link>
      <section className="goal-hero card">
        <div className="stack" style={{ gap: 8, minWidth: 0 }}>
          <GoalCover imageUrl={view.imageUrl} theme={goal.theme} percent={view.percent} size="lg" title={goal.title} />
          <GoalImageEdit goalId={goal.id} hasImage={!!goal.image} />
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <span className="label">Цель{goal.deadline ? ` · до ${dateRu(goal.deadline)}` : ""}</span>
          <h1>{goal.title}</h1>
          {goal.why && <p className="goal-why">«{goal.why}»</p>}
          <span className="num save-total">
            {rub(goal.saved)} <span className="muted">из {rub(goal.target)}</span>
          </span>
          <div className="progress">
            <i style={{ width: `${view.percent}%` }} />
          </div>
          <GoalNumbers goal={view} pacePerMonth={pacePerMonth} />
          <p className="muted">{quote}</p>
        </div>
      </section>
      <GoalActions goal={view} />
      <Coach goalId={goal.id} />
      <SpendCheck goals={[{ id: goal.id, title: goal.title }]} defaultGoal={goal.id} />
      <section className="card card-pad stack" style={{ gap: 10 }}>
        <b>История</b>
        {entries.length === 0 ? (
          <p className="muted">Пока пусто. Первый взнос — самый важный.</p>
        ) : (
          <div className="row-list">
            {entries.map((e) => (
              <div key={e.id} className="ledger-row">
                <span className={`num ${e.amount > 0 ? "pos" : "neg"}`}>
                  {e.amount > 0 ? "+" : "−"}
                  {rub(Math.abs(e.amount))}
                </span>
                <span className="muted">{e.note || (e.amount > 0 ? "Пополнение" : "Снятие")}</span>
                <span className="muted mono" style={{ fontSize: 12 }}>
                  {dateRu(e.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      <Disclaimer kind="ai" compact />
      <GoalDanger goalId={goal.id} />
    </div>
  );
}
