import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { advisoryLock, isUniqueViolation } from "@/lib/db/lock";
import { HttpError } from "@/lib/api/http";
import { isPro, teamCap } from "@/lib/billing/plan";
import { addCoins } from "@/lib/coins/service";
import { awardXp } from "@/lib/gamification/service";
import {
  KINDS,
  MAX_SIM_DAYS,
  availability,
  bestPick,
  clampRating,
  dayKey,
  daysBetween,
  eventFor,
  itemOf,
  kindOf,
  levelOf,
  metrics,
  nextLevelNeeds,
  parseState,
  pickHint,
  repairPrice,
  withdrawalHit,
  freshState,
  moodLabel,
  priceOf,
  type BizKind,
  type GameState,
  type OwnedItem,
} from "./engine";
import { ACCENTS, LOGOS, TEMPLATE_TITLES, isChallengeItem } from "./catalog";
import { goalText, investorOf, offersFor, rewardText, crisisFor, crisisOf, CRISIS_EXPIRE_DAYS } from "./game";
import { checkCustom, crisisView, dealView, settleDeal, storyState, type CustomInput } from "./play";
import { grantApprovedItems } from "./proofs";
import { challengeView, weekStart } from "./challenges";
import { confirmedDeposits, confirmedSavingsMany } from "@/lib/savings/proof";
import { PIG_PARTNER_LOCK } from "@/lib/ai/pigMode";
import { chatReply, depositLine, hintLine, isForPig, pigVoice, revealLine, teaserLine, withdrawLine } from "./pig";

type Tx = Prisma.TransactionClient;
type PlanProfile = { proUntil: Date | null; proTier?: string | null } | null | undefined;
interface Actor {
  id: string;
  name: string;
  profile: PlanProfile;
}

