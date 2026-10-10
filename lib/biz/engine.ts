// «Мой бизнес»: pure game rules. Capital is real savings (₽); guests/check/revenue are virtual game numbers.
// Everything here is deterministic: the same business + day number always gives the same event.

import { kindOf, itemOf, type BizKind, type Effect, type Template, type UpgradeDef } from "./catalog";
import { hashSeed, rng } from "./rng";
import type { ActiveDeal } from "./game";

export { KINDS, BIZ_KIND_IDS, kindOf, itemOf } from "./catalog";
export type { BizKind, Effect, UpgradeDef, KindDef } from "./catalog";
export { hashSeed, rng };

export interface OwnedItem {
  itemId: string;
  status: string;
}

export function levelOf(kind: string, owned: OwnedItem[]): number {
  const working = new Set(owned.filter((o) => o.status === "ok").map((o) => o.itemId));
  const rules = [[], ...kindOf(kind).levelRules];
  let lvl = 1;
  for (let i = 1; i < rules.length; i++) {
    if (rules[i].every((id) => working.has(id))) lvl = i + 1;
    else break;
  }
  return lvl;
}

export function nextLevelNeeds(kind: string, owned: OwnedItem[]): string[] {
  const rules = [[], ...kindOf(kind).levelRules];
  const lvl = levelOf(kind, owned);
  if (lvl >= rules.length) return [];
  const working = new Set(owned.filter((o) => o.status === "ok").map((o) => o.itemId));
  return rules[lvl].filter((id) => !working.has(id));
}

export type Availability = "owned" | "broken" | "locked" | "pro" | "open" | "investor" | "challenge";

export function availability(kind: string, item: UpgradeDef, owned: OwnedItem[], pro: boolean, unlocks: string[] = []): { state: Availability; reason?: string } {
  const own = owned.find((o) => o.itemId === item.id);
  if (own) return { state: own.status === "ok" ? "owned" : "broken" };
  if (item.challenge) return { state: "challenge", reason: "Награда за челлендж — не продаётся" };
  if (item.exclusive && !unlocks.includes(item.id)) return { state: "investor", reason: "Откроется после сделки с инвестором" };
  const k = kindOf(kind);
  const lvl = levelOf(kind, owned);
  if (item.minLevel && lvl < item.minLevel) return { state: "locked", reason: `Нужен уровень «${k.levels[item.minLevel - 1]}»` };
  const missing = (item.requires ?? []).filter((r) => !owned.some((o) => o.itemId === r && o.status === "ok"));
  if (missing.length) return { state: "locked", reason: `Сначала: ${missing.map((m) => itemOf(kind, m)?.title ?? m).join(", ")}` };
  if (item.premium && !pro) return { state: "pro", reason: "Премиум-улучшение Pro" };
  return { state: "open" };
}

/** Repair costs a third of the price. */
export const repairPrice = (item: UpgradeDef) => Math.ceil(item.price / 3);
/** Price after an investor's supplier discount (never below 1 ₽ for a paid item). */
export const priceOf = (item: UpgradeDef, discount = 0) => (item.price ? Math.max(1, Math.round(item.price * (1 - Math.min(0.3, Math.max(0, discount))))) : 0);

export interface DayState {
  /** Today's event multiplier on guests and its text. */
  mult: number;
  event: string;
  /** Guests penalty after a withdrawal (0..0.6), halves every day. */
  penalty: number;
  hint?: { itemId: string; wrong: boolean; day: number } | null;
}

export interface Custom {
  emoji: string;
  accent: string;
  /** Custom item names (Pro), itemId → name. */
  names: Record<string, string>;
}

export interface PendingCrisis {
  id: string;
  day: number;
}

export interface GameState extends DayState {
  /** 0..100. Falls on failed deals and bad crisis outcomes; gates investor offers. */
  reputation: number;
  stats: { guests: number; crises: number; dealsWon: number; dealsFailed: number; lastCrisisDay: number };
  /** Number of story chapters completed. */
  story: number;
  boost: { mult: number; discount: number; unlocks: string[] };
  /** Investors' share of virtual profit (0..0.49). */
  equity: number;
  investors: Record<string, "declined" | "won" | "failed">;
  deal: ActiveDeal | null;
  crisis: PendingCrisis | null;
  /** Temporary guest multipliers from crisis outcomes, active while dayNo <= until. */
  mods: { mult: number; until: number }[];
  custom: Custom | null;
}

