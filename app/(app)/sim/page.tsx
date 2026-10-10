import type { Metadata } from "next";
import { SimGame } from "@/components/sim/SimGame";
import { isPro } from "@/lib/billing/plan";
import { requireSimPageUser } from "@/lib/sim/gate";
import { activeRun, recentRuns, runsLeftToday } from "@/lib/sim/service";
import { PROFILES, BIZ_KINDS } from "@/lib/sim/engine";

export const metadata: Metadata = { title: "Бизнес-симулятор", robots: { index: false } };

export default async function SimPage() {
  const user = await requireSimPageUser();
  const pro = isPro(user.profile);
  const [run, recent, left] = await Promise.all([activeRun(user.id), recentRuns(user.id), runsLeftToday(user.id, pro)]);
  const kinds = BIZ_KINDS.map((k) => ({ kind: k, title: PROFILES[k].title, emoji: PROFILES[k].emoji, blurb: PROFILES[k].blurb, startCash: PROFILES[k].startCash }));
  return (
    <>
      <section className="page-head">
        <div>
          <span className="label">Бизнес-симулятор · бета</span>
          <h1>Управляйте бизнесом 12 недель</h1>
          <p>Выберите дело, принимайте решения каждую неделю и смотрите, как они бьют по кассе. CAP разберёт каждый ход.</p>
        </div>
      </section>
      <SimGame key={run?.id ?? `new-${left}`} initial={run} kinds={kinds} recent={recent} runsLeft={left} pro={pro} />
    </>
  );
}
