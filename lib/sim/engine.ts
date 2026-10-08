// Business simulator engine: pure, deterministic functions (no I/O, no Date, no Math.random).
// The same seed and decisions always give the same outcome, so the server is the only source of truth
// and every rule can be unit-tested (see lib/sim/engine.test.ts).

export const SIM_WEEKS = 12;
export const BIZ_KINDS = ["coffee", "shop", "barber"] as const;
export type BizKind = (typeof BIZ_KINDS)[number];

export interface BizProfile {
  kind: BizKind;
  title: string;
  emoji: string;
  blurb: string;
  unit: string;
  startCash: number;
  basePrice: number;
  unitCost: number;
  baseDemand: number;
  capPerStaff: number;
  wage: number;
  rent: number;
  elasticity: number;
  adUnit: number;
  adPower: number;
  stockLot: number;
  startStock: number;
  startStaff: number;
}

export const PROFILES: Record<BizKind, BizProfile> = {
  coffee: {
    kind: "coffee", title: "Кофейня", emoji: "☕", blurb: "Много чеков по 250 ₽, важны запасы зерна и скорость бариста.", unit: "чашек",
    startCash: 200_000, basePrice: 250, unitCost: 110, baseDemand: 800, capPerStaff: 450, wage: 25_000, rent: 45_000,
    elasticity: 1.4, adUnit: 8_000, adPower: 0.16, stockLot: 800, startStock: 900, startStaff: 2,
  },
  shop: {
    kind: "shop", title: "Интернет-магазин", emoji: "📦", blurb: "Дорогой товар, реклама решает всё, склад замораживает деньги.", unit: "заказов",
    startCash: 300_000, basePrice: 2_500, unitCost: 1_600, baseDemand: 90, capPerStaff: 100, wage: 25_000, rent: 20_000,
    elasticity: 1.8, adUnit: 15_000, adPower: 0.26, stockLot: 90, startStock: 120, startStaff: 1,
  },
  barber: {
    kind: "barber", title: "Барбершоп", emoji: "✂️", blurb: "Выручку ограничивают кресла и мастера, рейтинг приводит клиентов.", unit: "стрижек",
    startCash: 250_000, basePrice: 1_200, unitCost: 150, baseDemand: 140, capPerStaff: 55, wage: 30_000, rent: 40_000,
    elasticity: 1.0, adUnit: 6_000, adPower: 0.12, stockLot: 150, startStock: 200, startStaff: 3,
  },
};

export interface SimState {
  kind: BizKind;
  week: number; // weeks already played
  cash: number;
  price: number;
  staff: number;
  stock: number;
  rating: number;
  loan: number;
  status: "active" | "finished" | "bankrupt";
  lastRevenue: number;
  lastCosts: number;
  lastCustomers: number;
}

export interface SimEvent {
  id: string;
  title: string;
  text: string;
  demandMul: number;
  cost: number;
  ratingDelta: number;
  stockLossPct: number;
}

export type PriceMove = "down" | "keep" | "up";
export type DecisionKey = "price" | "ad" | "stock" | "staff" | "loan";

export interface Decisions {
  price: PriceMove;
  ad: 0 | 1 | 2;
  stock: 0 | 1 | 2;
  staff: -1 | 0 | 1;
  loan: "none" | "take" | "repay";
}

export const DEFAULT_DECISIONS: Decisions = { price: "keep", ad: 0, stock: 0, staff: 0, loan: "none" };

export interface DecisionOption {
  value: string | number;
  label: string;
  hint: string;
}

export interface DecisionSpec {
  key: DecisionKey;
  title: string;
  options: DecisionOption[];
}

export interface TurnView {
  week: number; // the week about to be played, 1-based
  event: SimEvent;
  decisions: DecisionSpec[];
}

export interface WeekReport {
  week: number;
  event: SimEvent;
  decisions: Decisions;
  price: number;
  demand: number;
  sold: number;
  lost: number;
  revenue: number;
  costs: { rent: number; wages: number; ads: number; stock: number; interest: number; event: number; severance: number };
  totalCosts: number;
  profit: number;
  cash: number;
  rating: number;
  ratingDelta: number;
  stock: number;
  staff: number;
  loan: number;
  loanChange: number;
}