const MAX_CAPITAL = 1_500_000_000;
export const PIG_NAME = "CAP";
const rubs = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
/** Business/team display names: no control chars, markup or runs of whitespace. */
export const cleanName = (s: string) => s.replace(/[\u0000-\u001F\u007F<>{}]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
const newCode = () => randomBytes(12).toString("base64url");
const lockKey = (id: string) => `biz:${id}`;
const asJson = (s: GameState) => s as unknown as Prisma.InputJsonValue;

/** Team size (founder included, CAP not counted) by the founder's plan: Free 2, Pro 4, Pro 7, Pro 10. */
async function founderCap(founderId: string) {
  return teamCap(await prisma.profile.findUnique({ where: { userId: founderId }, select: { proUntil: true, proTier: true } }));
}

/** CAP acts as a partner in a team only while its founder is on Pro (any tier). */
async function teamPigPartner(businessId: string): Promise<boolean> {
  const b = await prisma.bizBusiness.findUnique({ where: { id: businessId }, select: { founderId: true } });
  if (!b) return false;
  return isPro(await prisma.profile.findUnique({ where: { userId: b.founderId }, select: { proUntil: true } }));
}

/** Inserts a one-time claim key; true only for the caller that inserted it. */
const claimKey = async (userId: string, key: string) => (await prisma.dailyClaim.createMany({ data: [{ userId, key }], skipDuplicates: true })).count > 0;

async function memberOf(userId: string) {
  return prisma.bizMember.findUnique({ where: { userId } });
}

async function requireMember(userId: string) {
  const m = await memberOf(userId);
  if (!m) throw new HttpError(404, "У вас пока нет бизнеса");
  return m;
}

// ───────────────────────── create / view ─────────────────────────

export async function createBusiness(user: Actor, kind: BizKind, name: string, customIn: CustomInput | null = null) {
  if (!KINDS[kind]?.available) throw new HttpError(422, "Этот вид бизнеса скоро появится");
  const custom = customIn ? checkCustom(kind, customIn, isPro(user.profile)) : null;
  const today = dayKey();
  try {
    return await prisma.$transaction(async (tx) => {
      await advisoryLock(tx, `biz-user:${user.id}`);
      if (await tx.bizMember.findUnique({ where: { userId: user.id } })) throw new HttpError(409, "У вас уже есть бизнес. Сначала выйдите из него.");
      const seed = randomBytes(4).readUInt32BE(0) >>> 1;
      const b = await tx.bizBusiness.create({
        data: {
          kind,
          name: cleanName(name) || KINDS[kind].title,
          founderId: user.id,
          inviteCode: newCode(),
          lastDay: today,
          seed,
          state: asJson(freshState(custom)),
          members: { create: { userId: user.id, name: cleanName(user.name) || "Основатель", role: "founder" } },
        },
      });
      await tx.bizEvent.create({ data: { businessId: b.id, kind: "open", text: `${user.name} открыл(а) «${name}». Капитал растёт с каждым взносом в копилку.`, userId: user.id } });
      const hint = pickHint(kind, [], isPro(user.profile), seed, 1);
      const hintText = hint ? hintLine(itemOf(kind, hint.itemId)!.title, itemOf(kind, hint.itemId)!.hint) : "";
      await tx.bizChat.create({
        data: { businessId: b.id, name: PIG_NAME, text: `Партнёр, я в деле! Я твой ИИ-сооснователь: подсказываю, иногда ошибаюсь, но всегда признаюсь. Отложи в копилку — и у нас появится капитал. ${hintText}`.trim() },
      });
      if (hint) await tx.bizBusiness.update({ where: { id: b.id }, data: { state: asJson({ ...freshState(custom), hint: { ...hint, day: 1 } }) } });
      await grantApprovedItems(tx, user.id, b.id);
      return b;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, "У вас уже есть бизнес");
    throw e;
  }
}

/** Simulates the business days missed since the last visit (max 7). Exactly one request does it per day. */
async function rollover(businessId: string, pro: boolean): Promise<{ chat: string | null; facts: string } | null> {
  const today = dayKey();
  return prisma.$transaction(async (tx) => {
    await advisoryLock(tx, lockKey(businessId));
    const b = await tx.bizBusiness.findUnique({ where: { id: businessId }, include: { upgrades: true } });
    if (!b || b.lastDay >= today) return null;
    const gap = Math.max(1, daysBetween(b.lastDay, today));
    const days = Math.min(MAX_SIM_DAYS, gap);
    const owned: OwnedItem[] = b.upgrades;
    const st = parseState(b.state);
    let rating = b.rating;
    let dayNo = b.dayNo;
    let revenue = b.revenue;
    let penalty = st.penalty;
    let reveal = "";
    const events: { kind: string; text: string }[] = [];
    let ev = eventFor(b.seed, dayNo, owned, b.kind);
    let crisisLine = "";
    const noun = kindOf(b.kind).labels.guestsShort;
    for (let i = 0; i < days; i++) {
      dayNo++;
      ev = eventFor(b.seed, dayNo, owned, b.kind);
      let mult = ev.mult;
      let text = ev.text;
      let dr = ev.rating;
      // Yesterday's hint resolves on the first simulated day.
      if (i === 0 && st.hint) {
        const item = itemOf(b.kind, st.hint.itemId);
        // A hinted item was never owned at hint time, so owning it now means the team followed the hint.
        const bought = owned.some((o) => o.itemId === st.hint!.itemId);
        if (item) {
          reveal = revealLine(item.title, st.hint.wrong, bought);
          if (bought && st.hint.wrong) {
            mult *= 0.92;
            dr -= 0.1;
            text = `${text}. «${item.title}» гостям не зашла — CAP ошибся с советом`;
          } else if (bought) {
            dr += 0.1;
            text = `${text}. Гости хвалят «${item.title}»`;
          }
        }
      }
      // Crises: an ignored one resolves itself badly; otherwise a new one may start (deterministic per day).
      if (st.crisis && dayNo - st.crisis.day >= CRISIS_EXPIRE_DAYS) {
        const c = crisisOf(st.crisis.id);
        const worst = c ? [...c.options].sort((x, y) => x.chance - y.chance)[0] : null;
        if (c && worst) {
          dr += worst.bad.rating;
          st.reputation = Math.max(0, Math.min(100, st.reputation + worst.bad.reputation - 5));
          if (worst.bad.days) st.mods.push({ mult: worst.bad.mult, until: dayNo + worst.bad.days });
          events.push({ kind: "crisis-bad", text: `Кризис «${c.title}» остался без решения: ${worst.bad.text}. Репутация ${worst.bad.reputation - 5}` });
        }
        st.crisis = null;
      } else if (!st.crisis) {
        const c = crisisFor(b.seed, dayNo, b.kind, st.stats.lastCrisisDay);
        if (c) {
          st.crisis = { id: c.id, day: dayNo };
          st.stats.lastCrisisDay = dayNo;
          events.push({ kind: "crisis", text: `Кризис: ${c.title}. ${c.text} Команда должна выбрать решение.` });
          crisisLine = c.pig;
        }
      }
      st.mods = st.mods.filter((x) => x.until >= dayNo);
      const m = metrics(b.kind, owned, rating, { mult, penalty, boost: st.boost, mods: st.mods }, dayNo);
      const step = Math.max(-0.25, Math.min(0.25, m.targetRating - rating));
      rating = clampRating(rating + step + dr);
      // Investors take their share of the virtual profit; capital is untouched.
      const own = Math.round(m.revenue * (1 - st.equity));
      revenue = Math.min(MAX_CAPITAL, revenue + own);
      st.stats.guests = Math.min(MAX_CAPITAL, st.stats.guests + m.guests);
      events.push({ kind: "day", text: `День ${dayNo}: ${text}. ${noun[0].toUpperCase()}${noun.slice(1)}: ${m.guests}, игровая выручка: ${m.revenue.toLocaleString("ru-RU")}${st.equity ? ` (ваша доля ${own.toLocaleString("ru-RU")})` : ""}` });
      penalty = Math.round(penalty * 50) / 100;
      if (penalty < 0.03) penalty = 0;
      st.mult = mult;
      st.event = text;
    }
    const hint = pickHint(b.kind, owned, pro, b.seed, dayNo, st.boost.unlocks);
    const teaser = eventFor(b.seed, dayNo + 1, owned, b.kind).teaser;
    const next: GameState = { ...st, penalty, hint: hint ? { ...hint, day: dayNo } : null };
    await tx.bizBusiness.update({ where: { id: b.id }, data: { rating, dayNo, revenue, lastDay: today, state: asJson(next) } });
    if (gap > MAX_SIM_DAYS) events.unshift({ kind: "day", text: `Бизнес простоял ${gap - MAX_SIM_DAYS} дн. без присмотра` });
    await tx.bizEvent.createMany({ data: events.map((e) => ({ businessId: b.id, ...e })) });
    const hintItem = hint ? itemOf(b.kind, hint.itemId) : null;
    const chat = [crisisLine, reveal, hintItem ? hintLine(hintItem.title, hintItem.hint) : "", teaserLine(teaser)].filter(Boolean).join(" ");
    return { chat, facts: `день ${dayNo}, событие: ${st.event}; рейтинг ${rating}` };
  });
}

export interface BizView {
  business: {
    id: string;
    name: string;
    kind: BizKind;
    kindTitle: string;
    level: number;
    levelName: string;
    levels: string[];
    nextNeeds: string[];
    capital: number;
    rating: number;
    dayNo: number;
    revenueTotal: number;
    today: { guests: number; check: number; revenue: number; event: string; penalty: number; churn: number; bugs: number; mood: number; moodLabel: string; mrr: number };
    template: string;
    templateTitle: string;
    emoji: string;
    accent: string | null;
    labels: { guests: string; guestsShort: string; check: string; revenue: string; noun: string };
    reputation: number;
    /** Investors' share of virtual profit (0..0.49). */
    equity: number;
    boost: { mult: number; discount: number };
    guestsTotal: number;
    invitePath: string | null;
    isFounder: boolean;
    maxMembers: number;
  };
  /** confirmed: deposits since joining that are confirmed by a bank screenshot (shown with ✓ to teammates). */
  members: { userId: string; name: string; role: string; contributed: number; confirmed: number; you: boolean }[];
  owned: OwnedItem[];
  catalog: {
    id: string;
    title: string;
    blurb: string;
    category: string;
    slot: string;
    price: number;
    basePrice: number;
    repair: number;
    effect: { guests?: number; check?: number; rating?: number; churn?: number; bugs?: number };
    premium: boolean;
    exclusive: boolean;
    challenge: boolean;
    state: string;
    reason?: string;
  }[];
  /** For components/biz/BizScene.tsx: what to draw and how lively. Item ids match lib/biz/catalog.ts. */
  scene: { kind: BizKind; template: string; level: number; guests: number; mood: number; items: string[]; broken: string[]; challengeItems: string[]; accent: string | null; emoji: string };
  investors: {
    offers: { id: string; name: string; avatar: string; personality: string; pitch: string; goal: string; reward: string; deadlineDays: number; share: number }[];
    deal: { id: string; name: string; avatar: string; goal: string; reward: string; deadline: string; progress: { done: number; total: number; label: string; status: string } } | null;
    history: { id: string; name: string; status: string }[];
  };
  story: { n: number; title: string; text: string; goalText: string; progress: number; target: number; coins: number; xp: number; status: string }[];
  crisis: ReturnType<typeof crisisView>;
  custom: { emoji: string; accent: string; names: Record<string, string> } | null;
  customOptions: { logos: readonly string[]; accents: readonly string[] };
  events: { id: string; kind: string; text: string; at: string }[];
  chat: { id: string; name: string; text: string; pig: boolean; mine: boolean; at: string }[];
  challenges: Awaited<ReturnType<typeof challengeView>>;
  pro: boolean;
  /** CAP is a partner (persona, chat, hints, strategy) only when the team's founder is on Pro. */
  pigPartner: boolean;
}

export async function getView(user: Actor, opts: { simulate?: boolean } = {}): Promise<BizView | null> {
  const m = await memberOf(user.id);
  if (!m) return null;
  const pro = isPro(user.profile);
  const pigPartner = await teamPigPartner(m.businessId);
  await settleDeal(m.businessId);
  if (opts.simulate !== false) {
    const r = await rollover(m.businessId, pro);
    if (r?.chat && pigPartner) await prisma.bizChat.create({ data: { businessId: m.businessId, name: PIG_NAME, text: await pigVoice(r.chat, r.facts) } });
  }
  const b = await prisma.bizBusiness.findUnique({
    where: { id: m.businessId },
    include: {
      members: { orderBy: { joinedAt: "asc" } },
      upgrades: true,
      events: { orderBy: { createdAt: "desc" }, take: 30 },
      chat: { orderBy: { createdAt: "desc" }, take: 40 },
    },
  });
  if (!b) return null;
  const k = kindOf(b.kind);
  const owned: OwnedItem[] = b.upgrades.map((u) => ({ itemId: u.itemId, status: u.status }));
  const st = parseState(b.state);
  const mt = metrics(b.kind, owned, b.rating, st, b.dayNo);
  const level = levelOf(b.kind, owned);
  const names = st.custom?.names ?? {};
  const dv = await dealView(b.id, b.kind, st, { level, rating: b.rating, capital: b.capital, dayNo: b.dayNo });
  const dealInv = dv ? investorOf(dv.investorId) : null;
  const isFounder = b.founderId === user.id;
  const cap = isFounder ? teamCap(user.profile) : await founderCap(b.founderId);
  return {
    business: {
      id: b.id,
      name: b.name,
      kind: k.kind,
      kindTitle: k.title,
      level,
      levelName: k.levels[level - 1],
      levels: k.levels,
      nextNeeds: nextLevelNeeds(b.kind, owned).map((id) => itemOf(b.kind, id)?.title ?? id),
      capital: b.capital,
      rating: b.rating,
      dayNo: b.dayNo,
      revenueTotal: b.revenue,
      today: { guests: mt.guests, check: mt.check, revenue: mt.revenue, event: st.event, penalty: st.penalty, churn: mt.churn, bugs: mt.bugs, mood: mt.mood, moodLabel: moodLabel(mt.mood), mrr: mt.revenue * 30 },
      template: k.template,
      templateTitle: TEMPLATE_TITLES[k.template],
      emoji: st.custom?.emoji ?? k.emoji,
      accent: st.custom?.accent ?? null,
      labels: k.labels,
      reputation: st.reputation,
      equity: st.equity,
      boost: { mult: st.boost.mult, discount: st.boost.discount },
      guestsTotal: st.stats.guests,
      invitePath: `/biz/join/${b.inviteCode}`,
      isFounder,
      maxMembers: cap,
    },
    members: await Promise.all(
      b.members.map(async (x) => ({ userId: x.userId, name: x.name, role: x.role, contributed: x.contributed, confirmed: (await confirmedDeposits([x.userId], x.joinedAt)).get(x.userId) ?? 0, you: x.userId === user.id })),
    ),
    owned,
    catalog: [...k.catalog, ...owned.filter((o) => isChallengeItem(o.itemId)).map((o) => itemOf(b.kind, o.itemId)).filter((x) => !!x)].map((u) => {
      const a = availability(b.kind, u, owned, pro, st.boost.unlocks);
      return {
        id: u.id,
        title: names[u.id] ?? u.title,
        blurb: u.blurb,
        category: u.category,
        slot: u.slot,
        price: priceOf(u, st.boost.discount),
        basePrice: u.price,
        repair: repairPrice(u),
        effect: u.effect,
        premium: !!u.premium,
        exclusive: !!u.exclusive,
        challenge: !!u.challenge,
        state: a.state,
        reason: a.reason,
      };
    }),
    scene: {
      kind: k.kind,
      template: k.template,
      level,
      guests: mt.guests,
      mood: mt.mood,
      items: owned.filter((o) => o.status === "ok").map((o) => o.itemId),
      broken: owned.filter((o) => o.status !== "ok").map((o) => o.itemId),
      challengeItems: owned.filter((o) => isChallengeItem(o.itemId)).map((o) => o.itemId),
      accent: st.custom?.accent ?? null,
      emoji: st.custom?.emoji ?? k.emoji,
    },
    investors: {
      offers: offersFor(b.kind, b.dayNo, st.reputation, st.investors, !!st.deal).map((i) => ({ id: i.id, name: i.name, avatar: i.avatar, personality: i.personality, pitch: i.pitch, goal: goalText(i.goal, b.kind), reward: rewardText(i.reward, i.share, b.kind), deadlineDays: i.deadlineDays, share: i.share })),
      deal: dv && dealInv ? { id: dealInv.id, name: dealInv.name, avatar: dealInv.avatar, goal: goalText(dealInv.goal, b.kind), reward: rewardText(dealInv.reward, dealInv.share, b.kind), deadline: dv.deadline, progress: dv.progress } : null,
      history: Object.entries(st.investors).map(([id, status]) => ({ id, name: investorOf(id)?.name ?? id, status })),
    },
    story: storyState(b.kind, st, { items: owned.filter((o) => !isChallengeItem(o.itemId)).length, guestsToday: mt.guests, level, rating: b.rating }),
    crisis: crisisView(st, b.capital),
    custom: st.custom,
    customOptions: { logos: LOGOS, accents: ACCENTS },
    events: b.events.map((e) => ({ id: e.id, kind: e.kind, text: e.text, at: e.createdAt.toISOString() })),
    // Free teams: CAP stays silent in the chat (the UI shows a locked "CAP-партнёр доступен в Pro" card instead).
    chat: b.chat.reverse().filter((c) => pigPartner || c.userId !== null).map((c) => ({ id: c.id, name: c.name, text: c.text, pig: c.userId === null, mine: c.userId === user.id, at: c.createdAt.toISOString() })),
    challenges: await challengeView(b.id, user.id),
    pro,
    pigPartner,
  };
}

// ───────────────────────── savings hook ─────────────────────────

/**
 * Called by lib/savings/service.ts after every real deposit (+) or withdrawal (−). Never throws: the savings
 * operation already succeeded, the business just mirrors it.
 */
export async function onSavingsChange(userId: string, delta: number): Promise<void> {
  try {
    if (!delta) return;
    const m = await memberOf(userId);
    if (!m) return;
    await prisma.$transaction(async (tx) => {
      await advisoryLock(tx, lockKey(m.businessId));
      const b = await tx.bizBusiness.findUnique({ where: { id: m.businessId }, include: { upgrades: { orderBy: { createdAt: "desc" } } } });
      const me = await tx.bizMember.findUnique({ where: { userId } });
      if (!b || !me || me.businessId !== b.id) return;
      await tx.bizMember.update({ where: { id: me.id }, data: { contributed: Math.max(-MAX_CAPITAL, Math.min(MAX_CAPITAL, me.contributed + delta)) } });
      if (delta > 0) {
        await tx.bizBusiness.update({ where: { id: b.id }, data: { capital: Math.min(MAX_CAPITAL, b.capital + delta) } });
        await tx.bizEvent.create({ data: { businessId: b.id, kind: "deposit", text: `${me.name} отложил(а) ${rubs(delta)} в копилку — капитал +${rubs(delta)}`, userId, amount: delta } });
        return;
      }
      const amount = -delta;
      const hit = withdrawalHit(amount, b.capital);
      let capital = b.capital - amount;
      const broken: string[] = [];
      if (capital < 0) {
        // Not enough free capital: the newest working upgrades go "на ремонт" until the hole is covered.
        let debt = -capital;
        for (const u of b.upgrades) {
          if (debt <= 0) break;
          if (u.status !== "ok" || isChallengeItem(u.itemId)) continue; // challenge rewards weren't bought, they never break
          await tx.bizUpgrade.update({ where: { id: u.id }, data: { status: "broken" } });
          broken.push(itemOf(b.kind, u.itemId)?.title ?? u.itemId);
          debt -= u.price;
        }
        capital = 0;
      }
      const st = parseState(b.state);
      st.penalty = Math.min(0.6, Math.max(st.penalty, hit.penalty));
      await tx.bizBusiness.update({ where: { id: b.id }, data: { capital, rating: clampRating(b.rating - hit.rating), state: asJson(st) } });
      await tx.bizEvent.create({ data: { businessId: b.id, kind: "withdraw", text: `${me.name} снял(а) ${rubs(amount)} из копилки — выручка упала, рейтинг −${hit.rating}`, userId, amount: -amount } });
      if (broken.length) await tx.bizEvent.create({ data: { businessId: b.id, kind: "broken", text: `На ремонте: ${broken.join(", ")}. Почините из капитала, когда снова отложите.` } });
      await tx.bizChat.create({ data: { businessId: b.id, name: PIG_NAME, text: withdrawLine(me.name, rubs(amount)) } });
    });
    if (delta > 0 && delta >= 1000) {
      const day = dayKey();
      // At most one cheer per member per day so the chat isn't spam.
      if (await claimKey(userId, `biz-cheer:${day}`)) await prisma.bizChat.create({ data: { businessId: m.businessId, name: PIG_NAME, text: depositLine(m.name, rubs(delta)) } });
    }
  } catch (e) {
    console.error("[biz] onSavingsChange failed", e);
  }
}

// ───────────────────────── spending capital ─────────────────────────

async function rewardLevel(businessId: string, before: number, after: number) {
  if (after <= before) return;
  const b = await prisma.bizBusiness.updateMany({ where: { id: businessId, maxLevel: { lt: after } }, data: { maxLevel: after } });
  if (!b.count) return;
  const biz = await prisma.bizBusiness.findUnique({ where: { id: businessId }, include: { members: true } });
  if (!biz) return;
  const name = kindOf(biz.kind).levels[after - 1];
  await prisma.bizEvent.create({ data: { businessId, kind: "level", text: `Новый уровень: «${name}»!` } });
  await prisma.bizChat.create({ data: { businessId, name: PIG_NAME, text: `Мы теперь «${name}»! Я горжусь нами. Каждый рубль в копилке — кирпич в этом бизнесе.` } });
  // Each person is paid once per level for life, so re-opening businesses can't farm coins.
  for (const m of biz.members) {
    if (await claimKey(m.userId, `biz-level:${after}`)) {
      await addCoins(m.userId, after >= 3 ? 80 : 30, `biz-level:${after}`);
      await awardXp(m.userId, after >= 3 ? 40 : 20).catch(() => null);
    }
  }
}

async function spend(user: Actor, itemId: string, mode: "buy" | "repair") {
  const m = await requireMember(user.id);
  const pro = isPro(user.profile);
  const res = await prisma.$transaction(async (tx: Tx) => {
    await advisoryLock(tx, lockKey(m.businessId));
    const me = await tx.bizMember.findUnique({ where: { userId: user.id } });
    if (!me || me.businessId !== m.businessId) throw new HttpError(403, "Вы не в этой команде");
    const b = await tx.bizBusiness.findUniqueOrThrow({ where: { id: m.businessId }, include: { upgrades: true } });
    const def = itemOf(b.kind, itemId);
    if (!def) throw new HttpError(404, "Такого улучшения нет");
    const owned: OwnedItem[] = b.upgrades;
    const before = levelOf(b.kind, owned);
    const st = parseState(b.state);
    const a = availability(b.kind, def, owned, pro, st.boost.unlocks);
    let price: number;
    if (mode === "buy") {
      if (a.state === "owned" || a.state === "broken") throw new HttpError(409, "Уже куплено");
      if (a.state === "challenge") throw new HttpError(409, "Это награда за челлендж — её нельзя купить");
      if (a.state === "investor") throw new HttpError(409, a.reason ?? "Откроется после сделки с инвестором");
      if (a.state === "pro") throw new HttpError(402, "Это премиум-улучшение — доступно в Pro");
      if (a.state === "locked") throw new HttpError(409, a.reason ?? "Пока недоступно");
      price = priceOf(def, st.boost.discount);
    } else {
      if (a.state !== "broken") throw new HttpError(409, "Чинить нечего");
      price = repairPrice(def);
    }
    if (b.capital < price) throw new HttpError(422, `Не хватает капитала: отложите ещё ${rubs(price - b.capital)} в копилку`);
    await tx.bizBusiness.update({ where: { id: b.id }, data: { capital: b.capital - price } });
    if (mode === "buy") await tx.bizUpgrade.create({ data: { businessId: b.id, itemId, price, boughtBy: user.id } });
    else await tx.bizUpgrade.update({ where: { businessId_itemId: { businessId: b.id, itemId } }, data: { status: "ok" } });
    await tx.bizEvent.create({
      data: { businessId: b.id, kind: mode, text: mode === "buy" ? `${me.name} купил(а) «${def.title}» за ${rubs(price)} капитала` : `${me.name} починил(а) «${def.title}» за ${rubs(price)}`, userId: user.id, amount: -price },
    });
    const after = levelOf(b.kind, mode === "buy" ? [...owned, { itemId, status: "ok" }] : owned.map((o) => (o.itemId === itemId ? { ...o, status: "ok" } : o)));
    return { before, after, businessId: b.id };
  });
  let reward = 0;
  if (mode === "buy" && (await claimKey(user.id, "biz-first-upgrade"))) {
    reward += await addCoins(user.id, 15, "biz-first-upgrade");
    await awardXp(user.id, 10).catch(() => null);
  }
  await rewardLevel(res.businessId, res.before, res.after);
  return { reward, levelUp: res.after > res.before ? res.after : null };
}

export const buyUpgrade = (user: Actor, itemId: string) => spend(user, itemId, "buy");
export const repairUpgrade = (user: Actor, itemId: string) => spend(user, itemId, "repair");

// ───────────────────────── team ─────────────────────────

export async function inviteInfo(code: string) {
  const b = await prisma.bizBusiness.findUnique({ where: { inviteCode: code }, include: { members: { orderBy: { joinedAt: "asc" } } } });
  if (!b) return null;
  const max = await founderCap(b.founderId);
  return { id: b.id, name: b.name, kindTitle: kindOf(b.kind).title, founder: b.members.find((x) => x.role === "founder")?.name ?? "", members: b.members.map((x) => x.name), memberIds: b.members.map((x) => x.userId), full: b.members.length >= max, max };
}

export async function joinBusiness(user: Actor, code: string) {
  const b = await prisma.bizBusiness.findUnique({ where: { inviteCode: code } });
  if (!b) throw new HttpError(404, "Приглашение не найдено");
  const max = await founderCap(b.founderId);
  try {
    await prisma.$transaction(async (tx) => {
      await advisoryLock(tx, lockKey(b.id));
      const mine = await tx.bizMember.findUnique({ where: { userId: user.id } });
      if (mine?.businessId === b.id) return;
      if (mine) throw new HttpError(409, "Вы уже в другом бизнесе. Сначала выйдите из него.");
      if ((await tx.bizMember.count({ where: { businessId: b.id } })) >= max) throw new HttpError(409, max < 10 ? `Команда заполнена (${max} из ${max}). Больше мест — в Pro у основателя: до 4, 7 или 10 человек.` : "Команда заполнена");
      await tx.bizMember.create({ data: { businessId: b.id, userId: user.id, name: cleanName(user.name) || "Партнёр" } });
      await grantApprovedItems(tx, user.id, b.id);
      await tx.bizEvent.create({ data: { businessId: b.id, kind: "join", text: `${user.name} стал(а) сооснователем. Теперь его/её взносы в копилку тоже растят бизнес.`, userId: user.id } });
      await tx.bizChat.create({ data: { businessId: b.id, name: PIG_NAME, text: `${user.name}, добро пожаловать в команду! Правило одно: копилка растёт — бизнес растёт. Снимаешь — нам всем больно.` } });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, "Вы уже в другом бизнесе");
    throw e;
  }
}

/** Leave the business; a founder hands it to the longest-standing member, the last member closes it. */
export async function leaveBusiness(userId: string, kickedBy?: string) {
  const m = await memberOf(userId);
  if (!m) return;
  await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, lockKey(m.businessId));
    const me = await tx.bizMember.findUnique({ where: { userId } });
    if (!me) return;
    const others = await tx.bizMember.findMany({ where: { businessId: me.businessId, userId: { not: userId } }, orderBy: { joinedAt: "asc" } });
    if (!others.length) {
      await tx.bizBusiness.delete({ where: { id: me.businessId } });
      return;
    }
    await tx.bizMember.delete({ where: { id: me.id } });
    if (me.role === "founder") {
      await tx.bizMember.update({ where: { id: others[0].id }, data: { role: "founder" } });
      await tx.bizBusiness.update({ where: { id: me.businessId }, data: { founderId: others[0].userId } });
    }
    await tx.bizEvent.create({ data: { businessId: me.businessId, kind: "leave", text: kickedBy ? `${me.name} больше не в команде` : `${me.name} вышел(а) из бизнеса${me.role === "founder" ? `. Основатель теперь ${others[0].name}` : ""}` } });
  });
}

