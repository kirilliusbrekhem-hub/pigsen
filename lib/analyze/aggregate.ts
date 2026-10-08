// Turns categorized transactions into the aggregated result that is shown and stored (no raw rows).
import { categoryLabel, merchantKey, type CategoryId } from "./categorize";
import type { Tx } from "./parse";

export interface CategoryTotal {
  id: string;
  label: string;
  total: number;
  count: number;
  share: number;
}
export interface Leak {
  kind: "subs" | "small" | "delivery" | "cafe" | "taxi";
  title: string;
  note: string;
  monthly: number;
  total: number;
}
export interface MonthTotal {
  month: string;
  total: number;
}
export interface AnalysisResult {
  total: number;
  txCount: number;
  from: string | null;
  to: string | null;
  months: number;
  monthlyAvg: number;
  categories: CategoryTotal[];
  monthTotals: MonthTotal[];
  monthCompare: { prev: string; last: string; prevTotal: number; lastTotal: number; diffPct: number; movers: { label: string; diff: number }[] } | null;
  leaks: Leak[];
  topMerchants: { name: string; total: number; count: number }[];
  suggestedMonthly: number;
  recommendations: string[];
  aiUsed: boolean;
}

const r0 = (n: number) => Math.round(n);
const fmt = (n: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(n))} ₽`;

export function aggregate(txs: Tx[], cats: CategoryId[]): AnalysisResult {
  const total = txs.reduce((s, t) => s + t.amount, 0);
  const dates = txs.map((t) => t.date).filter((d): d is string => !!d).sort();
  const from = dates[0] ?? null;
  const to = dates.at(-1) ?? null;
  const spanDays = from && to ? (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1 : 30;
  const months = Math.max(1, Math.round((spanDays / 30.44) * 10) / 10);
  const perMonth = (n: number) => n / months;

  const byCat = new Map<string, { total: number; count: number }>();
  txs.forEach((t, i) => {
    const c = byCat.get(cats[i]) ?? { total: 0, count: 0 };
    c.total += t.amount;
    c.count++;
    byCat.set(cats[i], c);
  });
  const categories = [...byCat]
    .map(([id, v]) => ({ id, label: categoryLabel(id), total: r0(v.total), count: v.count, share: total ? Math.round((v.total / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total);

  const byMonth = new Map<string, Map<string, number>>();
  txs.forEach((t, i) => {
    if (!t.date) return;
    const m = t.date.slice(0, 7);
    const mm = byMonth.get(m) ?? new Map<string, number>();
    mm.set(cats[i], (mm.get(cats[i]) ?? 0) + t.amount);
    byMonth.set(m, mm);
  });
  const monthTotals = [...byMonth.keys()].sort().map((m) => ({ month: m, total: r0([...byMonth.get(m)!.values()].reduce((a, b) => a + b, 0)) }));
  let monthCompare: AnalysisResult["monthCompare"] = null;
  if (monthTotals.length >= 2) {
    const [p, l] = monthTotals.slice(-2);
    const pm = byMonth.get(p.month)!;
    const lm = byMonth.get(l.month)!;
    const ids = new Set([...pm.keys(), ...lm.keys()]);
    const movers = [...ids]
      .map((id) => ({ label: categoryLabel(id), diff: r0((lm.get(id) ?? 0) - (pm.get(id) ?? 0)) }))
      .filter((x) => x.diff !== 0)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 3);
    monthCompare = { prev: p.month, last: l.month, prevTotal: p.total, lastTotal: l.total, diffPct: p.total ? Math.round(((l.total - p.total) / p.total) * 100) : 0, movers };
  }

  const merchants = new Map<string, { name: string; total: number; count: number; cat: string; small: number; smallTotal: number }>();
  txs.forEach((t, i) => {
    const k = merchantKey(t.description) || "—";
    const m = merchants.get(k) ?? { name: t.description.slice(0, 40), total: 0, count: 0, cat: cats[i], small: 0, smallTotal: 0 };
    m.total += t.amount;
    m.count++;
    if (t.amount <= 500) {
      m.small++;
      m.smallTotal += t.amount;
    }
    merchants.set(k, m);
  });
  const shoppable = [...merchants.values()].filter((m) => m.cat !== "transfers" && m.cat !== "cash");
  const topMerchants = shoppable.sort((a, b) => b.total - a.total).slice(0, 5).map((m) => ({ name: m.name, total: r0(m.total), count: m.count }));

  const leaks: Leak[] = [];
  const cat = (id: string) => byCat.get(id) ?? { total: 0, count: 0 };
  if (cat("subs").count) {
    const names = shoppable.filter((m) => m.cat === "subs").sort((a, b) => b.total - a.total).slice(0, 3).map((m) => m.name);
    leaks.push({ kind: "subs", title: "Подписки", note: `${cat("subs").count} списаний: ${names.join(", ")}. Проверьте, чем реально пользуетесь.`, monthly: r0(perMonth(cat("subs").total)), total: r0(cat("subs").total) });
  }
  const small = shoppable.filter((m) => m.small >= 5 && m.cat !== "subs");
  const smallTotal = small.reduce((s, m) => s + m.smallTotal, 0);
  const smallCount = small.reduce((s, m) => s + m.small, 0);
  if (smallCount >= 5) {
    leaks.push({ kind: "small", title: "Мелкие частые покупки", note: `${smallCount} покупок до 500 ₽ в ${small.slice(0, 3).map((m) => m.name).join(", ")}. По отдельности незаметно, вместе — ощутимо.`, monthly: r0(perMonth(smallTotal)), total: r0(smallTotal) });
  }
  if (cat("delivery").count) leaks.push({ kind: "delivery", title: "Доставка", note: `${cat("delivery").count} заказов. Сборы за доставку и наценка съедают до трети чека.`, monthly: r0(perMonth(cat("delivery").total)), total: r0(cat("delivery").total) });
  if (cat("cafe").count >= 4) leaks.push({ kind: "cafe", title: "Кафе и кофе с собой", note: `${cat("cafe").count} чеков. Средний — ${fmt(cat("cafe").total / cat("cafe").count)}.`, monthly: r0(perMonth(cat("cafe").total)), total: r0(cat("cafe").total) });
  if (cat("taxi").count >= 3) leaks.push({ kind: "taxi", title: "Такси", note: `${cat("taxi").count} поездок, в среднем ${fmt(cat("taxi").total / cat("taxi").count)}.`, monthly: r0(perMonth(cat("taxi").total)), total: r0(cat("taxi").total) });
  leaks.sort((a, b) => b.monthly - a.monthly);

  const cut = leaks.slice(0, 3).reduce((s, l) => s + l.monthly * (l.kind === "subs" ? 0.5 : 0.3), 0);
  const suggestedMonthly = Math.max(500, Math.round(Math.max(cut, (total / months) * 0.05) / 100) * 100);

  const res: AnalysisResult = {
    total: r0(total),
    txCount: txs.length,
    from,
    to,
    months,
    monthlyAvg: r0(total / months),
    categories,
    monthTotals,
    monthCompare,
    leaks: leaks.slice(0, 4),
    topMerchants,
    suggestedMonthly,
    recommendations: [],
    aiUsed: false,
  };
  res.recommendations = ruleRecommendations(res);
  return res;
}

/** Three concrete tips from the numbers; used as-is in demo mode and as a fallback when AI output doesn't validate. */
export function ruleRecommendations(r: AnalysisResult): string[] {
  const out: string[] = [];
  for (const l of r.leaks) {
    if (out.length >= 2) break;
    if (l.kind === "subs") out.push(`Отключите хотя бы половину подписок: это около ${fmt(l.monthly / 2)} в месяц. Оставьте одну семейную вместо нескольких личных.`);
    if (l.kind === "small") out.push(`Мелкие покупки — ${fmt(l.monthly)} в месяц. Поставьте лимит на неделю (например, ${fmt((l.monthly / 4.3) * 0.7)}) и переводите остаток в копилку.`);
    if (l.kind === "delivery") out.push(`Доставка стоит ${fmt(l.monthly)} в месяц. Закупайтесь продуктами раз в неделю по списку и заказывайте не чаще двух раз в неделю — экономия около ${fmt(l.monthly * 0.4)}.`);
    if (l.kind === "cafe") out.push(`На кафе уходит ${fmt(l.monthly)} в месяц. Кофе из дома в будни сэкономит около ${fmt(l.monthly * 0.3)}.`);
    if (l.kind === "taxi") out.push(`Такси — ${fmt(l.monthly)} в месяц. Замените пару поездок в неделю на метро или каршеринг и сохраните около ${fmt(l.monthly * 0.35)}.`);
  }
  const top = r.categories.find((c) => !["transfers", "cash", "other"].includes(c.id));
  if (top && out.length < 3) out.push(`Больше всего уходит на «${top.label}» — ${top.share}% трат. Задайте месячный бюджет на эту категорию на 10% ниже текущего (${fmt((top.total / r.months) * 0.9)}).`);
  if (r.monthCompare && r.monthCompare.diffPct > 5 && out.length < 3) out.push(`В ${r.monthCompare.last} траты выросли на ${r.monthCompare.diffPct}%. Найдите, что изменилось, и верните расходы к уровню прошлого месяца.`);
  if (out.length < 3) out.push(`Автоматизируйте накопления: откладывайте ${fmt(r.suggestedMonthly)} в день зарплаты, пока деньги ещё не потрачены.`);
  if (out.length < 3) out.push("Заведите правило 24 часов для покупок дороже 3 000 ₽: если завтра всё ещё нужно — покупайте.");
  return out.slice(0, 3);
}