const num = (v: unknown, d: number, lo = -Infinity, hi = Infinity) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export function parseState(raw: unknown): GameState {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<GameState> & Record<string, unknown>;
  const stats = (s.stats ?? {}) as Partial<GameState["stats"]>;
  const boost = (s.boost ?? {}) as Partial<GameState["boost"]>;
  const deal = s.deal && typeof s.deal === "object" && typeof s.deal.investorId === "string" ? s.deal : null;
  const crisis = s.crisis && typeof s.crisis === "object" && typeof s.crisis.id === "string" ? s.crisis : null;
  const custom = s.custom && typeof s.custom === "object" && typeof s.custom.emoji === "string" ? { emoji: s.custom.emoji, accent: String(s.custom.accent ?? ""), names: (s.custom.names && typeof s.custom.names === "object" ? s.custom.names : {}) as Record<string, string> } : null;
  return {
    mult: num(s.mult, 1),
    event: typeof s.event === "string" ? s.event : "Первый день: открываемся!",
    penalty: num(s.penalty, 0, 0, 0.6),
    hint: s.hint && typeof s.hint === "object" && typeof s.hint.itemId === "string" ? s.hint : null,
    reputation: num(s.reputation, 50, 0, 100),
    stats: { guests: num(stats.guests, 0, 0), crises: num(stats.crises, 0, 0), dealsWon: num(stats.dealsWon, 0, 0), dealsFailed: num(stats.dealsFailed, 0, 0), lastCrisisDay: num(stats.lastCrisisDay, 1) },
    story: num(s.story, 0, 0, 50),
    boost: { mult: num(boost.mult, 1, 1, 3), discount: num(boost.discount, 0, 0, 0.3), unlocks: Array.isArray(boost.unlocks) ? boost.unlocks.filter((x): x is string => typeof x === "string") : [] },
    equity: num(s.equity, 0, 0, 0.49),
    investors: (s.investors && typeof s.investors === "object" ? s.investors : {}) as GameState["investors"],
    deal,
    crisis,
    mods: Array.isArray(s.mods) ? s.mods.filter((m) => m && typeof m.mult === "number" && typeof m.until === "number") : [],
    custom,
  };
}

/** Fresh state for a new (or switched) business. */
export function freshState(custom: Custom | null = null): GameState {
  return { ...parseState({}), custom };
}

export interface Metrics {
  guests: number;
  check: number;
  revenue: number;
  targetRating: number;
  /** IT: share of users leaving per day (0..0.5). */
  churn: number;
  /** IT: open bugs. */
  bugs: number;
  /** 0..100 for the scene: how happy the place looks today. */
  mood: number;
}

export function metrics(kind: string, owned: OwnedItem[], rating: number, st: Pick<DayState, "mult" | "penalty"> & Partial<Pick<GameState, "boost" | "mods">>, dayNo = 0): Metrics {
  const k = kindOf(kind);
  const it = k.template === "it";
  let guests = k.base.guests;
  let check = k.base.check;
  let churn = k.base.churn;
  let bugs = k.base.bugs;
  let r = 3;
  for (const o of owned) {
    const def = itemOf(kind, o.itemId);
    if (!def) continue;
    if (o.status !== "ok") {
      r -= 0.2;
      continue;
    }
    const e: Effect = def.effect;
    guests += e.guests ?? 0;
    check += e.check ?? 0;
    r += e.rating ?? 0;
    churn += e.churn ?? 0;
    bugs += e.bugs ?? 0;
  }
  churn = it ? Math.round(Math.min(0.5, Math.max(0.01, churn)) * 100) / 100 : 0;
  bugs = it ? Math.max(0, bugs) : 0;
  if (it) r -= bugs * 0.04;
  const modMult = (st.mods ?? []).filter((m) => m.until >= dayNo).reduce((a, m) => a * m.mult, 1);
  const boost = st.boost?.mult ?? 1;
  const g = Math.max(1, Math.round(guests * (0.55 + rating / 9) * st.mult * (1 - st.penalty) * boost * modMult * (1 - churn)));
  const mood = Math.round(Math.min(100, Math.max(0, 50 + (rating - 3) * 20 + (st.mult - 1) * 80 + (modMult - 1) * 80 - st.penalty * 100 - bugs * 1.5)));
  return { guests: g, check, revenue: g * check, targetRating: clampRating(r), churn, bugs, mood };
}

