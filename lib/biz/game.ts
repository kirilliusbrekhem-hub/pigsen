// Kapital game layer: investors, story chapters and crises. Pure and deterministic; the service applies results
// under the business lock. Nothing here ever adds capital: rewards are multipliers, unlocks, discounts, rating,
// reputation, and modest PigCoin$/XP paid by the service.
import { hashSeed, rng } from "./rng";
import { kindOf, type BizKind, type Template } from "./catalog";

// ───────────────────────── investors ─────────────────────────

export type DealGoal =
  | { type: "weekly"; amount: number; weeks: number } // team net savings ≥ amount in each of N consecutive 7-day windows
  | { type: "window"; amount: number; days: number } // team net savings ≥ amount within N days
  | { type: "reach"; level: number; rating: number } // business level and rating
  | { type: "nowithdraw"; days: number; capital: number }; // no withdrawals for N days and capital ≥ X at the end

export type DealReward = { kind: "mult"; mult: number } | { kind: "unlock" } | { kind: "discount"; discount: number };

export interface InvestorDef {
  id: string;
  name: string;
  avatar: string;
  personality: string;
  /** Business templates this investor talks to. */
  templates: Template[];
  /** Offer appears from this business day on. */
  fromDay: number;
  minReputation: number;
  goal: DealGoal;
  /** Days to complete the deal after accepting. */
  deadlineDays: number;
  reward: DealReward;
  /** Investor's share of virtual profit after a won deal. */
  share: number;
  pitch: string;
}

export const INVESTORS: InvestorDef[] = [
  {
    id: "oleg", name: "Олег Капустин", avatar: "🧔", personality: "Осторожный, верит только в дисциплину",
    templates: ["offline", "online", "it"], fromDay: 1, minReputation: 30,
    goal: { type: "weekly", amount: 3000, weeks: 4 }, deadlineDays: 30, reward: { kind: "mult", mult: 1.15 }, share: 0.1,
    pitch: "Покажи, что умеешь откладывать каждую неделю, — и я помогу с потоком клиентов.",
  },
  {
    id: "sonya", name: "Соня Сейвина", avatar: "👩‍💼", personality: "Быстрая, любит спринты",
    templates: ["offline", "online", "it"], fromDay: 1, minReputation: 20,
    goal: { type: "window", amount: 10000, days: 7 }, deadlineDays: 7, reward: { kind: "discount", discount: 0.1 }, share: 0.08,
    pitch: "Спринт: 10 000 ₽ в копилку за неделю — и мои поставщики дадут тебе скидку 10%.",
  },
  {
    id: "mira", name: "Мира Звонарёва", avatar: "🦊", personality: "Визионер, ищет звёзд",
    templates: ["offline", "online", "it"], fromDay: 3, minReputation: 40,
    goal: { type: "reach", level: 2, rating: 4.5 }, deadlineDays: 21, reward: { kind: "unlock" }, share: 0.15,
    pitch: "Дорасти до второго уровня с рейтингом 4.5 — открою тебе эксклюзив, которого нет у других.",
  },
  {
    id: "arkhip", name: "Дед Архип", avatar: "👴", personality: "Старая школа: «копейка рубль бережёт»",
    templates: ["offline", "online"], fromDay: 5, minReputation: 30,
    goal: { type: "nowithdraw", days: 14, capital: 15000 }, deadlineDays: 14, reward: { kind: "mult", mult: 1.1 }, share: 0.05,
    pitch: "Две недели ни рубля из копилки и 15 000 ₽ капитала — тогда поговорим.",
  },
  {
    id: "nika", name: "Ника Байт", avatar: "👩‍💻", personality: "Ангел-инвестор из IT, обожает метрики",
    templates: ["it"], fromDay: 2, minReputation: 30,
    goal: { type: "window", amount: 20000, days: 14 }, deadlineDays: 14, reward: { kind: "mult", mult: 1.25 }, share: 0.2,
    pitch: "20 000 ₽ в копилку за две недели — и я заведу тебе пользователей из своего комьюнити.",
  },
];

export const investorOf = (id: string) => INVESTORS.find((i) => i.id === id) ?? null;

export function goalText(g: DealGoal, kind: string): string {
  const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;
  switch (g.type) {
    case "weekly":
      return `Откладывай от ${rub(g.amount)} в неделю ${g.weeks} недели подряд`;
    case "window":
      return `Отложи командой ${rub(g.amount)} за ${g.days} дн.`;
    case "reach":
      return `Достигни уровня «${kindOf(kind).levels[g.level - 1]}» и рейтинга ${g.rating}`;
    case "nowithdraw":
      return `${g.days} дн. без снятий из копилки и капитал от ${rub(g.capital)}`;
  }
}

