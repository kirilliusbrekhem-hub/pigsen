import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { advisoryLock } from "@/lib/db/lock";
import { HttpError } from "@/lib/api/http";
import { isPro, startOfUtcDay } from "@/lib/billing/plan";
import { pickQuestions, type BankQuestion } from "./bank";

export const DUEL = {
  questions: 7,
  questionMs: 15_000,
  /** Network slack: an answer arriving later than this after the question was served counts as a timeout. */
  graceMs: 1_500,
  stakes: [0, 10, 50, 100] as const,
  /** Max stake against a ghost or bot; a bigger random stake is partly refunded on fallback. */
  botStakeMax: 10,
  /** Max PigCoin$ a user can put at stake per UTC day. */
  dailyStakeCap: 300,
  freePerDay: 3,
  /** How long a random duel waits for a live opponent before a ghost or bot steps in. */
  randomWaitMs: 8_000,
  friendTtlMs: 24 * 3_600_000,
  /** A player idle this long while the opponent has finished forfeits the remaining questions. */
  idleForfeitMs: 15 * 60_000,
} as const;

export type Stake = (typeof DUEL.stakes)[number];
type Tx = Prisma.TransactionClient;

export const pointsFor = (correct: boolean, ms: number) => (correct ? 100 + Math.round(100 * Math.max(0, 1 - ms / DUEL.questionMs)) : 0);

const BOT_NAMES = ["Бот Копейкин", "Бот Дивиденд", "Бот Маржа", "Бот Бюджет", "Бот Кэшфлоу"];
const newCode = () => randomBytes(6).toString("base64url");
const qs = (d: { questions: string }) => JSON.parse(d.questions) as BankQuestion[];