export const moodLabel = (m: number) => (m >= 75 ? "Аншлаг и улыбки" : m >= 55 ? "Всё спокойно" : m >= 35 ? "Напряжённо" : "Тяжёлый день");

export const clampRating = (r: number) => Math.round(Math.min(5, Math.max(1, r)) * 100) / 100;

export interface DayEvent {
  id: string;
  text: string;
  /** Teaser for CAP the day before. */
  teaser: string;
  mult: number;
  rating: number;
  /** Only affects businesses owning this item (otherwise neutral). */
  needs?: string;
  hurts?: string;
  /** Limited to these templates / kinds (default: all). */
  templates?: Template[];
  kinds?: BizKind[];
}

const OFF: Template[] = ["offline"];
const NOT_IT: Template[] = ["offline", "online"];
const IT: Template[] = ["it"];

export const EVENTS: DayEvent[] = [
  { id: "calm", text: "Обычный день, всё по плану", teaser: "завтра обычный день — самое время что-то улучшить", mult: 1, rating: 0 },
  { id: "supplier", text: "Приехал поставщик со скидкой на зёрна — гости хвалят вкус", teaser: "завтра приедет поставщик, не пропусти", mult: 1.05, rating: 0.1, kinds: ["coffee"] },
  { id: "blogger", text: "Зашёл местный блогер — гостей заметно больше", teaser: "говорят, завтра в районе снимает блогер", mult: 1.3, rating: 0.05, templates: NOT_IT },
  { id: "rain", text: "Весь день дождь — терраса пустует", teaser: "завтра обещают дождь, держим зонтики", mult: 0.85, rating: 0, hurts: "terrace", kinds: ["coffee"] },
  { id: "sun", text: "Солнечно — терраса забита", teaser: "завтра солнце, выносим столики", mult: 1.1, rating: 0.05, needs: "terrace", kinds: ["coffee"] },
  { id: "holiday", text: "Праздник в городе — очередь с утра", teaser: "завтра праздник, будет жарко", mult: 1.25, rating: 0, templates: OFF },
  { id: "breakdown", text: "Кофемашина капризничала полдня", teaser: "кофемашина что-то шумит… проверим завтра", mult: 0.9, rating: -0.1, needs: "machine", kinds: ["coffee"] },
  { id: "rival", text: "Напротив открылся конкурент — часть гостей ушла посмотреть", teaser: "напротив что-то строят, завтра узнаем что", mult: 0.85, rating: 0, templates: OFF },
  { id: "office", text: "Соседний офис заказал кофе на всю команду", teaser: "завтра у соседей большая планёрка", mult: 1.15, rating: 0.05, needs: "delivery", kinds: ["coffee"] },
  { id: "bread-morning", text: "Утренняя очередь за горячим хлебом", teaser: "завтра суббота — все за свежим хлебом", mult: 1.2, rating: 0.05, kinds: ["bakery"] },
  { id: "wedding", text: "Заказали торт на свадьбу — о нас говорят", teaser: "кто-то спрашивал про свадебный торт…", mult: 1.1, rating: 0.1, needs: "cakes", kinds: ["bakery"] },
  { id: "prom", text: "Перед выпускным все хотят свежий фейд", teaser: "скоро выпускные — запись будет плотной", mult: 1.3, rating: 0.05, kinds: ["barber"] },
  { id: "sale", text: "Распродажа на маркетплейсах — покупатели ищут скидки", teaser: "завтра большая распродажа", mult: 1.25, rating: 0, templates: ["online"] },
  { id: "courier-late", text: "Курьерская служба задержала посылки", teaser: "у курьеров завал, держимся", mult: 0.9, rating: -0.05, templates: ["online"] },
  { id: "habr", text: "Пост про нас попал в топ — регистраций заметно больше", teaser: "завтра выходит статья про нас", mult: 1.3, rating: 0.05, templates: IT },
  { id: "store-feature", text: "Нас добавили в подборку — пользователей больше", teaser: "редакция присматривается к нам", mult: 1.2, rating: 0.05, kinds: ["app"] },
  { id: "deploy-fail", text: "Неудачный деплой — полдня всё тормозило", teaser: "завтра релиз, держим кулачки", mult: 0.85, rating: -0.1, templates: IT },
  { id: "conf", text: "Выступили на конференции — пришли новые клиенты", teaser: "завтра конференция, готовим слайды", mult: 1.15, rating: 0.05, templates: IT },
];