async function requireFounderOf(founderId: string, targetUserId: string) {
  const me = await requireMember(founderId);
  if (me.role !== "founder") throw new HttpError(403, "Это может только основатель");
  const target = await memberOf(targetUserId);
  if (!target || target.businessId !== me.businessId) throw new HttpError(404, "Участник не найден");
  if (target.userId === founderId) throw new HttpError(422, "Это вы");
  return { me, target };
}

export async function kickMember(founderId: string, targetUserId: string) {
  await requireFounderOf(founderId, targetUserId);
  await leaveBusiness(targetUserId, founderId);
}

export async function transferFounder(founderId: string, targetUserId: string) {
  const { me, target } = await requireFounderOf(founderId, targetUserId);
  await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, lockKey(me.businessId));
    const r = await tx.bizMember.updateMany({ where: { id: me.id, role: "founder" }, data: { role: "member" } });
    if (!r.count) throw new HttpError(409, "Вы уже не основатель");
    await tx.bizMember.update({ where: { id: target.id }, data: { role: "founder" } });
    await tx.bizBusiness.update({ where: { id: me.businessId }, data: { founderId: target.userId } });
    await tx.bizEvent.create({ data: { businessId: me.businessId, kind: "transfer", text: `${me.name} передал(а) роль основателя: теперь это ${target.name}` } });
  });
}