// ---------- RNG ----------

/** mulberry32: tiny, fast, deterministic. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Independent stream per (seed, week, purpose), so reordering calls never changes results. */
const streamFor = (seed: number, week: number, salt: number) => rng((seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) >>> 0);

// ---------- Events ----------

const EVENTS: Omit<SimEvent, "id">[] = [
  { title: "Спокойная неделя", text: "Никаких сюрпризов: всё зависит только от ваших решений.", demandMul: 1, cost: 0, ratingDelta: 0, stockLossPct: 0 },
  { title: "Блогер написал о вас", text: "Пост разошёлся по городу: спрос заметно выше обычного.", demandMul: 1.35, cost: 0, ratingDelta: 0.1, stockLossPct: 0 },
  { title: "Конкурент открылся рядом", text: "Часть клиентов уходит посмотреть на новинку.", demandMul: 0.8, cost: 0, ratingDelta: 0, stockLossPct: 0 },
  { title: "Сломалось оборудование", text: "Срочный ремонт обойдётся недёшево.", demandMul: 0.95, cost: 1, ratingDelta: -0.1, stockLossPct: 0 },
  { title: "Поставщик поднял цены", text: "Закупка на этой неделе дороже на 20%.", demandMul: 1, cost: 0, ratingDelta: 0, stockLossPct: 0 },
  { title: "Праздничные выходные", text: "Люди тратят охотнее: спрос растёт.", demandMul: 1.2, cost: 0, ratingDelta: 0, stockLossPct: 0 },
  { title: "Плохой отзыв", text: "Недовольный клиент оставил гневный отзыв.", demandMul: 0.92, cost: 0, ratingDelta: -0.3, stockLossPct: 0 },
  { title: "Порча запасов", text: "Часть запасов пришлось списать.", demandMul: 1, cost: 0, ratingDelta: 0, stockLossPct: 0.25 },
  { title: "Налоговая проверка", text: "Нашли мелкие нарушения: штраф.", demandMul: 1, cost: 0.5, ratingDelta: 0, stockLossPct: 0 },
  { title: "Сезон дождей", text: "Людей на улицах меньше.", demandMul: 0.88, cost: 0, ratingDelta: 0, stockLossPct: 0 },
];
const EVENT_IDS = ["calm", "blogger", "rival", "repair", "supplier", "holiday", "review", "spoil", "tax", "rain"];

/** Event for a 1-based week. Week 1 is always calm so the first decision is about the basics. */
export function eventFor(seed: number, week: number, p: BizProfile): SimEvent {
  const idx = week === 1 ? 0 : Math.floor(streamFor(seed, week, 1)() * EVENTS.length);
  const e = EVENTS[idx];
  // `cost` is a share of weekly rent, scaled to the business size.
  return { ...e, id: EVENT_IDS[idx], cost: Math.round(e.cost * p.rent) };
}

// ---------- Setup ----------

export function newGame(kind: BizKind): SimState {
  const p = PROFILES[kind];
  return {
    kind, week: 0, cash: p.startCash, price: p.basePrice, staff: p.startStaff, stock: p.startStock, rating: 4,
    loan: 0, status: "active", lastRevenue: 0, lastCosts: 0, lastCustomers: 0,
  };
}

export const loanSize = (p: BizProfile) => Math.round(p.startCash * 0.4);
export const LOAN_RATE = 0.02; // per week
export const adSpend = (p: BizProfile, level: number) => [0, p.adUnit, Math.round(p.adUnit * 2.5)][level] ?? 0;
export const stockBuy = (p: BizProfile, level: number) => [0, p.stockLot, p.stockLot * 2][level] ?? 0;
export const MAX_STAFF = 6;

const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
const priceStep = (price: number, move: PriceMove) => (move === "up" ? Math.round(price * 1.1) : move === "down" ? Math.round(price * 0.9) : price);