/** The deterministic event of business day `dayNo`. Events tied to an item fall back to calm when it isn't working. */
export function eventFor(seed: number, dayNo: number, owned: OwnedItem[], kind = "coffee"): DayEvent {
  const k = kindOf(kind);
  const pool = EVENTS.filter((e) => (!e.templates || e.templates.includes(k.template)) && (!e.kinds || e.kinds.includes(k.kind)));
  const r = rng(hashSeed(seed, dayNo, "event"))();
  const has = (id: string) => owned.some((o) => o.itemId === id && o.status === "ok");
  const ev = dayNo <= 1 ? EVENTS[0] : pool[Math.floor(r * pool.length)];
  if (ev.needs && !has(ev.needs)) return EVENTS[0];
  if (ev.hurts && !has(ev.hurts)) return { ...ev, mult: 1, text: "Дождь — но мы внутри, гостям уютно" };
  return ev;
}

export interface Hint {
  itemId: string;
  wrong: boolean;
}

/**
 * CAP's daily hint: honest picks the open item with the best effect per ruble; ~20% of days it's a deliberately
 * weaker pick (game-only, the next day reveals it). Returns null when nothing is open.
 */
/** Value per ruble, comparable across kinds (guests and check are scaled by the kind's base). */
function score(kind: string, u: UpgradeDef) {
  const b = kindOf(kind).base;
  const e = u.effect;
  const v = ((e.guests ?? 0) / b.guests) * 3000 + ((e.check ?? 0) / b.check) * 3000 + (e.rating ?? 0) * 3000 - (e.churn ?? 0) * 30000 - (e.bugs ?? 0) * 150;
  return v / Math.max(1, u.price);
}

export function pickHint(kind: string, owned: OwnedItem[], pro: boolean, seed: number, dayNo: number, unlocks: string[] = []): Hint | null {
  const open = kindOf(kind).catalog.filter((u) => availability(kind, u, owned, pro, unlocks).state === "open");
  if (!open.length) return null;
  const r = rng(hashSeed(seed, dayNo, "hint"));
  const sorted = [...open].sort((a, b) => score(kind, b) - score(kind, a));
  const wrong = sorted.length > 1 && r() < 0.2;
  return { itemId: (wrong ? sorted[sorted.length - 1] : sorted[0]).id, wrong };
}

export const bestPick = (kind: string, owned: OwnedItem[], pro: boolean, capital: number, unlocks: string[] = [], discount = 0): UpgradeDef | null => {
  const open = kindOf(kind).catalog.filter((u) => availability(kind, u, owned, pro, unlocks).state === "open");
  const affordable = open.filter((u) => priceOf(u, discount) <= capital);
  return [...(affordable.length ? affordable : open)].sort((a, b) => score(kind, b) - score(kind, a))[0] ?? null;
};

/** Rating hit for a withdrawal: up to −0.6 for a withdrawal that wipes half the capital. */
export function withdrawalHit(amount: number, capitalBefore: number): { rating: number; penalty: number } {
  const share = Math.min(1, amount / Math.max(1000, capitalBefore + amount));
  return { rating: Math.round(Math.min(0.6, 0.1 + share * 1.0) * 100) / 100, penalty: Math.round(Math.min(0.5, 0.1 + share) * 100) / 100 };
}

export const MAX_SIM_DAYS = 7;
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