export function rewardText(r: DealReward, share: number, kind: string): string {
  const pct = `${Math.round(share * 100)}%`;
  const what = kindOf(kind).labels.noun;
  if (r.kind === "mult") return `+${Math.round((r.mult - 1) * 100)}% ${what} навсегда · доля инвестора ${pct} игровой прибыли`;
  if (r.kind === "discount") return `−${Math.round(r.discount * 100)}% к ценам улучшений · доля ${pct} игровой прибыли`;
  return `Эксклюзивное улучшение · доля ${pct} игровой прибыли`;
}

export interface ActiveDeal {
  investorId: string;
  acceptedAt: string; // ISO
  deadline: string; // ISO
  /** Business day when accepted (for reach goals). */
  day: number;
}

export interface LedgerEntry {
  amount: number;
  at: number; // ms
}

export interface DealProgress {
  done: number;
  total: number;
  label: string;
  status: "active" | "won" | "failed";
}

const DAY_MS = 86_400_000;

/** Evaluates a deal from the team's real savings ledger since acceptance and current business stats. */
export function dealProgress(deal: ActiveDeal, ledger: LedgerEntry[], biz: { level: number; rating: number; capital: number }, now: number): DealProgress {
  const inv = investorOf(deal.investorId)!;
  const start = Date.parse(deal.acceptedAt);
  const deadline = Date.parse(deal.deadline);
  const sum = (a: number, b: number) => ledger.filter((e) => e.at >= a && e.at < b).reduce((s, e) => s + e.amount, 0);
  const late = now >= deadline;
  const g = inv.goal;
  if (g.type === "weekly") {
    let done = 0;
    for (let w = 0; w < g.weeks; w++) {
      const a = start + w * 7 * DAY_MS;
      const b = a + 7 * DAY_MS;
      if (a > now) break;
      if (sum(a, b) >= g.amount) done++;
      else if (now >= b) return { done, total: g.weeks, label: `Неделя ${w + 1} не набрала ${g.amount.toLocaleString("ru-RU")} ₽`, status: "failed" };
      else break;
    }
    const cur = Math.max(0, sum(start + done * 7 * DAY_MS, start + (done + 1) * 7 * DAY_MS));
    if (done >= g.weeks) return { done, total: g.weeks, label: "Все недели выполнены", status: "won" };
    return { done, total: g.weeks, label: `Недель: ${done} из ${g.weeks} · эта неделя ${cur.toLocaleString("ru-RU")} из ${g.amount.toLocaleString("ru-RU")} ₽`, status: late ? "failed" : "active" };
  }
  if (g.type === "window") {
    const s = Math.max(0, sum(start, Math.min(now + 1, start + g.days * DAY_MS)));
    if (s >= g.amount) return { done: g.amount, total: g.amount, label: "Цель набрана", status: "won" };
    return { done: s, total: g.amount, label: `${s.toLocaleString("ru-RU")} из ${g.amount.toLocaleString("ru-RU")} ₽`, status: late || now >= start + g.days * DAY_MS ? "failed" : "active" };
  }
  if (g.type === "reach") {
    const ok = biz.level >= g.level && biz.rating >= g.rating;
    const done = (biz.level >= g.level ? 1 : 0) + (biz.rating >= g.rating ? 1 : 0);
    if (ok) return { done: 2, total: 2, label: "Уровень и рейтинг достигнуты", status: "won" };
    return { done, total: 2, label: `Уровень ${biz.level}/${g.level} · рейтинг ${biz.rating.toFixed(2)}/${g.rating}`, status: late ? "failed" : "active" };
  }
  // nowithdraw
  if (ledger.some((e) => e.at >= start && e.amount < 0)) return { done: 0, total: g.days, label: "Было снятие из копилки", status: "failed" };
  const days = Math.min(g.days, Math.floor((now - start) / DAY_MS));
  if (days >= g.days) return biz.capital >= g.capital ? { done: g.days, total: g.days, label: "Выдержали!", status: "won" } : { done: days, total: g.days, label: `Капитал меньше ${g.capital.toLocaleString("ru-RU")} ₽`, status: "failed" };
  return { done: days, total: g.days, label: `${days} из ${g.days} дн. без снятий`, status: "active" };
}