function weekStart(): Date {
  const d = startOfUtcDay();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

/** Under the user's lock: plan limit, daily stake cap, then the stake leaves the balance (escrow). */
async function admit(tx: Tx, userId: string, stake: number) {
  await advisoryLock(tx, userId);
  const today = startOfUtcDay();
  const profile = await tx.profile.findUnique({ where: { userId }, select: { proUntil: true } });
  if (!isPro(profile)) {
    const played = await tx.duelPlayer.count({ where: { userId, joinedAt: { gte: today } } });
    if (played >= DUEL.freePerDay) throw new HttpError(429, `На сегодня ${DUEL.freePerDay} дуэли. В Pro — без ограничений.`);
  }
  if (stake > 0) {
    const staked = await tx.duelPlayer.aggregate({ where: { userId, joinedAt: { gte: today } }, _sum: { stake: true } });
    if ((staked._sum.stake ?? 0) + stake > DUEL.dailyStakeCap) throw new HttpError(429, `Лимит ставок на сегодня — ${DUEL.dailyStakeCap} PigCoin$`);
    const spent = await tx.profile.updateMany({ where: { userId, coins: { gte: stake } }, data: { coins: { decrement: stake } } });
    if (!spent.count) throw new HttpError(402, "Не хватает PigCoin$");
    await tx.coinTx.create({ data: { userId, amount: -stake, reason: "duel:stake" } });
  }
}

async function credit(tx: Tx, userId: string, amount: number, reason: string) {
  if (amount <= 0) return;
  await tx.profile.update({ where: { userId }, data: { coins: { increment: amount } } });
  await tx.coinTx.create({ data: { userId, amount, reason } });
}

export async function createDuel(user: { id: string; name: string }, mode: "friend" | "random", stake: Stake) {
  const questions = JSON.stringify(await pickQuestions(DUEL.questions));
  return prisma.$transaction(async (tx) => {
    if (mode === "random") {
      await advisoryLock(tx, "duel:matchmaking");
      const open = await tx.duel.findFirst({
        where: { kind: "random", status: "waiting", stake, creatorId: { not: user.id }, createdAt: { gt: new Date(Date.now() - DUEL.randomWaitMs) } },
        orderBy: { createdAt: "asc" },
      });
      if (open) {
        await admit(tx, user.id, stake);
        await tx.duelPlayer.create({ data: { duelId: open.id, userId: user.id, name: user.name, stake } });
        await tx.duel.update({ where: { id: open.id }, data: { status: "active", startedAt: new Date() } });
        return { id: open.id };
      }
    }
    await admit(tx, user.id, stake);
    const d = await tx.duel.create({
      data: { code: newCode(), kind: mode, stake, questions, creatorId: user.id, players: { create: { userId: user.id, name: user.name, stake } } },
    });
    return { id: d.id };
  });
}

export async function joinFriendDuel(user: { id: string; name: string }, code: string) {
  return prisma.$transaction(async (tx) => {
    const d = await tx.duel.findUnique({ where: { code } });
    if (!d || d.kind !== "friend") throw new HttpError(404, "Вызов не найден");
    await advisoryLock(tx, `duel:${d.id}`);
    const fresh = await tx.duel.findUniqueOrThrow({ where: { id: d.id }, include: { players: true } });
    if (fresh.players.some((p) => p.userId === user.id)) return { id: d.id };
    if (fresh.status !== "waiting" || Date.now() - fresh.createdAt.getTime() > DUEL.friendTtlMs) throw new HttpError(409, "Этот вызов уже принят или истёк");
    await admit(tx, user.id, fresh.stake);
    await tx.duelPlayer.create({ data: { duelId: d.id, userId: user.id, name: user.name, stake: fresh.stake } });
    await tx.duel.update({ where: { id: d.id }, data: { status: "active", startedAt: new Date() } });
    return { id: d.id };
  });
}

/** Ghost = a finished run of a real past player (same questions, same timings); otherwise a bot with human-like timing. */
async function fallbackToGhost(tx: Tx, duelId: string) {
  const d = await tx.duel.findUniqueOrThrow({ where: { id: duelId }, include: { players: true } });
  if (d.status !== "waiting" || d.kind !== "random") return;
  const creator = d.players[0];
  const runs = await tx.duelPlayer.findMany({
    where: { isBot: false, finishedAt: { not: null }, userId: { not: d.creatorId }, duel: { status: "done", kind: { in: ["random", "friend"] } }, joinedAt: { gt: new Date(Date.now() - 30 * 86_400_000) } },
    include: { answers: true, duel: { select: { questions: true } } },
    orderBy: { joinedAt: "desc" },
    take: 30,
  });
  const full = runs.filter((r) => r.answers.length === DUEL.questions);
  const run = full.length ? full[Math.floor(Math.random() * full.length)] : null;
  const stake = Math.min(d.stake, DUEL.botStakeMax);
  if (d.stake > stake && creator.userId) await credit(tx, creator.userId, d.stake - stake, "duel:refund");
  let questions = d.questions;
  let bot: { name: string; answers: { q: number; choice: number; correct: boolean; ms: number; points: number }[] };
  if (run) {
    questions = run.duel.questions;
    bot = { name: `Призрак · ${run.name}`, answers: run.answers.map(({ q, choice, correct, ms, points }) => ({ q, choice, correct, ms, points })) };
  } else {
    const skill = 0.5 + Math.random() * 0.3;
    bot = {
      name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
      answers: qs(d).map((q, i) => {
        const correct = Math.random() < skill;
        const ms = Math.round(Math.min(DUEL.questionMs - 500, (correct ? 2_500 : 4_000) + Math.random() * 8_000));
        return { q: i, choice: correct ? q.answer : (q.answer + 1 + Math.floor(Math.random() * 3)) % 4, correct, ms, points: pointsFor(correct, ms) };
      }),
    };
  }
  await tx.duel.update({ where: { id: d.id }, data: { kind: run ? "ghost" : "bot", status: "active", startedAt: new Date(), stake, questions } });
  await tx.duelPlayer.update({ where: { id: creator.id }, data: { stake } });
  await tx.duelPlayer.create({
    data: {
      duelId: d.id, name: bot.name, isBot: true, stake,
      score: bot.answers.reduce((s, a) => s + a.points, 0), correct: bot.answers.filter((a) => a.correct).length,
      current: DUEL.questions, finishedAt: new Date(), answers: { create: bot.answers },
    },
  });
}

/** Records timeouts for every question the player has not answered, from `from` on. */
async function forfeitRest(tx: Tx, playerId: string, from: number) {
  for (let q = from; q < DUEL.questions; q++) {
    await tx.duelAnswer.upsert({ where: { playerId_q: { playerId, q } }, update: {}, create: { playerId, q, choice: -1, correct: false, ms: DUEL.questionMs, points: 0 } });
  }
  await tx.duelPlayer.update({ where: { id: playerId }, data: { current: DUEL.questions, qStartedAt: null, finishedAt: new Date() } });
}

/** Lazy housekeeping on every read: matchmaking fallback, expiry, idle forfeits, settlement. */
async function sweep(duelId: string) {
  const d = await prisma.duel.findUnique({ where: { id: duelId }, include: { players: true } });
  if (!d || d.status === "done" || d.status === "cancelled") return;
  const now = Date.now();
  const age = now - d.createdAt.getTime();
  const needs =
    (d.status === "waiting" && d.kind === "random" && age > DUEL.randomWaitMs) ||
    (d.status === "waiting" && d.kind === "friend" && age > DUEL.friendTtlMs) ||
    (d.status === "active" && d.players.every((p) => p.finishedAt)) ||
    (d.status === "active" && d.players.some((p) => p.finishedAt) && d.players.some((p) => !p.finishedAt && now - Math.max(p.lastActiveAt.getTime(), d.startedAt?.getTime() ?? 0) > DUEL.idleForfeitMs));
  if (!needs) return;
  await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `duel:${duelId}`);
    const cur = await tx.duel.findUniqueOrThrow({ where: { id: duelId }, include: { players: true } });
    if (cur.status === "waiting" && cur.kind === "random" && now - cur.createdAt.getTime() > DUEL.randomWaitMs) return fallbackToGhost(tx, duelId);
    if (cur.status === "waiting" && cur.kind === "friend" && now - cur.createdAt.getTime() > DUEL.friendTtlMs) {
      const claimed = await tx.duel.updateMany({ where: { id: duelId, status: "waiting" }, data: { status: "cancelled", finishedAt: new Date() } });
      if (claimed.count) for (const p of cur.players) if (p.userId) await credit(tx, p.userId, p.stake, "duel:refund");
      return;
    }
    if (cur.status !== "active") return;
    for (const p of cur.players) {
      if (!p.finishedAt && cur.players.some((o) => o.finishedAt) && now - Math.max(p.lastActiveAt.getTime(), cur.startedAt?.getTime() ?? 0) > DUEL.idleForfeitMs) {
        await forfeitRest(tx, p.id, p.current);
      }
    }
    await settle(tx, duelId);
  });
}