// ───────────────────────── chat / advice ─────────────────────────

export async function postChat(user: Actor, text: string) {
  const m = await requireMember(user.id);
  await prisma.bizChat.create({ data: { businessId: m.businessId, userId: user.id, name: m.name, text } });
  if (!isForPig(text) || !(await teamPigPartner(m.businessId))) return; // CAP answers in the chat of Pro teams only
  const b = await prisma.bizBusiness.findUniqueOrThrow({ where: { id: m.businessId }, include: { upgrades: true } });
  const best = bestPick(b.kind, b.upgrades, isPro(user.profile), b.capital);
  const reply = chatReply(text, best?.title ?? null, rubs(b.capital));
  await prisma.bizChat.create({ data: { businessId: m.businessId, name: PIG_NAME, text: await pigVoice(reply, `вопрос: ${text.slice(0, 200)}`) } });
}

/** Honest numbers-based advice from CAP: Free 1 per day, Pro 3 per day. */
export async function askAdvice(user: Actor) {
  const m = await requireMember(user.id);
  const pro = isPro(user.profile);
  // Game strategy is a partner feature: the user's own Pro or a Pro founder unlocks it.
  if (!pro && !(await teamPigPartner(m.businessId))) throw new HttpError(402, `${PIG_PARTNER_LOCK}: разборы стратегии, идеи и подсказки в чате команды.`);
  const day = dayKey();
  let ok = false;
  for (let n = 1; n <= (pro ? 3 : 1); n++) {
    if (await claimKey(user.id, `biz-advice:${day}:${n}`)) {
      ok = true;
      break;
    }
  }
  if (!ok) throw new HttpError(429, pro ? "На сегодня советы закончились — CAP ждёт вас завтра" : "Совет на сегодня уже получен. С Pro — 3 совета в день.");
  const b = await prisma.bizBusiness.findUniqueOrThrow({ where: { id: m.businessId }, include: { upgrades: true } });
  const best = bestPick(b.kind, b.upgrades, pro, b.capital);
  let text: string;
  if (!best) text = "Честно по цифрам: всё доступное уже куплено. Копим и ждём новый уровень.";
  else {
    const e = best.effect;
    const fx = [e.guests ? `+${e.guests} гостей` : "", e.check ? `+${e.check} к чеку` : "", e.rating ? `+${e.rating} к рейтингу` : ""].filter(Boolean).join(", ");
    text =
      b.capital >= best.price
        ? `Разбор без шуток: «${best.title}» даёт ${fx} за ${rubs(best.price)}. В кассе ${rubs(b.capital)} — хватает, бери.`
        : `Разбор без шуток: «${best.title}» даёт ${fx} за ${rubs(best.price)}. Не хватает ${rubs(best.price - b.capital)} — отложи в копилку, и купим.`;
  }
  await prisma.bizChat.create({ data: { businessId: m.businessId, name: PIG_NAME, text } });
}