/** Investors currently offering a deal to this business. */
export function offersFor(kind: string, dayNo: number, reputation: number, history: Record<string, string>, hasDeal: boolean): InvestorDef[] {
  if (hasDeal) return [];
  const t = kindOf(kind).template;
  return INVESTORS.filter((i) => i.templates.includes(t) && dayNo >= i.fromDay && reputation >= i.minReputation && !history[i.id]);
}

export const DEAL_FAIL_REPUTATION = 15;
export const DEAL_FAIL_RATING = 0.2;
export const DEAL_WIN_REPUTATION = 10;
export const MAX_EQUITY = 0.49;

// ───────────────────────── story ─────────────────────────

export type StoryGoal =
  | { type: "items"; n: number }
  | { type: "guests"; n: number }
  | { type: "crises"; n: number }
  | { type: "deals"; n: number }
  | { type: "level"; n: number }
  | { type: "rating"; n: number };

export interface ChapterDef {
  title: string;
  goal: StoryGoal;
  coins: number;
  xp: number;
}

const GOALS: ChapterDef[] = [
  { title: "Открой точку", goal: { type: "items", n: 1 }, coins: 10, xp: 10 },
  { title: "Первые 100", goal: { type: "guests", n: 100 }, coins: 15, xp: 15 },
  { title: "Переживи кризис", goal: { type: "crises", n: 1 }, coins: 20, xp: 15 },
  { title: "Репутация 4.0", goal: { type: "rating", n: 4 }, coins: 20, xp: 15 },
  { title: "Привлеки инвестора", goal: { type: "deals", n: 1 }, coins: 25, xp: 20 },
  { title: "Новый уровень", goal: { type: "level", n: 2 }, coins: 25, xp: 20 },
  { title: "Открой второй филиал", goal: { type: "level", n: 3 }, coins: 40, xp: 30 },
];

const NARRATIVE: Record<Template, string[]> = {
  offline: [
    "Ключи от помещения в руке, пахнет краской. Первое улучшение — и дверь открывается для гостей.",
    "Сарафанное радио заработало. Сотня гостей — и соседи уже знают, где лучший {title} района.",
    "Не всё идёт гладко: аренда, поставщики, конкуренты. Настоящий бизнес проверяется кризисом.",
    "Гости оставляют отзывы. Рейтинг 4.0 — и про вас пишут в местных пабликах.",
    "К вам заглянул инвестор. Он не даёт денег — он даёт связи, если вы докажете дисциплину копилкой.",
    "Тесно! Пора на новый уровень: команда, ремонт, больше мест.",
    "Второй филиал. Из одной точки — сеть. Всё это выросло из ваших накоплений.",
  ],
  online: [
    "Домен куплен, витрина собрана. Первое улучшение — и магазин виден в интернете.",
    "Сотня покупателей! Посылки уходят, первые отзывы приходят.",
    "Курьер потерял заказы, реклама подорожала. Переживите первый кризис.",
    "Отзывы с фото, быстрые ответы — рейтинг 4.0 приводит новых покупателей.",
    "Инвестор пишет в директ. Ему нужна дисциплина, а не обещания.",
    "Склад, менеджер, новые категории — магазин вырос.",
    "Пункт выдачи и маркетплейс: у вас уже второй канал продаж.",
  ],
  it: [
    "Ноутбук открыт, репозиторий создан. Первое улучшение — и {title} начинает работать.",
    "Сотня {noun}! Дашборд аналитики больше не пустой.",
    "Ночью упал сервер, пишут злые письма. Переживите первый инцидент.",
    "Баги починены, поддержка отвечает — рейтинг 4.0, отток падает.",
    "Ангел-инвестор зовёт на кофе. Метрики важны, но копилка — главная метрика дисциплины.",
    "Команда растёт: дизайн, QA, бэкенд. Вы — уже не пет-проект.",
    "Выход на новый рынок. {title} стал настоящей компанией.",
  ],
};

export interface ChapterView extends ChapterDef {
  n: number;
  text: string;
  goalText: string;
  progress: number;
  target: number;
}

export function storyChapters(kind: string): (ChapterDef & { n: number; text: string })[] {
  const k = kindOf(kind);
  return GOALS.map((g, i) => ({
    ...g,
    title: i === 1 ? `Первые 100 ${k.labels.noun}` : g.title,
    n: i + 1,
    text: NARRATIVE[k.template][i].replace("{title}", k.title.toLowerCase()).replace("{noun}", k.labels.noun),
  }));
}