/** Pays out once both runs are finished. Winner takes both stakes (vs a bot the bot's half is paid by the house); a draw refunds. */
async function settle(tx: Tx, duelId: string) {
  const players = await tx.duelPlayer.findMany({ where: { duelId } });
  if (players.length < 2 || players.some((p) => !p.finishedAt)) return;
  const claimed = await tx.duel.updateMany({ where: { id: duelId, status: "active" }, data: { status: "done", finishedAt: new Date() } });
  if (!claimed.count) return;
  const [a, b] = players;
  const pot = a.stake + b.stake;
  const draw = a.score === b.score;
  for (const p of players) {
    const result = draw ? "draw" : p === (a.score > b.score ? a : b) ? "win" : "loss";
    await tx.duelPlayer.update({ where: { id: p.id }, data: { result } });
    if (!p.userId) continue;
    if (draw) await credit(tx, p.userId, p.stake, "duel:refund");
    else if (result === "win") await credit(tx, p.userId, pot, "duel:win");
  }
}

async function myPlayer(userId: string, duelId: string) {
  const p = await prisma.duelPlayer.findUnique({ where: { duelId_userId: { duelId, userId } }, include: { duel: true } });
  if (!p) throw new HttpError(404, "Дуэль не найдена");
  return p;
}

/** Serves the current question and starts its server-side clock (once). Never includes the answer. */
export async function currentQuestion(userId: string, duelId: string) {
  await sweep(duelId);
  const { id: playerId } = await myPlayer(userId, duelId);
  const r = await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `duelp:${playerId}`);
    const p = await tx.duelPlayer.findUniqueOrThrow({ where: { id: playerId }, include: { duel: true } });
    if (p.duel.status === "waiting" && p.duel.kind === "random") throw new HttpError(409, "Ищем соперника");
    if (p.duel.status === "cancelled" || p.finishedAt) return { done: true as const };
    let { current, qStartedAt } = p;
    // A question left open past its time is a timeout: move on.
    if (qStartedAt && Date.now() - qStartedAt.getTime() > DUEL.questionMs + DUEL.graceMs) {
      await tx.duelAnswer.create({ data: { playerId, q: current, choice: -1, correct: false, ms: DUEL.questionMs, points: 0 } });
      current += 1;
      qStartedAt = null;
      if (current >= DUEL.questions) {
        await tx.duelPlayer.update({ where: { id: playerId }, data: { current, qStartedAt: null, finishedAt: new Date(), lastActiveAt: new Date() } });
        return { done: true as const };
      }
    }
    if (!qStartedAt) qStartedAt = new Date();
    await tx.duelPlayer.update({ where: { id: playerId }, data: { current, qStartedAt, lastActiveAt: new Date() } });
    const q = qs(p.duel)[current];
    return { done: false as const, index: current, total: DUEL.questions, q: q.q, options: q.options, remainingMs: Math.max(0, DUEL.questionMs - (Date.now() - qStartedAt.getTime())) };
  });
  if (r.done) await sweep(duelId);
  return r;
}