/** Small summary for the dashboard card. */
export async function bizSummary(userId: string) {
  const m = await memberOf(userId);
  if (!m) return null;
  const b = await prisma.bizBusiness.findUnique({ where: { id: m.businessId }, include: { upgrades: true, _count: { select: { members: true } } } });
  if (!b) return null;
  const level = levelOf(b.kind, b.upgrades);
  return { name: b.name, levelName: kindOf(b.kind).levels[level - 1], capital: b.capital, rating: b.rating, members: b._count.members, upgrades: b.upgrades.filter((u) => u.status === "ok").length };
}

/** «Лидерборд бизнесов»: level, then rating, then net capital growth this week (mirrored savings). */
export async function leaderboard(limit = 50) {
  const { start } = weekStart();
  const biz = await prisma.bizBusiness.findMany({ select: { id: true, name: true, kind: true, rating: true, founderId: true, upgrades: { select: { itemId: true, status: true } }, members: { select: { userId: true, name: true, role: true } } }, take: 2000, orderBy: { updatedAt: "desc" } });
  // Weekly growth counts only deposits confirmed by a bank screenshot (minus withdrawals): see lib/savings/proof.ts.
  const perUser = await confirmedSavingsMany(biz.flatMap((b) => b.members.map((m) => m.userId)), start);
  const g = new Map(biz.map((b) => [b.id, b.members.reduce((s, m) => s + (perUser.get(m.userId) ?? 0), 0)]));
  return biz
    .map((b) => {
      const level = levelOf(b.kind, b.upgrades);
      return {
        id: b.id,
        name: b.name,
        kindTitle: kindOf(b.kind).title,
        level,
        levelName: kindOf(b.kind).levels[level - 1],
        rating: b.rating,
        growth: g.get(b.id) ?? 0,
        founder: b.members.find((m) => m.role === "founder")?.name ?? "",
        members: b.members.length,
        memberIds: b.members.map((m) => m.userId),
      };
    })
    .sort((a, b) => b.level - a.level || b.rating - a.rating || b.growth - a.growth)
    .slice(0, limit);
}
