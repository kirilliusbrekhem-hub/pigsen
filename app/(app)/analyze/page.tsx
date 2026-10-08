import type { Metadata } from "next";
import { AnalyzeClient } from "@/components/analyze/AnalyzeClient";
import { Disclaimer } from "@/components/legal/Disclaimer";
import { isPro } from "@/lib/billing/plan";
import { requireUserWith } from "@/lib/auth/session";
import { listAnalyses } from "@/lib/analyze/service";
import { visionEnabled } from "@/lib/analyze/vision";

export const metadata: Metadata = { title: "Разбор трат" };

export default async function AnalyzePage() {
  const [user, items] = await requireUserWith((userId) => listAnalyses(userId));
  return (
    <>
      <section className="page-head">
        <div>
          <span className="label">Разбор трат</span>
          <h1>Куда уходят деньги</h1>
          <p>Загрузите выписку из банка — $PIG разложит траты по категориям, найдёт утечки и подскажет, сколько можно откладывать.</p>
        </div>
      </section>
      <AnalyzeClient
        photo={visionEnabled()}
        pro={isPro(user.profile)}
        history={items.map((i) => ({ id: i.id, source: i.source, txCount: i.txCount, total: i.total, createdAt: i.createdAt.toISOString() }))}
      />
      <Disclaimer kind="ai" compact />
    </>
  );
}