export interface StoryStats {
  items: number;
  guests: number;
  crises: number;
  deals: number;
  level: number;
  rating: number;
}

export function chapterProgress(goal: StoryGoal, s: StoryStats): { progress: number; target: number; text: string } {
  const v = { items: s.items, guests: s.guests, crises: s.crises, deals: s.deals, level: s.level, rating: s.rating }[goal.type];
  const text = {
    items: `Купить ${goal.n} улучшение`,
    guests: `Набрать ${goal.n} посетителей всего`,
    crises: `Пережить ${goal.n} кризис`,
    deals: `Закрыть ${goal.n} сделку с инвестором`,
    level: `Дойти до уровня ${goal.n}`,
    rating: `Рейтинг ${goal.n.toFixed(1)}`,
  }[goal.type];
  return { progress: Math.min(goal.n, v), target: goal.n, text };
}

// ───────────────────────── crises ─────────────────────────

export interface CrisisOption {
  id: string;
  label: string;
  /** Capital spent (real savings already in the business; never created). */
  cost: number;
  /** Chance of the good outcome (deterministic roll per business/day/option). */
  chance: number;
  good: CrisisOutcome;
  bad: CrisisOutcome;
}

export interface CrisisOutcome {
  text: string;
  rating: number;
  reputation: number;
  /** Guests multiplier for `days` business days. */
  mult: number;
  days: number;
}

export interface CrisisDef {
  id: string;
  title: string;
  text: string;
  templates: Template[];
  pig: string;
  options: CrisisOption[];
}

const o = (text: string, rating: number, reputation: number, mult = 1, days = 0): CrisisOutcome => ({ text, rating, reputation, mult, days });