/** What the player sees before choosing: the week's event and 2–4 decisions. */
export function turnView(state: SimState, seed: number): TurnView {
  const p = PROFILES[state.kind];
  const week = state.week + 1;
  const event = eventFor(seed, week, p);
  const unitCost = event.id === "supplier" ? Math.round(p.unitCost * 1.2) : p.unitCost;
  const decisions: DecisionSpec[] = [
    {
      key: "price", title: `Цена (сейчас ${rub(state.price)})`,
      options: [
        { value: "down", label: "−10%", hint: rub(priceStep(state.price, "down")) },
        { value: "keep", label: "Оставить", hint: rub(state.price) },
        { value: "up", label: "+10%", hint: rub(priceStep(state.price, "up")) },
      ],
    },
    {
      key: "ad", title: "Реклама на неделю",
      options: [0, 1, 2].map((l) => ({ value: l, label: ["Без рекламы", "Умеренно", "Агрессивно"][l], hint: rub(adSpend(p, l)) })),
    },
    {
      key: "stock", title: `Закупка (на складе ${state.stock} ${p.unit})`,
      options: [0, 1, 2].map((l) => ({ value: l, label: ["Не закупать", `+${stockBuy(p, 1)}`, `+${stockBuy(p, 2)}`][l], hint: l ? rub(stockBuy(p, l) * unitCost * (l === 2 ? 0.9 : 1)) : "0 ₽" })),
    },
  ];
  // The fourth decision alternates: staff on even weeks, financing on odd ones (from week 3).
  if (week % 2 === 0) {
    decisions.push({
      key: "staff", title: `Команда (сейчас ${state.staff})`,
      options: [
        ...(state.staff > 1 ? [{ value: -1, label: "Уволить одного", hint: `выходное пособие ${rub(p.wage / 2)}` }] : []),
        { value: 0, label: "Без изменений", hint: `${rub(state.staff * p.wage)}/нед` },
        ...(state.staff < MAX_STAFF ? [{ value: 1, label: "Нанять", hint: `+${rub(p.wage)}/нед, +${p.capPerStaff} ${p.unit}` }] : []),
      ],
    });
  } else if (week >= 3) {
    decisions.push(
      state.loan > 0
        ? { key: "loan", title: `Кредит ${rub(state.loan)} под 2%/нед`, options: [{ value: "none", label: "Платить проценты", hint: `${rub(state.loan * LOAN_RATE)}/нед` }, { value: "repay", label: "Погасить", hint: rub(state.loan) }] }
        : { key: "loan", title: "Финансирование", options: [{ value: "none", label: "Без кредита", hint: "0 ₽" }, { value: "take", label: "Взять кредит", hint: `+${rub(loanSize(p))}, 2%/нед` }] },
    );
  }
  return { week, event, decisions };
}