/** One answer per question (unique key + index check under the player's lock); late answers score zero. */
export async function submitAnswer(userId: string, duelId: string, index: number, choice: number) {
  const { id: playerId } = await myPlayer(userId, duelId);
  const r = await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `duelp:${playerId}`);
    const p = await tx.duelPlayer.findUniqueOrThrow({ where: { id: playerId }, include: { duel: true } });
    if (p.finishedAt || p.current !== index || !p.qStartedAt) throw new HttpError(409, "Ответ на этот вопрос уже принят");
    const ms = Date.now() - p.qStartedAt.getTime();
    const late = ms > DUEL.questionMs + DUEL.graceMs;
    const q = qs(p.duel)[index];
    const correct = !late && choice === q.answer;
    const points = pointsFor(correct, Math.min(ms, DUEL.questionMs));
    await tx.duelAnswer.create({ data: { playerId, q: index, choice: late ? -1 : choice, correct, ms: Math.min(ms, DUEL.questionMs), points } });
    const finished = index + 1 >= DUEL.questions;
    await tx.duelPlayer.update({
      where: { id: playerId },
      data: { current: index + 1, qStartedAt: null, score: { increment: points }, correct: { increment: correct ? 1 : 0 }, lastActiveAt: new Date(), ...(finished ? { finishedAt: new Date() } : {}) },
    });
    return { correct, answer: q.answer, points, late, finished };
  });
  if (r.finished) await sweep(duelId);
  return r;
}

export type DuelView = Awaited<ReturnType<typeof duelState>>;

/** What a participant may see. Opponent's score is hidden until you finish (no peeking mid-run). */
export async function duelState(userId: string, duelId: string) {
  await sweep(duelId);
  const me = await myPlayer(userId, duelId);
  const d = await prisma.duel.findUniqueOrThrow({ where: { id: duelId }, include: { players: { orderBy: { joinedAt: "asc" } } } });
  const opp = d.players.find((p) => p.id !== me.id) ?? null;
  const fresh = d.players.find((p) => p.id === me.id)!;
  const showAll = !!fresh.finishedAt;
  const answers = showAll ? await prisma.duelAnswer.findMany({ where: { playerId: { in: d.players.map((p) => p.id) } }, orderBy: { q: "asc" } }) : [];
  const questions = showAll ? qs(d) : [];
  return {
    id: d.id,
    code: d.code,
    kind: d.kind,
    status: d.status,
    stake: d.stake,
    rematchId: d.rematchId,
    isCreator: d.creatorId === userId,
    total: DUEL.questions,
    me: { name: fresh.name, score: fresh.score, correct: fresh.correct, current: fresh.current, finished: !!fresh.finishedAt, result: fresh.result },
    opponent: opp && { name: opp.name, isBot: opp.isBot, finished: !!opp.finishedAt, current: Math.min(opp.current, DUEL.questions), score: showAll ? opp.score : null, correct: showAll ? opp.correct : null },
    review: questions.map((q, i) => ({
      q: q.q,
      options: q.options,
      answer: q.answer,
      mine: answers.find((a) => a.playerId === fresh.id && a.q === i) ?? null,
      theirs: opp ? answers.find((a) => a.playerId === opp.id && a.q === i) ?? null : null,
    })).map((r) => ({ ...r, mine: r.mine && { choice: r.mine.choice, ms: r.mine.ms, points: r.mine.points }, theirs: r.theirs && { choice: r.theirs.choice, ms: r.theirs.ms, points: r.theirs.points } })),
  };
}

