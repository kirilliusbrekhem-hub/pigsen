import { Disclaimer } from "@/components/legal/Disclaimer";
import type { Metadata } from "next";
import { CompoundCalc, GoalCalc, UnitCalc } from "@/components/tools/Calculators";
import { IdeaReview } from "@/components/tools/IdeaReview";
import { ToolsTabs } from "@/components/tools/ToolsTabs";
import { requireUser } from "@/lib/auth/session";
import { isPro } from "@/lib/billing/plan";
import { ProPromo } from "@/components/pro/ProPromo";
import { listIdeaReviews } from "@/lib/ai/idea";

export const metadata: Metadata = { title: "Инструменты" };

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { tab } = await searchParams;
  const history = await listIdeaReviews(user.id);
  return (
    <>
      <section className="page-head">
        <div>
          <span className="label">Инструменты</span>
          <h1>Посчитать и проверить</h1>
          <p>Калькуляторы для денег и бизнеса и разбор идеи от CAP. Любой результат можно обсудить с CAP.</p>
        </div>
      </section>
      {!isPro(user.profile) && <ProPromo place="tools" />}
      <ToolsTabs
        key={tab ?? "default"}
        initial={tab}
        tabs={[
          { id: "idea", label: "Разбор идеи", icon: "rocket", desc: "Оценка и первые шаги", node: <IdeaReview history={history} /> },
          { id: "compound", label: "Сложный процент", icon: "trendUp", desc: "Как растут вложения", node: <CompoundCalc /> },
          { id: "unit", label: "Юнит-экономика", icon: "chart", desc: "LTV, CAC, окупаемость", node: <UnitCalc /> },
          { id: "goal", label: "Цель накоплений", icon: "piggy", desc: "Когда наберётся сумма", node: <GoalCalc /> },
        ]}
      />
      <Disclaimer kind="ai" compact />
    </>
  );
}
