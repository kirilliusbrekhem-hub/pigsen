import type { PlanInput } from "./schema";

// Deterministic financial model. Every number in a plan comes from here, never from the AI.

export interface MonthRow {
  month: number;
  units: number;
  revenue: number;
  cogs: number;
  gross: number;
  fixed: number;
  marketing: number;
  team: number;
  tax: number;
  net: number;
  cash: number; // cumulative cash position, starting at -startup
}

export interface SensitivityCell {
  priceDelta: number;
  volumeDelta: number;
  yearNet: number;
  payback: number | null;
}

export interface PlanModel {
  startup: number;
  monthlyFixed: number; // rent/services + team + marketing
  margin: number; // price - unit cost
  marginPct: number;
  breakEvenUnits: number | null; // per month, null when margin <= 0
  breakEvenMonth: number | null; // first month with net > 0 (within 36)
  payback: number | null; // months until cumulative cash >= 0 (within 36)
  months: MonthRow[]; // 12 months
  year: { revenue: number; gross: number; costs: number; tax: number; net: number };
  minCash: number; // deepest cash hole: how much money the launch needs
  sensitivity: SensitivityCell[];
}

const HORIZON = 36;
const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

function simulate(input: PlanInput, priceK = 1, volumeK = 1, horizon = HORIZON): MonthRow[] {
  const price = input.price * priceK;
  const fixed = sum(input.monthly);
  const marketing = sum(input.channels);
  const team = sum(input.team);
  const tax = input.taxPct / 100;
  const g = input.sales.growthPct / 100;
  let cash = -sum(input.startup);
  const rows: MonthRow[] = [];
  for (let m = 1; m <= horizon; m++) {
    const raw = input.sales.firstMonth * Math.pow(1 + g, m - 1) * volumeK;
    const units = Math.max(0, Math.round(Math.min(raw, input.sales.capacity * volumeK)));
    const revenue = units * price;
    const cogs = units * input.unitCost;
    const gross = revenue - cogs;
    // Simplified tax: a share of the month's profit (like УСН «доходы минус расходы»), never negative.
    const pre = gross - fixed - marketing - team;
    const t = Math.max(0, pre) * tax;
    const net = pre - t;
    cash += net;
    rows.push({ month: m, units, revenue: r2(revenue), cogs: r2(cogs), gross: r2(gross), fixed, marketing, team, tax: r2(t), net: r2(net), cash: r2(cash) });
  }
  return rows;
}

const firstMonth = (rows: MonthRow[], ok: (r: MonthRow) => boolean) => rows.find(ok)?.month ?? null;

export function computeModel(input: PlanInput): PlanModel {
  const all = simulate(input);
  const months = all.slice(0, 12);
  const startup = sum(input.startup);
  const monthlyFixed = sum(input.monthly) + sum(input.channels) + sum(input.team);
  const margin = input.price - input.unitCost;
  const year = months.reduce(
    (a, r) => ({ revenue: a.revenue + r.revenue, gross: a.gross + r.gross, costs: a.costs + r.cogs + r.fixed + r.marketing + r.team, tax: a.tax + r.tax, net: a.net + r.net }),
    { revenue: 0, gross: 0, costs: 0, tax: 0, net: 0 },
  );
  const sensitivity: SensitivityCell[] = [];
  for (const p of [-0.2, 0, 0.2]) {
    for (const v of [-0.2, 0, 0.2]) {
      const rows = simulate(input, 1 + p, 1 + v);
      sensitivity.push({ priceDelta: p, volumeDelta: v, yearNet: r2(rows.slice(0, 12).reduce((s, r) => s + r.net, 0)), payback: firstMonth(rows, (r) => r.cash >= 0) });
    }
  }
  return {
    startup,
    monthlyFixed,
    margin,
    marginPct: input.price > 0 ? r2((margin / input.price) * 100) : 0,
    breakEvenUnits: margin > 0 ? Math.ceil(monthlyFixed / margin) : null,
    breakEvenMonth: firstMonth(all, (r) => r.net > 0),
    payback: startup === 0 && all[0].net >= 0 ? 0 : firstMonth(all, (r) => r.cash >= 0),
    months,
    year: { revenue: r2(year.revenue), gross: r2(year.gross), costs: r2(year.costs), tax: r2(year.tax), net: r2(year.net) },
    minCash: Math.min(-startup, ...all.slice(0, 12).map((r) => r.cash)),
    sensitivity,
  };
}
