import type { Metadata } from "next";
import { BuyPlan, Shop } from "@/components/pro/ProClient";
import { Coin } from "@/components/ui/Coin";
import { Icon } from "@/components/ui/Icon";
import { requireUser } from "@/lib/auth/session";
import { PLANS, PRO_PERKS, isPro } from "@/lib/billing/plan";
import { paymentsEnabled, syncRecentPayments } from "@/lib/billing/yookassa";
import { starsEnabled } from "@/lib/billing/telegram";
import { dateRu } from "@/lib/client/format";
import { SHOP, ownedItems } from "@/lib/coins/service";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Pro и PigCoin$" };

const REASONS: Record<string, string> = {
  xp: "За обучение",
  deposit: "Взнос в копилку",
  resisted: "Не потратил импульсно",
  "shop:pro-3d": "Pro на 3 дня",
};
const reasonLabel = (r: string) => REASONS[r] ?? (r.startsWith("milestone:") ? "Этап цели" : r.startsWith("shop:") ? "Покупка в магазине" : r.startsWith("refund:") ? "Возврат" : "Начисление");

export default async function ProPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const user = await requireUser();
  const { paid } = await searchParams;
  const justPaid = paid === "1" && (await syncRecentPayments(user.id));
  const profile = justPaid ? await prisma.profile.findUnique({ where: { userId: user.id } }) : user.profile;
  const pro = isPro(profile);
  const [owned, txs] = await Promise.all([
    ownedItems(user.id),
    prisma.coinTx.findMany({ where: { userId: user.id, amount: { not: 0 } }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const coins = profile?.coins ?? 0;
  const stars = starsEnabled();
  const enabled = stars || paymentsEnabled();
  const price = (p: (typeof PLANS)[keyof typeof PLANS]) => (stars ? `${p.stars} ⭐` : `${p.price} ₽`);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="page-head">
        <div>
          <span className="label">PIGSEN Pro</span>
          <h1>Копите умнее с Pro</h1>
          <p>Безлимитный $PIG-коуч, разбор каждой траты и премиум-обложки. Или копите PigCoin$ за обучение и взносы и обменивайте их на Pro.</p>
        </div>
      </section>

      {justPaid && (
        <div className="card card-pad celebrate">
          <span className="celebrate-big">🎉</span>
          <b>Оплата прошла, Pro активирован!</b>
        </div>
      )}
      {paid === "1" && !justPaid && !pro && <div className="card card-pad muted">Платёж обрабатывается. Обновите страницу через минуту.</div>}

      <div className="pro-grid">
        <section className={`card card-pad stack pro-card ${pro ? "is-active" : ""}`} style={{ gap: 12 }}>
          <span className="label">{pro ? "Ваш план" : "Что даёт Pro"}</span>
          <h2>{pro ? `Pro до ${dateRu(profile!.proUntil!)}` : "Pro"}</h2>
          <ul className="perk-list">
            {PRO_PERKS.map((p) => (
              <li key={p}>
                <Icon name="check" size="sm" /> {p}
              </li>
            ))}
          </ul>
          <div className="plan-row">
            <div className="plan-opt">
              <b className="num">{price(PLANS.month)}</b>
              <span className="muted">{stars ? "в месяц, подписка" : "в месяц"}</span>
              <BuyPlan plan="month" label={pro ? "Продлить на месяц" : stars ? "Оформить подписку" : "Оформить на месяц"} enabled={enabled} />
            </div>
            <div className="plan-opt best">
              <span className="chip">−30%</span>
              <b className="num">{price(PLANS.year)}</b>
              <span className="muted">в год</span>
              <BuyPlan plan="year" label={pro ? "Продлить на год" : "Оформить на год"} enabled={enabled} />
            </div>
          </div>
          {stars && (
            <ol className="pay-steps">
              <li>Нажмите «Оформить»: откроется Telegram со счётом от бота PIGSEN.</li>
              <li>Нажмите «Оплатить». Нет звёзд? Telegram сам предложит купить их картой.</li>
              <li>Вернитесь сюда: Pro включится автоматически за пару секунд.</li>
            </ol>
          )}
          <span className="muted" style={{ fontSize: 12 }}>
            {stars ? "Оплата звёздами в Telegram: картой из любой страны или через App Store / Google Play." : "Оплата через ЮKassa."} {stars ? "Месячная подписка продлевается сама, отменить можно в Telegram: Настройки → Мои звёзды. Год оплачивается один раз." : "Без автосписаний: Pro просто заканчивается в срок."}
          </span>
        </section>

        <section className="card card-pad stack coins-card" style={{ gap: 10 }}>
          <span className="label">Ваш баланс</span>
          <b className="num coins-big">{coins} <Coin size={30} /></b>
          <p className="muted" style={{ fontSize: 13 }}>
            PigCoin$ начисляются: половина XP за уроки и квизы, +5 за взнос в копилку раз в день (в Pro +10), +25 за каждые 25% цели, +10 за отказ от импульсной покупки.
          </p>
          {txs.length > 0 && (
            <div className="row-list">
              {txs.map((t) => (
                <div key={t.id} className="ledger-row">
                  <span className={`num ${t.amount > 0 ? "pos" : "neg"}`}>
                    {t.amount > 0 ? "+" : ""}
                    {t.amount}
                  </span>
                  <span className="muted">{reasonLabel(t.reason)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="stack" style={{ gap: 12 }}>
        <div>
          <span className="label">Магазин</span>
          <h2 style={{ fontSize: 20, fontWeight: 500 }}>Потратить PigCoin$</h2>
        </div>
        <Shop coins={coins} items={SHOP.map((i) => ({ id: i.id, title: i.title, description: i.description, price: i.price, icon: i.icon, owned: !i.repeatable && owned.has(i.id), includedInPro: pro && !i.repeatable && !owned.has(i.id) }))} />
      </section>
    </div>
  );
}
