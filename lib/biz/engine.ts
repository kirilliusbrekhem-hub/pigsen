// «Мой бизнес»: pure game rules. Capital is real savings (₽); guests/check/revenue are virtual game numbers.
// Everything here is deterministic: the same business + day number always gives the same event.

export type BizKind = "coffee" | "barber" | "shop";

export interface Effect {
  guests?: number;
  check?: number;
  rating?: number;
}

export interface UpgradeDef {
  id: string;
  title: string;
  blurb: string;
  price: number;
  effect: Effect;
  requires?: string[];
  minLevel?: number;
  premium?: boolean;
  /** Plausible $PIG hint text ("гости жалуются на вкус"). */
  hint: string;
}

export interface KindDef {
  kind: BizKind;
  title: string;
  available: boolean;
  blurb: string;
  levels: string[];
  base: { guests: number; check: number };
  catalog: UpgradeDef[];
}

const COFFEE: UpgradeDef[] = [
  { id: "chairs", title: "Стулья", blurb: "Гостям есть где присесть", price: 1500, effect: { guests: 6 }, hint: "люди берут кофе и уходят — им негде сесть" },
  { id: "sign", title: "Вывеска", blurb: "Вас замечают с улицы", price: 2000, effect: { guests: 10 }, hint: "прохожие нас просто не видят" },
  { id: "tables", title: "Столы", blurb: "Можно задержаться с ноутбуком", price: 2500, effect: { guests: 8, rating: 0.1 }, requires: ["chairs"], hint: "стулья есть, а чашку ставить некуда" },
  { id: "machine", title: "Кофемашина", blurb: "Настоящий эспрессо вместо растворимого", price: 6000, effect: { check: 60, rating: 0.3 }, hint: "растворимый кофе — это позор, нужна кофемашина" },
  { id: "grinder", title: "Кофемолка", blurb: "Свежий помол — другой вкус", price: 2500, effect: { rating: 0.4, check: 10 }, requires: ["machine"], hint: "гости жалуются на вкус — нужна кофемолка" },
  { id: "showcase", title: "Витрина с десертами", blurb: "Круассан к кофе поднимает чек", price: 4000, effect: { check: 80 }, hint: "к кофе часто спрашивают что-то сладкое" },
  { id: "barista", title: "Нанять бариста", blurb: "Быстрее очередь, вкуснее капучино", price: 8000, effect: { guests: 12, rating: 0.3 }, requires: ["machine"], hint: "очередь до двери, ты один не справляешься" },
  { id: "menu", title: "Новое меню", blurb: "Раф, матча и сезонные напитки", price: 3000, effect: { check: 40, rating: 0.1 }, requires: ["machine"], hint: "все спрашивают раф, а у нас его нет" },
  { id: "renovation", title: "Ремонт", blurb: "Светлый зал, свет и растения", price: 12000, effect: { rating: 0.5, guests: 6 }, minLevel: 2, hint: "обои отклеиваются, гостям неуютно" },
  { id: "terrace", title: "Терраса", blurb: "Летние столики на улице", price: 15000, effect: { guests: 20 }, minLevel: 2, requires: ["tables"], hint: "на улице солнце — терраса будет забита" },
  { id: "delivery", title: "Доставка", blurb: "Кофе в офисы по соседству", price: 10000, effect: { guests: 15, check: 20 }, minLevel: 2, requires: ["barista"], hint: "соседние офисы просят доставку" },
  { id: "hall2", title: "Второй зал", blurb: "Вдвое больше мест — путь к сети", price: 40000, effect: { guests: 40, rating: 0.1 }, minLevel: 2, requires: ["renovation"], hint: "по выходным люди стоят на улице, нужен второй зал" },
  { id: "latte", title: "Латте-арт мастер", blurb: "Рисунки на пенке, фото в соцсетях", price: 5000, effect: { rating: 0.4, guests: 4 }, requires: ["barista"], premium: true, hint: "гости фотографируют кофе — пора делать латте-арт" },
  { id: "neon", title: "Неоновая вывеска", blurb: "Светится зелёным по вечерам", price: 3000, effect: { guests: 12 }, requires: ["sign"], premium: true, hint: "вечером нас не видно, нужен неон" },
  { id: "vinyl", title: "Винил-проигрыватель", blurb: "Атмосфера, ради которой возвращаются", price: 4000, effect: { rating: 0.3 }, premium: true, hint: "в зале тишина, нужна музыка" },
];