/** Clamps decisions to what turnView actually offered this week; anything else falls back to the default. */
export function normalizeDecisions(view: TurnView, input: Partial<Decisions>): Decisions {
  const out: Decisions = { ...DEFAULT_DECISIONS };
  for (const spec of view.decisions) {
    const v = input[spec.key];
    if (v !== undefined && spec.options.some((o) => o.value === v)) (out as unknown as Record<string, unknown>)[spec.key] = v;
  }
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Plays one week. Pure: returns the new state and a report; the input state is not mutated. */
export function playTurn(state: SimState, seed: number, input: Partial<Decisions>): { state: SimState; report: WeekReport } {
  if (state.status !== "active") throw new Error("game over");
  const p = PROFILES[state.kind];
  const view = turnView(state, seed);
  const d = normalizeDecisions(view, input);
  const { event, week } = view;
  const noise = streamFor(seed, week, 2);

  let cash = state.cash;
  let loan = state.loan;
  let loanChange = 0;
  if (d.loan === "take" && loan === 0) {
    loan = loanSize(p);
    cash += loan;
    loanChange = loan;
  } else if (d.loan === "repay" && loan > 0 && cash >= loan) {
    cash -= loan;
    loanChange = -loan;
    loan = 0;
  }

  const price = Math.min(Math.round(p.basePrice * 2), Math.max(Math.round(p.basePrice * 0.5), priceStep(state.price, d.price)));
  const staff = Math.min(MAX_STAFF, Math.max(1, state.staff + d.staff));
  const severance = d.staff < 0 && staff < state.staff ? Math.round(p.wage / 2) : 0;
  const ads = adSpend(p, d.ad);
  const unitCost = event.id === "supplier" ? p.unitCost * 1.2 : p.unitCost;
  const bought = stockBuy(p, d.stock);
  const stockCost = Math.round(bought * unitCost * (d.stock === 2 ? 0.9 : 1));
  let stock = state.stock + bought;
  if (event.stockLossPct) stock = Math.floor(stock * (1 - event.stockLossPct));

  const ratio = price / p.basePrice;
  // Customers forgive discounts less than they punish markups: above the base price demand is ~1.8x more elastic.
  const priceFactor = Math.pow(ratio, ratio > 1 ? -p.elasticity * 1.8 : -p.elasticity);
  const adFactor = 1 + p.adPower * Math.log2(1 + ads / p.adUnit);
  const ratingFactor = 0.6 + 0.1 * state.rating;
  const growth = 1 + 0.015 * (week - 1);
  const demand = Math.max(0, Math.round(p.baseDemand * growth * priceFactor * adFactor * ratingFactor * event.demandMul * (0.92 + noise() * 0.16)));
  const capacity = staff * p.capPerStaff;
  const sold = Math.min(demand, capacity, stock);
  const lost = demand - sold;
  stock -= sold;
  const revenue = sold * price;

  const costs = { rent: p.rent, wages: staff * p.wage, ads, stock: stockCost, interest: Math.round(loan * LOAN_RATE), event: event.cost, severance };
  const totalCosts = Object.values(costs).reduce((a, b) => a + b, 0);
  const profit = revenue - totalCosts;
  cash += profit;

  const lostShare = demand ? lost / demand : 0;
  let ratingDelta = lostShare < 0.05 ? 0.1 : -0.6 * lostShare;
  if (price > p.basePrice * 1.25) ratingDelta -= 0.1;
  if (price < p.basePrice * 0.85) ratingDelta += 0.05;
  ratingDelta = round1(ratingDelta + event.ratingDelta);
  const rating = Math.min(5, Math.max(1, round1(state.rating + ratingDelta)));

  const nextWeek = state.week + 1;
  const status: SimState["status"] = cash < 0 ? "bankrupt" : nextWeek >= SIM_WEEKS ? "finished" : "active";
  const next: SimState = { ...state, week: nextWeek, cash: Math.round(cash), price, staff, stock, rating, loan, status, lastRevenue: revenue, lastCosts: totalCosts, lastCustomers: sold };
  return {
    state: next,
    report: { week, event, decisions: d, price, demand, sold, lost, revenue, costs, totalCosts, profit, cash: next.cash, rating, ratingDelta: round1(rating - state.rating), stock, staff, loan, loanChange },
  };
}

// ---------- Results ----------

/** Net worth: cash plus stock at cost, minus debt. */
export const netWorth = (s: SimState) => Math.round(s.cash + s.stock * PROFILES[s.kind].unitCost - s.loan);

export function finalScore(s: SimState): number {
  const p = PROFILES[s.kind];
  if (s.status === "bankrupt") return s.week * 10;
  const growth = (netWorth(s) - p.startCash) / p.startCash;
  return Math.max(0, Math.round(500 + growth * 600 + (s.rating - 3) * 100));
}

export function grade(score: number): string {
  return score >= 900 ? "Акула бизнеса" : score >= 700 ? "Уверенный предприниматель" : score >= 500 ? "Выжил и вырос" : score >= 300 ? "Есть чему учиться" : "Первый блин";
}

/** Modest PigCoin$ reward for a finished run (paid at most once per day). */
export const rewardFor = (s: SimState, score: number) => (s.status === "bankrupt" ? 5 : Math.min(30, 10 + Math.floor(score / 100)));

/** Three takeaways drawn from what actually happened in the run. */
export function lessons(s: SimState, reports: WeekReport[]): string[] {
  const p = PROFILES[s.kind];
  const out: string[] = [];
  const stockouts = reports.filter((r) => r.lost > 0 && r.stock === 0).length;
  const capped = reports.filter((r) => r.lost > 0 && r.stock > 0).length;
  const lostRevenue = reports.reduce((a, r) => a + r.lost * r.price, 0);
  if (stockouts) out.push(`Запасы заканчивались ${stockouts} раз(а). Упущенная выручка за игру — около ${rub(lostRevenue)}. Пустой склад стоит дороже, чем запас.`);
  if (capped) out.push(`В ${capped} нед. не хватало рук: клиенты уходили, рейтинг падал. Мощность должна расти вместе со спросом.`);
  const adWeeks = reports.filter((r) => r.costs.ads > 0);
  if (adWeeks.length) {
    const adTotal = adWeeks.reduce((a, r) => a + r.costs.ads, 0);
    const margin = (s.price - p.unitCost) / s.price;
    out.push(`На рекламу ушло ${rub(adTotal)} за ${adWeeks.length} нед. Реклама окупается, только если дополнительная маржа (у вас ~${Math.round(margin * 100)}% с чека) больше её стоимости.`);
  } else out.push("Вы не вкладывались в рекламу. Без неё рост держится только на рейтинге и сезоне.");
  const loanTaken = reports.some((r) => r.loanChange > 0);
  if (loanTaken) {
    const interest = reports.reduce((a, r) => a + r.costs.interest, 0);
    out.push(`Кредит обошёлся в ${rub(interest)} процентов. Заёмные деньги полезны, когда приносят больше, чем стоят.`);
  }
  const priceMoves = reports.filter((r) => r.decisions.price !== "keep").length;
  if (priceMoves >= 3) out.push(`Цену меняли ${priceMoves} раз. Каждое повышение на 10% у «${p.title}» срезает спрос примерно на ${Math.round((1 - Math.pow(1.1, -p.elasticity)) * 100)}%.`);
  if (s.status === "bankrupt") out.unshift(`Деньги закончились на ${s.week}-й неделе. Главное правило: всегда держите запас кассы на 2–3 недели расходов (~${rub((p.rent + s.staff * p.wage) * 2)}).`);
  if (out.length < 3) out.push(`Итоговый рейтинг ${s.rating.toFixed(1)}: довольные клиенты возвращаются и приводят друзей бесплатно.`);
  return out.slice(0, 3);
}

/** Short review used when the AI is unavailable: same numbers, template wording. */
export function templateReview(r: WeekReport, kind: BizKind): string {
  const p = PROFILES[kind];
  const parts: string[] = [];
  parts.push(r.profit >= 0 ? `Неделя ${r.week} в плюсе: выручка ${rub(r.revenue)}, расходы ${rub(r.totalCosts)}, прибыль ${rub(r.profit)}.` : `Неделя ${r.week} в минусе на ${rub(-r.profit)}: выручка ${rub(r.revenue)} не покрыла расходы ${rub(r.totalCosts)}.`);
  if (r.lost > 0) parts.push(r.stock === 0 ? `Склад опустел — потеряно ${r.lost} ${p.unit}, это ~${rub(r.lost * r.price)} выручки.` : `Не хватило мастеров/персонала: ушли ${r.lost} клиентов.`);
  else if (r.costs.ads > 0) parts.push(`Реклама за ${rub(r.costs.ads)} привела спрос в ${r.demand} ${p.unit} — всех обслужили.`);
  if (r.decisions.price === "up") parts.push(`Цена выросла до ${rub(r.price)}: следите, не уходят ли клиенты.`);
  if (r.decisions.price === "down") parts.push(`Скидка до ${rub(r.price)} разгоняет спрос, но съедает маржу.`);
  if (r.cash < p.rent + r.staff * p.wage) parts.push(`В кассе ${rub(r.cash)} — меньше недели расходов, опасно.`);
  return parts.join(" ");
}
