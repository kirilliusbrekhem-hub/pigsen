import "server-only";
import { confirmedLedger } from "@/lib/savings/proof";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { advisoryLock } from "@/lib/db/lock";
import { HttpError } from "@/lib/api/http";
import { isPro } from "@/lib/billing/plan";
import { addCoins } from "@/lib/coins/service";
import { awardXp } from "@/lib/gamification/service";
import { ACCENTS, LOGOS, isChallengeItem, kindOf, type BizKind } from "./catalog";
import { clampRating, freshState, levelOf, metrics, parseState, type Custom, type GameState, type OwnedItem } from "./engine";
import {
  DEAL_FAIL_RATING,
  DEAL_FAIL_REPUTATION,
  DEAL_WIN_REPUTATION,
  MAX_EQUITY,
  chapterProgress,
  crisisOf,
  crisisOutcome,
  dealProgress,
  investorOf,
  offersFor,
  storyChapters,
  type LedgerEntry,
} from "./game";

/**
 * Kapital game actions: business switching, Pro custom skin, investor deals, story chapters and crises.
 * Every mutation runs under the business advisory lock and re-reads state inside the transaction.
 * None of them adds capital: capital only moves with real savings (lib/biz/service.ts onSavingsChange) or is spent.
 */

type Tx = Prisma.TransactionClient;
interface Actor {
  id: string;
  name: string;
  profile: { proUntil: Date | null; proTier?: string | null } | null | undefined;
}

const PIG = "CAP";
const lockKey = (id: string) => `biz:${id}`;
const asJson = (s: GameState) => s as unknown as Prisma.InputJsonValue;
const rubs = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
const claimKey = async (userId: string, key: string) => (await prisma.dailyClaim.createMany({ data: [{ userId, key }], skipDuplicates: true })).count > 0;

async function memberOrThrow(userId: string) {
  const m = await prisma.bizMember.findUnique({ where: { userId } });
  if (!m) throw new HttpError(404, "У вас пока нет бизнеса");
  return m;
}

/** Locks the business and re-checks membership inside the transaction. */
async function lockedBiz(tx: Tx, userId: string, businessId: string) {
  await advisoryLock(tx, lockKey(businessId));
  const me = await tx.bizMember.findUnique({ where: { userId } });
  if (!me || me.businessId !== businessId) throw new HttpError(403, "Вы не в этой команде");
  const b = await tx.bizBusiness.findUniqueOrThrow({ where: { id: businessId }, include: { upgrades: true } });
  return { me, b, st: parseState(b.state), owned: b.upgrades as OwnedItem[] };
}

// ───────────────────────── custom (Pro) ─────────────────────────

export interface CustomInput {
  emoji: string;
  accent: string;
  names?: Record<string, string>;
}

const cleanItemName = (s: string) => s.replace(/[\u0000-\u001F\u007F<>{}]/g, "").replace(/\s+/g, " ").trim().slice(0, 30);

/** Validates a custom skin against the kind's catalog. Throws 402 for non-Pro. */
export function checkCustom(kind: string, c: CustomInput, pro: boolean): Custom {
  if (!pro) throw new HttpError(402, "«Свой бизнес» доступен в Pro");
  if (!(LOGOS as readonly string[]).includes(c.emoji)) throw new HttpError(422, "Выберите логотип из списка");
  if (!(ACCENTS as readonly string[]).includes(c.accent)) throw new HttpError(422, "Выберите оттенок зелёного из списка");
  const ids = new Set(kindOf(kind).catalog.map((x) => x.id));
  const names: Record<string, string> = {};
  for (const [id, v] of Object.entries(c.names ?? {})) {
    if (!ids.has(id)) continue;
    const n = cleanItemName(v);
    if (n.length >= 2) names[id] = n;
  }
  return { emoji: c.emoji, accent: c.accent, names };
}

export async function updateCustom(user: Actor, c: CustomInput) {
  const m = await memberOrThrow(user.id);
  await prisma.$transaction(async (tx) => {
    const { me, b, st } = await lockedBiz(tx, user.id, m.businessId);
    if (me.role !== "founder") throw new HttpError(403, "Оформление меняет основатель");
    st.custom = checkCustom(b.kind, c, isPro(user.profile));
    await tx.bizBusiness.update({ where: { id: b.id }, data: { state: asJson(st) } });
    await tx.bizEvent.create({ data: { businessId: b.id, kind: "custom", text: `${me.name} обновил(а) оформление бизнеса ${st.custom.emoji}`, userId: user.id } });
  });
}

