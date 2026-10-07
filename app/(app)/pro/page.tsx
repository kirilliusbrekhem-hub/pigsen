import type { Metadata } from "next";
import { BuyPlan, Shop } from "@/components/pro/ProClient";
import { Coin } from "@/components/ui/Coin";
import { Icon } from "@/components/ui/Icon";
import { requireUser } from "@/lib/auth/session";
import { COMPARE, PLANS, PRO_PERKS, isLite, isPro } from "@/lib/billing/plan";
import { paymentsEnabled, syncRecentPayments } from "@/lib/billing/yookassa";
import { starsEnabled } from "@/lib/billing/telegram";
import { dateRu } from "@/lib/client/format";
import { SHOP, ownedItems, priceFor } from "@/lib/coins/service";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Pro и PigCoin$" };

const REASONS: Record<string, string> = {
  xp: "За обучение",
  deposit: "Взнос в копилку",
  resisted: "Не потратил импульсно",
  "shop:pro-3d": "Pro на 3 дня",
  "shop:pro-trial": "Пробный Pro",
  "shop:chest": "Сундук удачи",
  chest: "Выигрыш из сундука",
  daily: "Ежедневный бонус",
  "daily-pro": "Pro-бонус",
  "shop:boost-chat": "+10 вопросов $PIG",
  "shop:streak-freeze": "Заморозка серии",
  "referral-welcome": "Бонус за приглашение",
  referral: "Друг прошёл первый урок",
  "referral-milestone": "Бонус за 5 друзей",
  review: "Награда за отзыв",
};
const reasonLabel = (r: string) => REASONS[r] ?? (r.startsWith("milestone:") ? "Этап цели" : r.startsWith("shop:") ? "Покупка в магазине" : r.startsWith("refund:") ? "Возврат" : "Начисление");

export default async function ProPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const user = await requireUser();
  const { paid } = await searchParams;
  const justPaid = paid === "1" && (await syncRecentPayments(user.id));
  const profile = justPaid ? await prisma.profile.findUnique({ where: { userId: user.id } }) : user.profile;
  const pro = isPro(profile);
  const lite = isLite(profile);
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
          <h1>{pro ? "Вы в Pro. Спасибо!" : "Pro: $PIG без ограничений"}</h1>
          <p>
            Безлимитный чат и коуч, x2 PigCoin$ за всё, +30 монет каждый день и защита серии. Всего около {Math.round(PLANS.year.price / 365)} ₽ в день при оплате за год.
            {!pro && " Нет денег сейчас? Накопите 1000 PigCoin$ и возьмите пробный Pro на 7 дней."}
          </p>
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
          <h2>{pro ? `Pro до ${dateRu(profile!.proUntil!)}` : lite ? `Пробный Pro до ${dateRu(profile!.liteUntil!)}` : "Pro"}</h2>
          {lite && <p className="muted" style={{ fontSize: 13 }}>Пробный Pro даёт повышенные лимиты. Полный Pro снимает их совсем и удваивает PigCoin$.</p>}
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
            Оформляя Pro, вы принимаете <a href="/offer">условия оплаты и возвратов</a>. PigCoin$ — бонусные баллы без денежной стоимости, см. <a href="/rules">правила</a>.{" "}
            {stars ? "Оплата звёздами в Telegram: картой из любой страны или через App Store / Google Play." : "Оплата через ЮKassa."} {stars ? "Месячная подписка продлевается сама, отменить можно в Telegram: Настройки → Мои звёзды. Год оплачивается один раз." : "Без автосписаний: Pro просто заканчивается в срок."}
          </span>
        </section>

        <section className="card card-pad stack coins-card" style={{ gap: 10 }}>
          <span className="label">Ваш баланс</span>
          <b className="num coins-big">{coins} <Coin size={30} /></b>
          <p className="muted" style={{ fontSize: 13 }}>
            PigCoin$ начисляются: 1 монета за каждый XP за уроки и квизы, ежедневный бонус до 30 за вход (растёт с серией), +15 за взнос в копилку раз в день, +50 за каждые 25% цели, +20 за отказ от импульсной покупки. В Pro всё x2 и ещё +30 в день.
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

      <section className="card card-pad stack" style={{ gap: 12 }}>
        <div>
          <span className="label">Сравнение</span>
          <h2 style={{ fontSize: 20, fontWeight: 500 }}>Free, пробный Pro и Pro</h2>
        </div>
        <div className="compare-wrap">
          <table className="compare" data-testid="compare">
            <thead>
              <tr>
                <th></th>
                <th>Free</th>
                <th>Пробный (1000 <Coin size={12} />)</th>
                <th className="col-pro">Pro</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{r.free}</td>
                  <td>{r.lite}</td>
                  <td className="col-pro">{r.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <div>
          <span className="label">Магазин</span>
          <h2 style={{ fontSize: 20, fontWeight: 500 }}>Потратить PigCoin$</h2>
        </div>
        {pro ? <p className="muted">Скидка Pro 50% уже учтена в ценах.</p> : <p className="muted">В Pro многие товары в 2 раза дешевле.</p>}
        <Shop
          coins={coins}
          items={SHOP.filter((i) => !(pro && i.id === "pro-trial")).map((i) => {
            const isTheme = i.id.startsWith("theme-");
            const price = priceFor(i, pro);
            return {
              id: i.id,
              title: i.title,
              description: i.description,
              price,
              fullPrice: price !== i.price ? i.price : undefined,
              icon: i.icon,
              hot: i.id === "pro-trial" || i.id === "chest",
              owned: !i.repeatable && owned.has(i.id),
              includedInPro: pro && isTheme && !owned.has(i.id),
            };
          })}
        />
      </section>
    </div>
  );
}