export const KINDS: Record<BizKind, KindDef> = {
  coffee: { kind: "coffee", title: "Кофейня", available: true, blurb: "От ларька с термосом до сети кофеен", levels: ["Ларёк", "Кофейня", "Сеть"], base: { guests: 15, check: 150 }, catalog: COFFEE },
  barber: { kind: "barber", title: "Барбершоп", available: false, blurb: "Кресло, машинка и очередь из постоянных", levels: ["Кресло", "Барбершоп", "Сеть"], base: { guests: 4, check: 900 }, catalog: [] },
  shop: { kind: "shop", title: "Онлайн-магазин", available: false, blurb: "От пары товаров до своего склада", levels: ["Витрина", "Магазин", "Маркетплейс"], base: { guests: 10, check: 1200 }, catalog: [] },
};
export const BIZ_KIND_IDS = Object.keys(KINDS) as [BizKind, ...BizKind[]];

export const kindOf = (k: string): KindDef => KINDS[(k in KINDS ? k : "coffee") as BizKind];
export const itemOf = (kind: string, id: string) => kindOf(kind).catalog.find((u) => u.id === id) ?? null;

/** Level 2 needs the core café kit, level 3 a second hall and delivery. */
const LEVEL_RULES: Record<BizKind, string[][]> = {
  coffee: [[], ["chairs", "tables", "machine", "sign"], ["hall2", "delivery"]],
  barber: [[]],
  shop: [[]],
};

export interface OwnedItem {
  itemId: string;
  status: string;
}

export function levelOf(kind: string, owned: OwnedItem[]): number {
  const working = new Set(owned.filter((o) => o.status === "ok").map((o) => o.itemId));
  const rules = LEVEL_RULES[kindOf(kind).kind];
  let lvl = 1;
  for (let i = 1; i < rules.length; i++) {
    if (rules[i].every((id) => working.has(id))) lvl = i + 1;
    else break;
  }
  return lvl;
}

export function nextLevelNeeds(kind: string, owned: OwnedItem[]): string[] {
  const rules = LEVEL_RULES[kindOf(kind).kind];
  const lvl = levelOf(kind, owned);
  if (lvl >= rules.length) return [];
  const working = new Set(owned.filter((o) => o.status === "ok").map((o) => o.itemId));
  return rules[lvl].filter((id) => !working.has(id));
}

export type Availability = "owned" | "broken" | "locked" | "pro" | "open";