// ───────────────────────── switching type ─────────────────────────

/**
 * Switching type = a new business on the same team: upgrades, story, investors and crises reset; capital stays as is
 * (it mirrors the team's real savings, so it's neither lost nor created). Unique challenge items (ch-*) stay.
 */
export async function switchBusiness(user: Actor, kind: BizKind, name: string, custom: CustomInput | null) {
  const k = kindOf(kind);
  if (!k.available) throw new HttpError(422, "Этот вид бизнеса скоро появится");
  const m = await memberOrThrow(user.id);
  const pro = isPro(user.profile);
  const cust = custom ? checkCustom(kind, custom, pro) : null;
  await prisma.$transaction(async (tx) => {
    const { me, b } = await lockedBiz(tx, user.id, m.businessId);
    if (me.role !== "founder") throw new HttpError(403, "Сменить бизнес может только основатель");
    await tx.bizUpgrade.deleteMany({ where: { businessId: b.id, NOT: { itemId: { startsWith: "ch-" } } } });
    const st = freshState(cust);
    st.stats.lastCrisisDay = b.dayNo;
    await tx.bizBusiness.update({ where: { id: b.id }, data: { kind, name: name || k.title, rating: 3, maxLevel: 1, state: asJson(st) } });
    await tx.bizEvent.create({ data: { businessId: b.id, kind: "switch", text: `${me.name} открыл(а) новый бизнес: ${k.title} «${name || k.title}». Капитал ${rubs(b.capital)} остался — это ваши накопления.`, userId: user.id } });
    await tx.bizChat.create({ data: { businessId: b.id, name: PIG, text: `Новая глава! Теперь мы — ${k.title.toLowerCase()}. Капитал на месте, остальное построим заново.` } });
  });
}

// ───────────────────────── investors ─────────────────────────

const DAY_MS = 86_400_000;

/** Deal progress counts only screenshot-confirmed deposits (minus withdrawals) of the team's members: see confirmedSavings(). */
async function ledger(tx: Tx, businessId: string, since: Date): Promise<LedgerEntry[]> {
  const members = await tx.bizMember.findMany({ where: { businessId }, select: { userId: true } });
  return confirmedLedger(members.map((m) => m.userId), since);
}

export async function dealAction(user: Actor, investorId: string, action: "accept" | "decline") {
  const inv = investorOf(investorId);
  if (!inv) throw new HttpError(404, "Инвестор не найден");
  const m = await memberOrThrow(user.id);
  await prisma.$transaction(async (tx) => {
    const { me, b, st } = await lockedBiz(tx, user.id, m.businessId);
    if (me.role !== "founder") throw new HttpError(403, "Сделки с инвесторами заключает основатель");
    if (!offersFor(b.kind, b.dayNo, st.reputation, st.investors, !!st.deal).some((o) => o.id === inv.id)) throw new HttpError(409, st.deal ? "Сначала закончите текущую сделку" : "Этот инвестор сейчас не предлагает сделку");
    if (action === "decline") {
      st.investors[inv.id] = "declined";
      await tx.bizEvent.create({ data: { businessId: b.id, kind: "investor", text: `${me.name} вежливо отказал(а) инвестору ${inv.name}`, userId: user.id } });
    } else {
      const now = Date.now();
      st.deal = { investorId: inv.id, acceptedAt: new Date(now).toISOString(), deadline: new Date(now + inv.deadlineDays * DAY_MS).toISOString(), day: b.dayNo };
      await tx.bizEvent.create({ data: { businessId: b.id, kind: "investor", text: `Сделка с инвестором ${inv.name}: срок ${inv.deadlineDays} дн.`, userId: user.id } });
      await tx.bizChat.create({ data: { businessId: b.id, name: PIG, text: `${inv.name} в деле — если выполним условия. Копилка решает, партнёр!` } });
    }
    await tx.bizBusiness.update({ where: { id: b.id }, data: { state: asJson(st) } });
  });
}

