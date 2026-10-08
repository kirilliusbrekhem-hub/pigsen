import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/api/http";
import { isPro, startOfUtcDay } from "@/lib/billing/plan";
import { addDailyCoins } from "@/lib/coins/service";
import { finalScore, grade, lessons, newGame, playTurn, rewardFor, turnView, PROFILES, type BizKind, type Decisions, type SimState, type TurnView, type WeekReport } from "./engine";
import { reviewWeek } from "./review";

export const FREE_RUNS_PER_DAY = 1;

export interface HistoryItem {
  report: WeekReport;
  review: string;
  ai: boolean;
}

export interface RunView {
  id: string;
  kind: BizKind;
  title: string;
  emoji: string;
  unit: string;
  startCash: number;
  status: SimState["status"];
  state: SimState;
  turn: TurnView | null;
  history: HistoryItem[];
  result: { score: number; grade: string; lessons: string[]; reward: number; netWorth: number } | null;
}

type Row = { id: string; kind: string; seed: number; state: unknown; history: unknown; score: number | null; reward: number };

function toView(row: Row): RunView {
  const state = row.state as SimState;
  const history = (row.history ?? []) as HistoryItem[];
  const p = PROFILES[state.kind];
  const done = state.status !== "active";
  const score = row.score ?? finalScore(state);
  return {
    id: row.id, kind: state.kind, title: p.title, emoji: p.emoji, unit: p.unit, startCash: p.startCash, status: state.status, state,
    turn: done ? null : turnView(state, row.seed),
    history,
    result: done
      ? { score, grade: grade(score), lessons: lessons(state, history.map((h) => h.report)), reward: row.reward, netWorth: Math.round(state.cash + state.stock * p.unitCost - state.loan) }
      : null,
  };
}

export async function runsLeftToday(userId: string, pro: boolean): Promise<number | null> {
  if (pro) return null;
  const used = await prisma.simRun.count({ where: { userId, createdAt: { gte: startOfUtcDay() } } });
  return Math.max(0, FREE_RUNS_PER_DAY - used);
}

export async function startRun(userId: string, kind: BizKind, profile: { proUntil: Date | null } | null): Promise<RunView> {
  const pro = isPro(profile);
  // Only one active run at a time: starting a new one abandons the old (it still counts toward the daily limit).
  if (!pro && (await runsLeftToday(userId, false)) === 0) throw new HttpError(403, "Бесплатно — 1 игра в день. С Pro — без ограничений.");
  await prisma.simRun.updateMany({ where: { userId, status: "active" }, data: { status: "abandoned" } });
  const state = newGame(kind);
  const row = await prisma.simRun.create({ data: { userId, kind, seed: randomInt(1, 2_147_483_647), state: state as object, history: [] } });
  return toView(row);
}

export async function getRun(userId: string, id: string): Promise<RunView | null> {
  const row = await prisma.simRun.findFirst({ where: { id, userId, status: { not: "abandoned" } } });
  return row ? toView(row) : null;
}

export async function activeRun(userId: string): Promise<RunView | null> {
  const row = await prisma.simRun.findFirst({ where: { userId, status: "active" }, orderBy: { createdAt: "desc" } });
  return row ? toView(row) : null;
}

export async function recentRuns(userId: string) {
  const rows = await prisma.simRun.findMany({ where: { userId, status: { in: ["finished", "bankrupt"] } }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, kind: true, status: true, score: true, week: true, finishedAt: true } });
  return rows.map((r) => ({ ...r, title: PROFILES[r.kind as BizKind]?.title ?? r.kind, finishedAt: r.finishedAt?.toISOString() ?? null }));
}

export async function playWeek(userId: string, id: string, week: number, decisions: Partial<Decisions>): Promise<RunView> {
  const row = await prisma.simRun.findFirst({ where: { id, userId } });
  if (!row || row.status === "abandoned") throw new HttpError(404, "Игра не найдена");
  const state = row.state as unknown as SimState;
  if (state.status !== "active") throw new HttpError(409, "Игра уже закончена");
  if (week !== state.week + 1) throw new HttpError(409, "Эта неделя уже сыграна. Обновите страницу.");

  const { state: next, report } = playTurn(state, row.seed, decisions);
  const review = await reviewWeek(report, next);
  const history = [...((row.history ?? []) as unknown as HistoryItem[]), { report, review: review.text, ai: review.ai }];
  const done = next.status !== "active";
  const score = done ? finalScore(next) : null;

  // Optimistic lock on the week: a double click or a second tab can't play the same week twice.
  const upd = await prisma.simRun.updateMany({
    where: { id, userId, week: state.week, status: "active" },
    data: { week: next.week, state: next as object, history: history as object[], status: next.status, score, finishedAt: done ? new Date() : null },
  });
  if (upd.count === 0) throw new HttpError(409, "Эта неделя уже сыграна. Обновите страницу.");

  let reward = 0;
  if (done && score !== null) {
    reward = await addDailyCoins(userId, rewardFor(next, score), "sim");
    if (reward) await prisma.simRun.update({ where: { id }, data: { reward } });
  }
  return toView({ ...row, state: next, history, score, reward });
}
