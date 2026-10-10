import type { Metadata } from "next";
import { CoinPacks, Shop } from "@/components/pro/ProClient";
import { TierPicker } from "@/components/pro/TierPicker";
import { Coin } from "@/components/ui/Coin";
import { Icon } from "@/components/ui/Icon";
import { requireUser } from "@/lib/auth/session";
import { COIN_PACKS, COMPARE, PLANS, PRO_PERKS, PRO_TIER_NAMES, TEAM_CAPS, isLite, isPro, proTierOf, type ProTier } from "@/lib/billing/plan";
import { paymentsEnabled, syncRecentPayments } from "@/lib/billing/yookassa";
import { starsEnabled } from "@/lib/billing/telegram";
import { dateRu } from "@/lib/client/format";
import { COINS, MAX_EXTRA_GOALS, SHOP, STYLES, TITLES, ownedItems, priceFor } from "@/lib/coins/service";
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
  "shop:boost-chat": "+10 вопросов CAP",
  "shop:streak-freeze": "Заморозка серии",
  "shop:chest-gold": "Изумрудный сундук",
  "shop:boost-chat-30": "+30 вопросов CAP",
  "shop:xp-boost": "Двойной XP",
  "shop:pro-pass": "Pro-материалы на 3 дня",
  "shop:goal-slot": "+1 цель в копилке",
  "stars:coins-300": "Покупка за звёзды",
  "stars:coins-1000": "Покупка за звёзды",
  "stars:coins-3000": "Покупка за звёзды",
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
  const price = (p: (typeof PLANS)[keyof typeof PLANS]) => (stars ? `${p.stars} ★` : `${p.price} ₽`);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="page-head">
        <div>
          <span className="label">Kapital Pro</span>
          <h1>{pro ? "Вы в Pro. Спасибо!" : "Pro: CAP без ограничений"}</h1>
          <p>
            Безлимитный чат и коуч, x2 PigCoin$ за всё, +{COINS.proDaily} монет каждый день и защита серии. Всего около {Math.round(PLANS.year.price / 365)} ₽ в день при оплате за год.
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
          <h2>{pro ? `${PRO_TIER_NAMES[proTierOf(profile) ?? "pro"]} до ${dateRu(profile!.proUntil!)}` : lite ? `Пробный Pro до ${dateRu(profile!.liteUntil!)}` : "Pro"}</h2>
          {lite && <p className="muted" style={{ fontSize: 13 }}>Пробный Pro даёт повышенные лимиты. Полный Pro снимает их совсем и удваивает PigCoin$.</p>}
          <ul className="perk-list">
            {PRO_PERKS.map((p) => (
              <li key={p}>
                <Icon name="check" size="sm" /> {p}
              </li>
            ))}
          </ul>
          <TierPicker
            tiers={(["pro", "pro7", "pro10"] as ProTier[]).map((tier) => {
              const [m, y] = [Object.values(PLANS).find((p) => p.tier === tier && p.recurring)!, Object.values(PLANS).find((p) => p.tier === tier && !p.recurring)!];
              return { tier, name: PRO_TIER_NAMES[tier], people: TEAM_CAPS[tier], month: { id: m.id, price: price(m) }, year: { id: y.id, price: price(y) } };
            })}
            current={proTierOf(profile)}
            stars={stars}
            enabled={enabled}
          />
          {stars && (
            <ol className="pay-steps">
              <li>Нажмите «Оформить»: откроется Telegram со счётом от бота Kapital.</li>
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
            PigCoin$ начисляются: 1 монета за каждые {1 / COINS.perXp} XP за уроки и квизы, ежедневный бонус до {COINS.dailyMax} за вход (растёт с серией), +{COINS.dailyDeposit} за взнос в копилку раз в день, +{COINS.milestone} за каждые 25% цели, +{COINS.resistedSpend} за отказ от импульсной покупки. В Pro монеты за обучение и взносы x2 и ещё +{COINS.proDaily} в день.
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
          items={SHOP.filter((i) => !(pro && i.notForPro)).map((i) => {
            const isTheme = i.id.startsWith("theme-");
            const price = priceFor(i, pro);
            const style = STYLES[i.id];
            const has = !i.repeatable && owned.has(i.id);
            const equipped = has && (style ? profile?.[style.field] === style.value : !!TITLES[i.id] && profile?.title === TITLES[i.id]);
            const until = (d: Date | null | undefined, what: string) => (d && d.getTime() > Date.now() ? `${what} до ${dateRu(d)}` : undefined);
            const note =
              i.id === "xp-boost" ? until(profile?.xpBoostUntil, "x2 XP активен")
              : i.id === "pro-pass" ? until(profile?.passUntil, "Открыто")
              : i.id === "goal-slot" && profile?.extraGoals ? `Куплено ${profile.extraGoals} из ${MAX_EXTRA_GOALS}`
              : i.id === "streak-freeze" && profile?.streakFreezes ? `У вас ${profile.streakFreezes} из 3`
              : undefined;
            return {
              id: i.id,
              title: i.title,
              description: i.description,
              price,
              fullPrice: price !== i.price ? i.price : undefined,
              icon: i.icon,
              category: i.category,
              hot: i.id === "pro-trial" || i.id === "chest" || i.id === "xp-boost",
              owned: has,
              equippable: has && (!!style || !!TITLES[i.id]),
              equipped,
              note,
              includedInPro: pro && isTheme && !owned.has(i.id),
            };
          })}
        />
      </section>

      <section className="stack" style={{ gap: 12 }} id="coins">
        <div>
          <span className="label">PigCoin$ за звёзды</span>
          <h2 style={{ fontSize: 20, fontWeight: 500 }}>Пополнить баланс</h2>
        </div>
        <p className="muted">
          Не хотите ждать? Купите PigCoin$ за Telegram Stars, монеты придут сразу после оплаты.{!pro && ` Если нужны лимиты и курсы, Pro на месяц (${PLANS.month.stars} ★) выгоднее, чем 1000 монет на пробный Pro.`}
        </p>
        <CoinPacks enabled={stars} packs={Object.values(COIN_PACKS).map((p) => ({ id: p.id, coins: p.coins, stars: p.stars, note: p.id === "coins-3000" ? "Выгоднее всего" : undefined }))} />
      </section>
    </div>
  );
}
