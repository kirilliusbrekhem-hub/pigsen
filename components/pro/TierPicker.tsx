"use client";
import { useState } from "react";
import { BuyPlan } from "./ProClient";

export interface TierOption {
  tier: string;
  name: string;
  people: number;
  month: { id: string; price: string };
  year: { id: string; price: string };
}

/** Pro tier picker by «Мой бизнес» team size. Every tier is full Pro; only the team cap differs. */
export function TierPicker({ tiers, current, stars, enabled }: { tiers: TierOption[]; current: string | null; stars: boolean; enabled: boolean }) {
  const [sel, setSel] = useState(current ?? tiers[0].tier);
  const t = tiers.find((x) => x.tier === sel) ?? tiers[0];
  const same = current === t.tier;
  return (
    <div className="stack tier-picker" style={{ gap: 10 }} data-testid="tier-picker">
      <div className="row" role="radiogroup" aria-label="Размер команды" style={{ gap: 6, flexWrap: "wrap" }}>
        {tiers.map((x) => (
          <button key={x.tier} type="button" role="radio" aria-checked={sel === x.tier} className={`chip ${sel === x.tier ? "is-selected" : ""}`} onClick={() => setSel(x.tier)}>
            {x.name} · до {x.people} чел.{current === x.tier ? " · ваш" : ""}
          </button>
        ))}
      </div>
      <span className="muted" style={{ fontSize: 13 }}>
        Все возможности Pro + команда в «Моём бизнесе» до {t.people} человек (вы и {t.people - 1} друзей) и CAP.
      </span>
      <div className="plan-row">
        <div className="plan-opt">
          <b className="num">{t.month.price}</b>
          <span className="muted">{stars ? "в месяц, подписка" : "в месяц"}</span>
          <BuyPlan key={t.month.id} plan={t.month.id} label={same ? "Продлить на месяц" : current ? `Перейти на ${t.name}` : stars ? "Оформить подписку" : "Оформить на месяц"} enabled={enabled} />
        </div>
        <div className="plan-opt best">
          <span className="chip">выгоднее</span>
          <b className="num">{t.year.price}</b>
          <span className="muted">в год</span>
          <BuyPlan key={t.year.id} plan={t.year.id} label={same ? "Продлить на год" : "Оформить на год"} enabled={enabled} />
        </div>
      </div>
      {current && !same && (
        <span className="muted" style={{ fontSize: 12 }} data-testid="tier-switch-note">
          Смена тарифа: новый план начинается сразу после оплаты, дни Pro суммируются, а размер команды становится как у нового плана. Если команда больше нового лимита, все остаются, но новых участников пригласить не получится.
        </span>
      )}
    </div>
  );
}