/** Settles an active deal (won / failed) from the real savings ledger. Called on every view. */
export async function settleDeal(businessId: string): Promise<void> {
  const peek = await prisma.bizBusiness.findUnique({ where: { id: businessId }, select: { state: true } });
  if (!peek || !parseState(peek.state).deal) return;
  await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, lockKey(businessId));
    const b = await tx.bizBusiness.findUnique({ where: { id: businessId }, include: { upgrades: true } });
    if (!b) return;
    const st = parseState(b.state);
    if (!st.deal) return;
    const inv = investorOf(st.deal.investorId);
    if (!inv) {
      st.deal = null;
      await tx.bizBusiness.update({ where: { id: b.id }, data: { state: asJson(st) } });
      return;
    }
    const lg = await ledger(tx, b.id, new Date(st.deal.acceptedAt));
    const p = dealProgress(st.deal, lg, { level: levelOf(b.kind, b.upgrades), rating: b.rating, capital: b.capital }, Date.now());
    if (p.status === "active") return;
    let rating = b.rating;
    if (p.status === "won") {
      st.investors[inv.id] = "won";
      st.stats.dealsWon++;
      st.reputation = Math.min(100, st.reputation + DEAL_WIN_REPUTATION);
      st.equity = Math.min(MAX_EQUITY, Math.round((st.equity + inv.share) * 100) / 100);
      if (inv.reward.kind === "mult") st.boost.mult = Math.round(Math.min(3, st.boost.mult * inv.reward.mult) * 100) / 100;
      if (inv.reward.kind === "discount") st.boost.discount = Math.min(0.3, Math.round((st.boost.discount + inv.reward.discount) * 100) / 100);
      if (inv.reward.kind === "unlock") {
        const ex = kindOf(b.kind).catalog.find((x) => x.exclusive);
        if (ex && !st.boost.unlocks.includes(ex.id)) st.boost.unlocks.push(ex.id);
      }
      await tx.bizEvent.create({ data: { businessId: b.id, kind: "investor", text: `Сделка с ${inv.name} закрыта! Бонус получен, доля инвестора в игровой прибыли теперь ${Math.round(st.equity * 100)}%` } });
      await tx.bizChat.create({ data: { businessId: b.id, name: PIG, text: `${inv.name} доволен(на) нами. Дисциплина копилки — лучший питч!` } });
    } else {
      st.investors[inv.id] = "failed";
      st.stats.dealsFailed++;
      st.reputation = Math.max(0, st.reputation - DEAL_FAIL_REPUTATION);
      rating = clampRating(rating - DEAL_FAIL_RATING);
      await tx.bizEvent.create({ data: { businessId: b.id, kind: "investor-fail", text: `Сделка с ${inv.name} сорвалась: ${p.label}. Репутация −${DEAL_FAIL_REPUTATION}, рейтинг −${DEAL_FAIL_RATING}` } });
      await tx.bizChat.create({ data: { businessId: b.id, name: PIG, text: `Не вышло с ${inv.name}. Бывает — следующий инвестор увидит, что мы учимся.` } });
    }
    st.deal = null;
    await tx.bizBusiness.update({ where: { id: b.id }, data: { rating, state: asJson(st) } });
  });
}

export async function dealView(businessId: string, kind: string, st: GameState, biz: { level: number; rating: number; capital: number; dayNo: number }) {
  if (!st.deal) return null;
  const inv = investorOf(st.deal.investorId);
  if (!inv) return null;
  const lg = await ledger(prisma, businessId, new Date(st.deal.acceptedAt));
  return { investorId: inv.id, deadline: st.deal.deadline, progress: dealProgress(st.deal, lg, biz, Date.now()) };
}

// ───────────────────────── story ─────────────────────────

export function storyState(kind: string, st: GameState, s: { items: number; guestsToday: number; level: number; rating: number }) {
  const stats = { items: s.items, guests: st.stats.guests + s.guestsToday, crises: st.stats.crises, deals: st.stats.dealsWon, level: s.level, rating: s.rating };
  return storyChapters(kind).map((c, i) => {
    const p = chapterProgress(c.goal, stats);
    return { n: c.n, title: c.title, text: c.text, goalText: p.text, progress: p.progress, target: p.target, coins: c.coins, xp: c.xp, status: i < st.story ? "done" : i === st.story ? (p.progress >= p.target ? "ready" : "current") : "locked" };
  });
}

