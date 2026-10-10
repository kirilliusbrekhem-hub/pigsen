import { Disclaimer } from "@/components/legal/Disclaimer";
import type { Metadata } from "next";
import { SavingsHome } from "@/components/savings/SavingsHome";
import { requireUserWith } from "@/lib/auth/session";
import { ownedItems } from "@/lib/coins/service";
import { goalLimit, isPro } from "@/lib/billing/plan";
import { PushToggle } from "@/components/push/PushToggle";
import { vapidPublicKey } from "@/lib/push/config";
import { ProPromo } from "@/components/pro/ProPromo";
import { listGoals, themesFrom } from "@/lib/savings/service";
import { quoteOfTheDay } from "@/lib/savings/themes";
import { toView } from "@/lib/savings/view";
import { ProofMeter } from "@/components/savings/Proof";
import { proofMeter } from "@/lib/savings/proof";

export const metadata: Metadata = { title: "Копилка" };

export default async function SavingsPage() {
  const [user, [goals, owned, meter]] = await requireUserWith((userId) => Promise.all([listGoals(userId), ownedItems(userId), proofMeter(userId)]));
  const pro = isPro(user.profile);
  const themes = themesFrom(owned, pro);
  const views = await Promise.all(goals.map(async (g) => (await toView(g)).view));
  const quote = quoteOfTheDay();
  return (
    <>
      <section className="page-head">
        <div>
          <span className="label">Умная копилка</span>
          <h1>Копите с CAP</h1>
          <p>Ставьте цели, откладывайте понемногу и проверяйте покупки: CAP подскажет, как дойти до мечты быстрее. За взносы начисляются PigCoin$.</p>
        </div>
      </section>
      {!pro && <ProPromo place="savings" note={`На вашем плане до ${goalLimit(user.profile)} целей, у вас ${goals.length}.`} />}
      <SavingsHome goals={views} themes={[...themes]} canCreate={goals.length < goalLimit(user.profile)} quote={quote} push={<PushToggle publicKey={vapidPublicKey()} />} />
      {meter.total > 0 && (
        <section className="card card-pad">
          <ProofMeter {...meter} />
        </section>
      )}
      <Disclaimer kind="ai" compact />
    </>
  );
}