export function availability(kind: string, item: UpgradeDef, owned: OwnedItem[], pro: boolean): { state: Availability; reason?: string } {
  const own = owned.find((o) => o.itemId === item.id);
  if (own) return { state: own.status === "ok" ? "owned" : "broken" };
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

export interface DayState {
  /** Today's event multiplier on guests and its text. */
  mult: number;
  event: string;
  /** Guests penalty after a withdrawal (0..0.6), halves every day. */
  penalty: number;
  hint?: { itemId: string; wrong: boolean; day: number } | null;
  /** Ratings delta from today's event, already applied. */
}

export function parseState(raw: unknown): DayState {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<DayState>;
  return {
    mult: typeof s.mult === "number" ? s.mult : 1,
    event: typeof s.event === "string" ? s.event : "Первый день: открываемся!",
    penalty: typeof s.penalty === "number" ? Math.min(0.6, Math.max(0, s.penalty)) : 0,
    hint: s.hint && typeof s.hint === "object" && typeof s.hint.itemId === "string" ? s.hint : null,
  };
}

export interface Metrics {
  guests: number;
  check: number;
  revenue: number;
  targetRating: number;
}

export function metrics(kind: string, owned: OwnedItem[], rating: number, st: Pick<DayState, "mult" | "penalty">): Metrics {
  const k = kindOf(kind);
  let guests = k.base.guests;
  let check = k.base.check;
  let r = 3;
  for (const o of owned) {
    const def = itemOf(kind, o.itemId);
    if (!def) continue;
    if (o.status !== "ok") {
      r -= 0.2;
      continue;
    }
    guests += def.effect.guests ?? 0;
    check += def.effect.check ?? 0;
    r += def.effect.rating ?? 0;
  }
  const g = Math.max(1, Math.round(guests * (0.55 + rating / 9) * st.mult * (1 - st.penalty)));
  return { guests: g, check, revenue: g * check, targetRating: clampRating(r) };
}

export const clampRating = (r: number) => Math.round(Math.min(5, Math.max(1, r)) * 100) / 100;

/** mulberry32 */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join(":")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DayEvent {
  id: string;
  text: string;
  /** Teaser for $PIG the day before. */
  teaser: string;
  mult: number;
  rating: number;
  /** Only affects businesses owning this item (otherwise neutral). */
  needs?: string;
  hurts?: string;
}

export const EVENTS: DayEvent[] = [
  { id: "calm", text: "Обычный день, всё по плану", teaser: "завтра обычный день — самое время что-то улучшить", mult: 1, rating: 0 },
  { id: "supplier", text: "Приехал поставщик со скидкой на зёрна — гости хвалят вкус", teaser: "завтра приедет поставщик, не пропусти", mult: 1.05, rating: 0.1 },
  { id: "blogger", text: "Зашёл местный блогер — гостей заметно больше", teaser: "говорят, завтра в районе снимает блогер", mult: 1.3, rating: 0.05 },
  { id: "rain", text: "Весь день дождь — терраса пустует", teaser: "завтра обещают дождь, держим зонтики", mult: 0.85, rating: 0, hurts: "terrace" },
  { id: "sun", text: "Солнечно — терраса забита", teaser: "завтра солнце, выносим столики", mult: 1.1, rating: 0.05, needs: "terrace" },
  { id: "holiday", text: "Праздник в городе — очередь с утра", teaser: "завтра праздник, будет жарко", mult: 1.25, rating: 0 },
  { id: "breakdown", text: "Кофемашина капризничала полдня", teaser: "кофемашина что-то шумит… проверим завтра", mult: 0.9, rating: -0.1, needs: "machine" },
  { id: "rival", text: "Напротив открылся конкурент — часть гостей ушла посмотреть", teaser: "напротив что-то строят, завтра узнаем что", mult: 0.85, rating: 0 },
  { id: "office", text: "Соседний офис заказал кофе на всю команду", teaser: "завтра у соседей большая планёрка", mult: 1.15, rating: 0.05, needs: "delivery" },
];

/** The deterministic event of business day `dayNo`. Events tied to an item fall back to calm when it isn't working. */
export function eventFor(seed: number, dayNo: number, owned: OwnedItem[]): DayEvent {
  const r = rng(hashSeed(seed, dayNo, "event"))();
  const has = (id: string) => owned.some((o) => o.itemId === id && o.status === "ok");
  const ev = dayNo <= 1 ? EVENTS[0] : EVENTS[Math.floor(r * EVENTS.length)];
  if (ev.needs && !has(ev.needs)) return EVENTS[0];
  if (ev.hurts && !has(ev.hurts)) return { ...ev, mult: 1, text: "Дождь — но мы внутри, гостям уютно" };
  return ev;
}

export interface Hint {
  itemId: string;
  wrong: boolean;
}

/**
 * $PIG's daily hint: honest picks the open item with the best effect per ruble; ~20% of days it's a deliberately
 * weaker pick (game-only, the next day reveals it). Returns null when nothing is open.
 */
export function pickHint(kind: string, owned: OwnedItem[], pro: boolean, seed: number, dayNo: number): Hint | null {
  const open = kindOf(kind).catalog.filter((u) => availability(kind, u, owned, pro).state === "open");
  if (!open.length) return null;
  const r = rng(hashSeed(seed, dayNo, "hint"));
  const score = (u: UpgradeDef) => ((u.effect.guests ?? 0) * 200 + (u.effect.check ?? 0) * 25 + (u.effect.rating ?? 0) * 3000) / u.price;
  const sorted = [...open].sort((a, b) => score(b) - score(a));
  const wrong = sorted.length > 1 && r() < 0.2;
  return { itemId: (wrong ? sorted[sorted.length - 1] : sorted[0]).id, wrong };
}

export const bestPick = (kind: string, owned: OwnedItem[], pro: boolean, capital: number): UpgradeDef | null => {
  const open = kindOf(kind).catalog.filter((u) => availability(kind, u, owned, pro).state === "open");
  const score = (u: UpgradeDef) => ((u.effect.guests ?? 0) * 200 + (u.effect.check ?? 0) * 25 + (u.effect.rating ?? 0) * 3000) / u.price;
  const affordable = open.filter((u) => u.price <= capital);
  return [...(affordable.length ? affordable : open)].sort((a, b) => score(b) - score(a))[0] ?? null;
};

/** Rating hit for a withdrawal: up to −0.6 for a withdrawal that wipes half the capital. */
export function withdrawalHit(amount: number, capitalBefore: number): { rating: number; penalty: number } {
  const share = Math.min(1, amount / Math.max(1000, capitalBefore + amount));
  return { rating: Math.round(Math.min(0.6, 0.1 + share * 1.0) * 100) / 100, penalty: Math.round(Math.min(0.5, 0.1 + share) * 100) / 100 };
}

export const MAX_SIM_DAYS = 7;
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