/** Completes the current chapter when its goal is met; every current member gets the reward once per kind+chapter for life. */
export async function claimStory(user: Actor) {
  const m = await memberOrThrow(user.id);
  const r = await prisma.$transaction(async (tx) => {
    const { b, st, owned } = await lockedBiz(tx, user.id, m.businessId);
    const level = levelOf(b.kind, owned);
    const guestsToday = metrics(b.kind, owned, b.rating, st, b.dayNo).guests;
    const ch = storyState(b.kind, st, { items: owned.filter((o) => !isChallengeItem(o.itemId)).length, guestsToday, level, rating: b.rating })[st.story];
    if (!ch) throw new HttpError(409, "История пройдена до конца");
    if (ch.status !== "ready") throw new HttpError(409, `Глава ещё не выполнена: ${ch.goalText}`);
    st.story++;
    await tx.bizBusiness.update({ where: { id: b.id }, data: { state: asJson(st) } });
    await tx.bizEvent.create({ data: { businessId: b.id, kind: "story", text: `Глава ${ch.n} «${ch.title}» пройдена! Каждому в команде +${ch.coins} PigCoin$ и +${ch.xp} XP` } });
    const members = await tx.bizMember.findMany({ where: { businessId: b.id }, select: { userId: true } });
    return { ch, kind: b.kind, members: members.map((x) => x.userId) };
  });
  let coins = 0;
  for (const uid of r.members) {
    if (await claimKey(uid, `biz-story:${r.kind}:${r.ch.n}`)) {
      const c = await addCoins(uid, r.ch.coins, `biz-story:${r.kind}:${r.ch.n}`);
      await awardXp(uid, r.ch.xp).catch(() => null);
      if (uid === user.id) coins = c;
    }
  }
  return { chapter: r.ch.n, coins, xp: coins ? r.ch.xp : 0 };
}

// ───────────────────────── crises ─────────────────────────

export function crisisView(st: GameState, capital: number) {
  if (!st.crisis) return null;
  const c = crisisOf(st.crisis.id);
  if (!c) return null;
  return {
    id: c.id,
    title: c.title,
    text: c.text,
    pig: c.pig,
    day: st.crisis.day,
    options: c.options.map((o) => ({ id: o.id, label: o.label, cost: o.cost, chance: Math.round(o.chance * 100), affordable: capital >= o.cost })),
  };
}

export async function resolveCrisis(user: Actor, crisisId: string, optionId: string) {
  const m = await memberOrThrow(user.id);
  return prisma.$transaction(async (tx) => {
    const { me, b, st } = await lockedBiz(tx, user.id, m.businessId);
    if (!st.crisis || st.crisis.id !== crisisId) throw new HttpError(409, "Этот кризис уже решён");
    const c = crisisOf(st.crisis.id);
    const opt = c?.options.find((o) => o.id === optionId);
    if (!c || !opt) throw new HttpError(404, "Нет такого варианта");
    if (b.capital < opt.cost) throw new HttpError(422, `Не хватает капитала: нужно ${rubs(opt.cost)}. Отложите в копилку`);
    const { good, outcome } = crisisOutcome(b.seed, st.crisis.day, c.id, opt);
    st.reputation = Math.max(0, Math.min(100, st.reputation + outcome.reputation));
    if (outcome.mult !== 1 && outcome.days > 0) st.mods = [...st.mods.filter((x) => x.until >= b.dayNo), { mult: outcome.mult, until: b.dayNo + outcome.days }];
    st.stats.crises++;
    st.crisis = null;
    const rating = clampRating(b.rating + outcome.rating);
    await tx.bizBusiness.update({ where: { id: b.id }, data: { rating, capital: b.capital - opt.cost, state: asJson(st) } });
    const fx = [outcome.rating ? `рейтинг ${outcome.rating > 0 ? "+" : ""}${outcome.rating}` : "", outcome.reputation ? `репутация ${outcome.reputation > 0 ? "+" : ""}${outcome.reputation}` : "", outcome.days ? `${outcome.mult > 1 ? "+" : "−"}${Math.round(Math.abs(outcome.mult - 1) * 100)}% посетителей на ${outcome.days} дн.` : "", opt.cost ? `потрачено ${rubs(opt.cost)} капитала` : ""].filter(Boolean).join(", ");
    await tx.bizEvent.create({ data: { businessId: b.id, kind: good ? "crisis-ok" : "crisis-bad", text: `Кризис «${c.title}»: ${me.name} выбрал(а) «${opt.label}». ${outcome.text}${fx ? ` (${fx})` : ""}`, userId: user.id, amount: opt.cost ? -opt.cost : null } });
    await tx.bizChat.create({ data: { businessId: b.id, name: PIG, text: good ? `Выкрутились! «${opt.label}» — отличный ход.` : `Ну… «${opt.label}» сработало не так, как я надеялся. Учтём.` } });
    return { good, text: outcome.text, rating: outcome.rating, reputation: outcome.reputation, mult: outcome.mult, days: outcome.days, cost: opt.cost };
  });
}
