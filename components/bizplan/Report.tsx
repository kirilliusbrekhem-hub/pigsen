import { rub } from "@/lib/client/format";
import type { PlanModel } from "@/lib/bizplan/model";
import type { PlanView } from "@/lib/bizplan/service";

const mon = (n: number | null) => (n === null ? "> 3 лет" : `${n} мес.`);
const short = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)} млн` : Math.abs(n) >= 1e3 ? `${Math.round(n / 1e3)} тыс` : String(Math.round(n)));

/** Revenue and net profit bars per month, with the cumulative cash line. Brand colors only. */
function MonthsChart({ m }: { m: PlanModel }) {
  const W = 640, H = 240, P = 36;
  const max = Math.max(1, ...m.months.map((r) => Math.max(r.revenue, Math.abs(r.net), Math.abs(r.cash))));
  const zero = P + (H - 2 * P) / 2;
  const sc = (H - 2 * P) / 2 / max;
  const slot = (W - P - 8) / 12;
  const pts = m.months.map((r, i) => `${P + i * slot + slot / 2},${zero - r.cash * sc}`).join(" ");
  return (
    <svg className="bp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Выручка, прибыль и деньги по месяцам">
      <line x1={P} x2={W - 8} y1={zero} y2={zero} className="ax" />
      <text x={P - 6} y={P} className="tk" textAnchor="end">{short(max)}</text>
      <text x={P - 6} y={zero + 4} className="tk" textAnchor="end">0</text>
      <text x={P - 6} y={H - P} className="tk" textAnchor="end">{short(-max)}</text>
      {m.months.map((r, i) => {
        const x = P + i * slot + 3;
        const bw = slot / 2 - 4;
        return (
          <g key={r.month}>
            <rect x={x} y={zero - r.revenue * sc} width={bw} height={Math.max(1, r.revenue * sc)} rx={2} className="rev">
              <title>{`Месяц ${r.month}: выручка ${rub(r.revenue)}`}</title>
            </rect>
            <rect x={x + bw + 2} y={r.net >= 0 ? zero - r.net * sc : zero} width={bw} height={Math.max(1, Math.abs(r.net) * sc)} rx={2} className={r.net >= 0 ? "net" : "loss"}>
              <title>{`Месяц ${r.month}: прибыль ${rub(r.net)}`}</title>
            </rect>
            <text x={P + i * slot + slot / 2} y={H - 10} className="tk" textAnchor="middle">{r.month}</text>
          </g>
        );
      })}
      <polyline points={pts} className="cash" />
    </svg>
  );
}

function Sensitivity({ m }: { m: PlanModel }) {
  const d = [-0.2, 0, 0.2];
  const lbl = (x: number) => (x === 0 ? "план" : x < 0 ? "−20%" : "+20%");
  return (
    <div className="bp-table-wrap">
      <table className="bp-table bp-sens" data-testid="bp-sensitivity">
        <thead>
          <tr>
            <th>Цена ↓ / продажи →</th>
            {d.map((v) => <th key={v}>{lbl(v)}</th>)}
          </tr>
        </thead>
        <tbody>
          {d.map((p) => (
            <tr key={p}>
              <th>{lbl(p)}</th>
              {d.map((v) => {
                const c = m.sensitivity.find((x) => x.priceDelta === p && x.volumeDelta === v)!;
                return (
                  <td key={v} className={`${c.yearNet < 0 ? "neg" : "pos"} ${p === 0 && v === 0 ? "is-base" : ""}`}>
                    <b>{rub(c.yearNet)}</b>
                    <small>окупаемость {mon(c.payback)}</small>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Report({ plan }: { plan: PlanView }) {
  const { model: m, input, sections: s } = plan;
  return (
    <div className="bp-report">
      <div className="bp-kpis" data-testid="bp-kpis">
        <div><span>Стартовые вложения</span><b>{rub(m.startup)}</b></div>
        <div><span>Окупаемость</span><b data-testid="bp-payback">{mon(m.payback)}</b></div>
        <div><span>Безубыточность</span><b>{m.breakEvenUnits === null ? "недостижима" : `${m.breakEvenUnits} продаж/мес`}</b></div>
        <div className={m.year.net < 0 ? "neg" : ""}><span>Прибыль за 1-й год</span><b>{rub(m.year.net)}</b></div>
      </div>
      {m.minCash < -m.startup && <p className="bp-note">Кроме стартовых вложений нужен запас на первые убыточные месяцы: всего проекту потребуется до <b>{rub(-m.minCash)}</b>.</p>}

      <section className="card bp-sec"><h2>Резюме</h2><p>{s.summary}</p></section>
      <section className="card bp-sec"><h2>Рынок и конкуренты</h2><p>{s.market}</p>
        {input.competitors.length > 0 && (
          <div className="bp-table-wrap"><table className="bp-table"><thead><tr><th>Конкурент</th><th>Цена</th><th>Комментарий</th></tr></thead>
            <tbody>{input.competitors.map((c, i) => <tr key={i}><td>{c.name}</td><td>{rub(c.price)}</td><td>{c.note}</td></tr>)}</tbody></table></div>
        )}
      </section>
      <section className="card bp-sec"><h2>Маркетинг</h2><p>{s.marketing}</p></section>

      <section className="card bp-sec">
        <h2>Финансы: первые 12 месяцев</h2>
        <p className="muted">Цена {rub(input.price)}, себестоимость {rub(input.unitCost)}, маржа {m.marginPct}%. Постоянные расходы {rub(m.monthlyFixed)} в месяц.</p>
        <MonthsChart m={m} />
        <div className="bp-legend"><span className="rev">Выручка</span><span className="net">Прибыль</span><span className="loss">Убыток</span><span className="cash">Деньги нарастающим итогом</span></div>
        <div className="bp-table-wrap">
          <table className="bp-table" data-testid="bp-pnl">
            <thead><tr><th>Мес.</th><th>Продажи</th><th>Выручка</th><th>Себест.</th><th>Пост. расходы</th><th>Налог</th><th>Прибыль</th><th>Деньги</th></tr></thead>
            <tbody>
              {m.months.map((r) => (
                <tr key={r.month}><td>{r.month}</td><td>{r.units}</td><td>{rub(r.revenue)}</td><td>{rub(r.cogs)}</td><td>{rub(r.fixed + r.marketing + r.team)}</td><td>{rub(r.tax)}</td><td className={r.net < 0 ? "neg" : ""}>{rub(r.net)}</td><td className={r.cash < 0 ? "neg" : ""}>{rub(r.cash)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><th>Год</th><th /><th>{rub(m.year.revenue)}</th><th colSpan={2}>{rub(m.year.costs)}</th><th>{rub(m.year.tax)}</th><th>{rub(m.year.net)}</th><th /></tr></tfoot>
          </table>
        </div>
      </section>

      <section className="card bp-sec"><h2>Что если цена или продажи изменятся на 20%</h2><p className="muted">Прибыль за первый год и срок окупаемости при разных сценариях.</p><Sensitivity m={m} /></section>

      <section className="card bp-sec">
        <h2>Риски и как их снизить</h2>
        <ol className="bp-risks">{s.risks.map((r, i) => <li key={i}><b>{r.risk}</b><span>{r.mitigation}</span></li>)}</ol>
      </section>
    </div>
  );
}
