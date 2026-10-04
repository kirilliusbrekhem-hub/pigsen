"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";

const rub = (n: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Math.round(n));
const num = (n: number, d = 1) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: d }).format(n);

function Field({ label, value, onChange, suffix, step = 1, max }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number; max?: number }) {
  return (
    <label className="calc-field">
      <span>{label}</span>
      <span className="calc-input">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(Number.isFinite(v) ? Math.max(0, max !== undefined ? Math.min(v, max) : v) : 0);
          }}
        />
        {suffix && <i>{suffix}</i>}
      </span>
    </label>
  );
}

function AskPig({ q }: { q: string }) {
  return (
    <Link className="btn btn-secondary" href={`/ai?q=${encodeURIComponent(q)}`}>
      <Icon name="sparkle" size="sm" /> Разобрать с $PIG
    </Link>
  );
}

export function CompoundCalc() {
  const [start, setStart] = useState(100_000);
  const [monthly, setMonthly] = useState(10_000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);

  const r = useMemo(() => {
    const yrs = Math.min(Math.round(years), 50);
    let bal = start;
    let paid = start;
    const series: Array<{ year: number; paid: number; total: number }> = [];
    for (let m = 1; m <= yrs * 12; m++) {
      bal = bal * (1 + rate / 100 / 12) + monthly;
      paid += monthly;
      if (m % 12 === 0) series.push({ year: m / 12, paid, total: bal });
    }
    return { total: bal, paid, interest: bal - paid, series };
  }, [start, monthly, rate, years]);

  const peak = Math.max(1, ...r.series.map((s) => s.total));
  return (
    <div className="calc">
      <div className="calc-form">
        <Field label="Стартовая сумма" value={start} onChange={setStart} suffix="₽" step={10_000} />
        <Field label="Пополнение в месяц" value={monthly} onChange={setMonthly} suffix="₽" step={1_000} />
        <Field label="Доходность в год" value={rate} onChange={setRate} suffix="%" step={0.5} max={100} />
        <Field label="Срок" value={years} onChange={setYears} suffix="лет" max={50} />
      </div>
      <div className="calc-out">
        <div className="calc-kpis">
          <div>
            <span className="label">Итог</span>
            <b className="num">{rub(r.total)}</b>
          </div>
          <div>
            <span className="label">Вложено</span>
            <b className="num">{rub(r.paid)}</b>
          </div>
          <div>
            <span className="label">Доход от процентов</span>
            <b className="num pos">{rub(r.interest)}</b>
          </div>
        </div>
        {r.series.length > 0 && (
          <div className="calc-bars" role="img" aria-label="Рост капитала по годам">
            {r.series.map((s) => (
              <div key={s.year} className="calc-bar" title={`Год ${s.year}: ${rub(s.total)}`}>
                <span className="t" style={{ height: `${(s.total / peak) * 100}%` }}>
                  <span className="p" style={{ height: `${(s.paid / s.total) * 100}%` }} />
                </span>
                <i>{s.year}</i>
              </div>
            ))}
          </div>
        )}
        <div className="calc-legend muted">
          <span>
            <i className="sw p" /> Ваши взносы
          </span>
          <span>
            <i className="sw t" /> Доход от процентов
          </span>
        </div>
        <p className="muted calc-note">Расчёт с ежемесячной капитализацией, без налогов и комиссий. Реальная доходность не гарантирована.</p>
        <AskPig q={`Я посчитал сложный процент: старт ${rub(start)}, пополнение ${rub(monthly)} в месяц, ${num(rate)}% годовых, ${years} лет. Итог ${rub(r.total)}, из них доход ${rub(r.interest)}. Объясни результат и что реально влияет на такую доходность.`} />
      </div>
    </div>
  );
}