export const CRISES: CrisisDef[] = [
  {
    id: "rent", title: "Аренда выросла", text: "Арендодатель поднимает ставку на 20%.", templates: ["offline"], pig: "Аренда — классика жанра. Давай без паники.",
    options: [
      { id: "negotiate", label: "Торговаться", cost: 0, chance: 0.6, good: o("Договорились: ставка почти не выросла", 0.05, 5), bad: o("Не уступил — пришлось сократить часы работы", -0.1, -3, 0.85, 3) },
      { id: "pay", label: "Заплатить из капитала (1 500 ₽)", cost: 1500, chance: 1, good: o("Заплатили — работаем спокойно", 0, 2), bad: o("", 0, 0) },
      { id: "move", label: "Искать новое место", cost: 0, chance: 0.4, good: o("Нашли место дешевле и проходимее!", 0.15, 8, 1.1, 3), bad: o("Переезд затянулся, гости потерялись", -0.2, -5, 0.7, 3) },
    ],
  },
  {
    id: "supplier", title: "Поставщик подвёл", text: "Поставку сорвали, на полках пусто.", templates: ["offline", "online"], pig: "Поставщики подводят всех. Главное — как мы ответим.",
    options: [
      { id: "backup", label: "Срочно найти другого", cost: 0, chance: 0.55, good: o("Новый поставщик даже лучше", 0.1, 5), bad: o("Срочно — значит дорого и плохо", -0.1, -2, 0.9, 2) },
      { id: "honest", label: "Честно предупредить клиентов", cost: 0, chance: 0.8, good: o("Клиенты оценили честность", 0.05, 6, 0.95, 1), bad: o("Часть клиентов ушла к соседям", -0.05, 0, 0.85, 2) },
    ],
  },
  {
    id: "rival", title: "Конкурент открылся рядом", text: "Напротив открылся сетевой конкурент с акциями.", templates: ["offline", "online", "it"], pig: "Конкурент — это повод стать лучше. Ну или понервничать.",
    options: [
      { id: "quality", label: "Делать ставку на качество", cost: 0, chance: 0.65, good: o("Гости вернулись — у нас вкуснее и душевнее", 0.15, 5), bad: o("Первые недели все бегали к новичку", -0.05, 0, 0.85, 3) },
      { id: "promo", label: "Ответная акция (1 000 ₽)", cost: 1000, chance: 0.8, good: o("Акция сработала — поток вырос", 0.05, 3, 1.15, 3), bad: o("Акция потерялась на фоне сетевой", 0, -2, 0.95, 2) },
      { id: "ignore", label: "Ничего не делать", cost: 0, chance: 0.3, good: o("Конкурент закрылся сам", 0, 2), bad: o("Часть постоянных ушла", -0.15, -4, 0.8, 4) },
    ],
  },
  {
    id: "server", title: "Сервер упал", text: "Ночью упал прод, пользователи в ярости.", templates: ["it", "online"], pig: "Всё лежит. Я уже открыл логи… кажется, это был я. Шучу.",
    options: [
      { id: "hotfix", label: "Хотфикс всей командой", cost: 0, chance: 0.6, good: o("Подняли за час, написали разбор", 0.1, 6), bad: o("Хотфикс сломал ещё что-то", -0.2, -4, 0.8, 2) },
      { id: "rollback", label: "Откатить релиз", cost: 0, chance: 0.9, good: o("Откат спас вечер", 0, 3, 0.95, 1), bad: o("Откат не помог, лежали до утра", -0.15, -3, 0.85, 2) },
      { id: "cloud", label: "Докупить мощности (2 000 ₽)", cost: 2000, chance: 1, good: o("Мощностей хватило, всё летает", 0.05, 4, 1.05, 2), bad: o("", 0, 0) },
    ],
  },
  {
    id: "tax", title: "Налоговая проверка", text: "Пришёл запрос документов за квартал.", templates: ["offline", "online", "it"], pig: "Это игра, но порядок в документах — привычка на всю жизнь.",
    options: [
      { id: "docs", label: "Спокойно собрать документы", cost: 0, chance: 0.85, good: o("Проверка прошла без замечаний", 0.05, 6), bad: o("Нашли мелкую ошибку — исправили", -0.05, -1) },
      { id: "accountant", label: "Позвать бухгалтера (1 200 ₽)", cost: 1200, chance: 1, good: o("Бухгалтер всё разрулил", 0.05, 8), bad: o("", 0, 0) },
    ],
  },
  {
    id: "season", title: "Сезонный спад", text: "Праздники позади, все экономят.", templates: ["offline", "online", "it"], pig: "Спад — не провал. Переждём с умом.",
    options: [
      { id: "special", label: "Сезонное предложение", cost: 0, chance: 0.6, good: o("Новинка зашла, спад почти не заметен", 0.05, 3, 1, 0), bad: o("Не зашло, ждём весну", 0, -1, 0.85, 3) },
      { id: "rest", label: "Отпуск команде и ремонт", cost: 0, chance: 0.75, good: o("Команда отдохнула и вернулась с идеями", 0.1, 4, 0.9, 2), bad: o("Отдохнули, но гости забыли дорогу", -0.05, -2, 0.8, 3) },
    ],
  },
  {
    id: "bugs", title: "Волна багов", text: "После релиза посыпались жалобы в поддержку.", templates: ["it"], pig: "Баги — это фичи, о которых мы не договорились. Но чинить надо.",
    options: [
      { id: "freeze", label: "Заморозить фичи, чинить баги", cost: 0, chance: 0.8, good: o("Неделя чистки — и отзывы стали теплее", 0.15, 5), bad: o("Чинили долго, часть ушла", -0.05, -1, 0.9, 2) },
      { id: "ship", label: "Продолжать выпускать фичи", cost: 0, chance: 0.35, good: o("Новая фича перекрыла баги", 0.05, 2, 1.1, 2), bad: o("Отток вырос, рейтинг в сторе упал", -0.25, -5, 0.8, 3) },
    ],
  },
];

export const crisisOf = (id: string) => CRISES.find((c) => c.id === id) ?? null;
export const CRISIS_MIN_GAP = 4;
export const CRISIS_FORCE_GAP = 6;
/** An unresolved crisis resolves itself (badly) after this many business days. */
export const CRISIS_EXPIRE_DAYS = 3;

/** Deterministic crisis start for a business day, or null. */
export function crisisFor(seed: number, dayNo: number, kind: string, lastCrisisDay: number): CrisisDef | null {
  const gap = dayNo - lastCrisisDay;
  if (gap < CRISIS_MIN_GAP) return null;
  const r = rng(hashSeed(seed, dayNo, "crisis"));
  if (gap < CRISIS_FORCE_GAP && r() >= 0.4) return null;
  const t = kindOf(kind).template;
  const pool = CRISES.filter((c) => c.templates.includes(t));
  return pool[Math.floor(r() * pool.length)] ?? null;
}

/** Server-side deterministic outcome of a crisis choice. */
export function crisisOutcome(seed: number, day: number, crisisId: string, opt: CrisisOption): { good: boolean; outcome: CrisisOutcome } {
  const roll = rng(hashSeed(seed, day, crisisId, opt.id, "outcome"))();
  const good = roll < opt.chance;
  return { good, outcome: good ? opt.good : opt.bad };
}

export type { BizKind };