/** Rematch: against a person, one shared friend duel (whoever asks first creates it); against a ghost/bot, a fresh random. */
export async function rematch(user: { id: string; name: string }, duelId: string) {
  const me = await myPlayer(user.id, duelId);
  const d = me.duel;
  if (d.status !== "done") throw new HttpError(409, "Дуэль ещё не закончена");
  if (d.kind === "bot" || d.kind === "ghost") return createDuel(user, "random", d.stake as Stake);
  if (d.rematchId) {
    const r = await prisma.duel.findUnique({ where: { id: d.rematchId } });
    if (r && r.creatorId !== user.id) return joinFriendDuel(user, r.code);
    if (r) return { id: r.id };
  }
  const questions = JSON.stringify(await pickQuestions(DUEL.questions));
  const created = await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `duel:${duelId}`);
    const cur = await tx.duel.findUniqueOrThrow({ where: { id: duelId } });
    if (cur.rematchId) return { existing: cur.rematchId };
    await admit(tx, user.id, d.stake);
    const r = await tx.duel.create({ data: { code: newCode(), kind: "friend", stake: d.stake, questions, creatorId: user.id, players: { create: { userId: user.id, name: user.name, stake: d.stake } } } });
    await tx.duel.update({ where: { id: duelId }, data: { rematchId: r.id } });
    return { id: r.id };
  });
  if ("existing" in created) return rematch(user, duelId);
  return created;
}

export async function inviteInfo(code: string) {
  const d = await prisma.duel.findUnique({ where: { code }, include: { players: { select: { userId: true, name: true } } } });
  if (!d || d.kind !== "friend") return null;
  const expired = d.status === "waiting" && Date.now() - d.createdAt.getTime() > DUEL.friendTtlMs;
  return { id: d.id, creatorId: d.creatorId, creatorName: d.players.find((p) => p.userId === d.creatorId)?.name ?? "Игрок", stake: d.stake, open: d.status === "waiting" && !expired, players: d.players.map((p) => p.userId) };
}

/** Weekly rating: win 3, draw 1; ties broken by total points. Only live players. */
export async function weeklyRating(limit = 10) {
  const rows = await prisma.duelPlayer.findMany({ where: { userId: { not: null }, result: { not: null }, finishedAt: { gte: weekStart() } }, select: { userId: true, name: true, result: true, score: true }, take: 10_000 });
  const by = new Map<string, { userId: string; name: string; points: number; wins: number; score: number }>();
  for (const r of rows) {
    const e = by.get(r.userId!) ?? { userId: r.userId!, name: r.name, points: 0, wins: 0, score: 0 };
    e.points += r.result === "win" ? 3 : r.result === "draw" ? 1 : 0;
    e.wins += r.result === "win" ? 1 : 0;
    e.score += r.score;
    by.set(r.userId!, e);
  }
  return [...by.values()].sort((a, b) => b.points - a.points || b.score - a.score).slice(0, limit);
}

export async function lobby(userId: string) {
  const [profile, today, recent, rating] = await Promise.all([
    prisma.profile.findUnique({ where: { userId }, select: { proUntil: true, coins: true } }),
    prisma.duelPlayer.aggregate({ where: { userId, joinedAt: { gte: startOfUtcDay() } }, _count: true, _sum: { stake: true } }),
    prisma.duelPlayer.findMany({ where: { userId }, orderBy: { joinedAt: "desc" }, take: 10, include: { duel: { include: { players: { select: { id: true, name: true, score: true } } } } } }),
    weeklyRating(),
  ]);
  const pro = isPro(profile);
  return {
    pro,
    coins: profile?.coins ?? 0,
    left: pro ? null : Math.max(0, DUEL.freePerDay - today._count),
    stakeLeft: Math.max(0, DUEL.dailyStakeCap - (today._sum.stake ?? 0)),
    rating,
    recent: recent.map((p) => {
      const o = p.duel.players.find((x) => x.id !== p.id);
      return { id: p.duelId, status: p.duel.status, kind: p.duel.kind, stake: p.duel.stake, result: p.result, score: p.score, opponent: o?.name ?? null, opponentScore: p.result ? o?.score ?? null : null };
    }),
  };
}
