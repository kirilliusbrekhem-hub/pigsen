import type { Metadata } from "next";
import { SavingsHome } from "@/components/savings/SavingsHome";
import { requireUser } from "@/lib/auth/session";
import { isPro, limitsFor } from "@/lib/billing/plan";
import { ProPromo } from "@/components/pro/ProPromo";
import { availableThemes, listGoals } from "@/lib/savings/service";
import { quoteOfTheDay } from "@/lib/savings/themes";
import { toView } from "@/lib/savings/view";

export const metadata: Metadata = { title: "Копилка" };

export default async function SavingsPage() {
  const user = await requireUser();
  const pro = isPro(user.profile);
  const [goals, themes] = await Promise.all([listGoals(user.id), availableThemes(user.id, pro)]);
  const views = await Promise.all(goals.map(async (g) => (await toView(g)).view));
  const quote = quoteOfTheDay();
  return (
    <>
      <section className="page-head">
        <div>
          <span className="label">Умная копилка</span>
          <h1>Копите с $PIG</h1>
          <p>Ставьте цели, откладывайте понемногу и проверяйте покупки: $PIG подскажет, как дойти до мечты быстрее. За взносы начисляются PigCoin$.</p>
        </div>
      </section>
      {!pro && <ProPromo place="savings" note={`На вашем плане до ${limitsFor(user.profile).goals} целей, у вас ${goals.length}.`} />}
      <SavingsHome goals={views} themes={[...themes]} canCreate={goals.length < limitsFor(user.profile).goals} quote={quote} />
    </>
  );
}