export function UnitCalc() {
  const [price, setPrice] = useState(990);
  const [cogs, setCogs] = useState(20);
  const [cac, setCac] = useState(3000);
  const [churn, setChurn] = useState(5);

  const margin = price * (1 - cogs / 100);
  const lifetime = churn > 0 ? 100 / churn : Infinity;
  const ltv = Number.isFinite(lifetime) ? margin * lifetime : Infinity;
  const ratio = cac > 0 ? ltv / cac : Infinity;
  const payback = margin > 0 ? cac / margin : Infinity;
  const tone = ratio >= 3 ? "pos" : ratio >= 1 ? "warn" : "neg";
  const verdict =
    ratio >= 3
      ? "Здоровая юнит-экономика: клиент окупается с запасом, можно вкладываться в рост."
      : ratio >= 1
        ? "Клиент окупается, но запас маленький. Снижайте CAC или отток, либо поднимайте цену."
        : "Каждый новый клиент приносит убыток. Масштабировать рекламу сейчас опасно.";
  const fmt = (n: number, f: (x: number) => string) => (Number.isFinite(n) ? f(n) : "∞");

  return (
    <div className="calc">
      <div className="calc-form">
        <Field label="Цена в месяц (чек)" value={price} onChange={setPrice} suffix="₽" step={10} />
        <Field label="Себестоимость" value={cogs} onChange={setCogs} suffix="%" max={100} />
        <Field label="Стоимость привлечения (CAC)" value={cac} onChange={setCac} suffix="₽" step={100} />
        <Field label="Отток клиентов в месяц" value={churn} onChange={setChurn} suffix="%" step={0.5} max={100} />
      </div>
      <div className="calc-out">
        <div className="calc-kpis">
          <div>
            <span className="label">Маржа с клиента в месяц</span>
            <b className="num">{rub(margin)}</b>
          </div>
          <div>
            <span className="label">LTV</span>
            <b className="num">{fmt(ltv, rub)}</b>
          </div>
          <div>
            <span className="label">LTV / CAC</span>
            <b className={`num ${tone}`}>{fmt(ratio, (x) => `${num(x)}×`)}</b>
          </div>
          <div>
            <span className="label">Окупаемость CAC</span>
            <b className="num">{fmt(payback, (x) => `${num(x)} мес.`)}</b>
          </div>
        </div>
        <div className={`calc-verdict ${tone}`}>
          <Icon name={tone === "pos" ? "check" : "alert"} size="sm" /> {verdict}
        </div>
        <p className="muted calc-note">Клиент в среднем остаётся {fmt(lifetime, (x) => `${num(x)} мес.`)}. Ориентир для подписочных сервисов: LTV/CAC от 3× и окупаемость до 12 месяцев.</p>
        <AskPig q={`Моя юнит-экономика: чек ${rub(price)} в месяц, себестоимость ${num(cogs)}%, CAC ${rub(cac)}, отток ${num(churn)}% в месяц. LTV ${fmt(ltv, rub)}, LTV/CAC ${fmt(ratio, (x) => num(x))}. Что улучшить в первую очередь?`} />
      </div>
    </div>
  );
}

export function GoalCalc() {
  const [goal, setGoal] = useState(1_000_000);
  const [current, setCurrent] = useState(100_000);
  const [monthly, setMonthly] = useState(20_000);
  const [rate, setRate] = useState(10);

  const r = useMemo(() => {
    let bal = current;
    let months = 0;
    while (bal < goal && months < 600) {
      bal = bal * (1 + rate / 100 / 12) + monthly;
      months++;
    }
    return { months, reached: bal >= goal, paid: current + monthly * months };
  }, [goal, current, monthly, rate]);

  const y = Math.floor(r.months / 12);
  const m = r.months % 12;
  const when = r.months === 0 ? "Цель уже достигнута" : !r.reached ? "Больше 50 лет" : [y && `${y} ${y % 10 === 1 && y % 100 !== 11 ? "год" : y % 10 >= 2 && y % 10 <= 4 && (y % 100 < 12 || y % 100 > 14) ? "года" : "лет"}`, m && `${m} мес.`].filter(Boolean).join(" ");
  const date = new Date();
  date.setMonth(date.getMonth() + r.months);

  return (
    <div className="calc">
      <div className="calc-form">
        <Field label="Цель" value={goal} onChange={setGoal} suffix="₽" step={50_000} />
        <Field label="Уже накоплено" value={current} onChange={setCurrent} suffix="₽" step={10_000} />
        <Field label="Откладываю в месяц" value={monthly} onChange={setMonthly} suffix="₽" step={1_000} />
        <Field label="Доходность в год" value={rate} onChange={setRate} suffix="%" step={0.5} max={100} />
      </div>
      <div className="calc-out">
        <div className="calc-kpis">
          <div>
            <span className="label">Срок до цели</span>
            <b className="num">{when}</b>
          </div>
          {r.reached && r.months > 0 && (
            <div>
              <span className="label">Примерно к</span>
              <b className="num">{date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</b>
            </div>
          )}
          <div>
            <span className="label">Из своих денег</span>
            <b className="num">{rub(Math.min(r.paid, Math.max(goal, current)))}</b>
          </div>
        </div>
        <div className="progress" style={{ height: 10 }} aria-label="Уже накоплено от цели">
          <i style={{ width: `${Math.min(100, goal ? (current / goal) * 100 : 100)}%` }} />
        </div>
        <p className="muted calc-note">Уже накоплено {num(goal ? Math.min(100, (current / goal) * 100) : 100, 0)}% от цели. Доходность взята как средняя, в реальности она колеблется.</p>
        <AskPig q={`Хочу накопить ${rub(goal)}. Уже есть ${rub(current)}, откладываю ${rub(monthly)} в месяц под ${num(rate)}% годовых. По расчёту это ${when}. Как дойти до цели быстрее?`} />
      </div>
    </div>
  );
}
