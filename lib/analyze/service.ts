import "server-only";
import { Prisma } from "@prisma/client";
import { HttpError } from "@/lib/api/http";
import { isPro } from "@/lib/billing/plan";
import { prisma } from "@/lib/db/prisma";
import { advisoryLock } from "@/lib/db/lock";
import { aggregate, type AnalysisResult } from "./aggregate";
import { aiCategorizeUnknown, aiRecommendations, scrubKey } from "./ai";
import { categorize } from "./categorize";
import type { Tx } from "./parse";

const WEEK = 7 * 86_400_000;
type Profile = Parameters<typeof isPro>[0];

/** Free (and the PigCoin$ trial): 1 analysis per 7 days; Pro: unlimited. */
export async function quota(userId: string, profile: Profile): Promise<{ unlimited: boolean; nextAt: string | null }> {
  if (isPro(profile)) return { unlimited: true, nextAt: null };
  const last = await prisma.spendAnalysis.findFirst({ where: { userId, createdAt: { gt: new Date(Date.now() - WEEK) } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  return { unlimited: false, nextAt: last ? new Date(last.createdAt.getTime() + WEEK).toISOString() : null };
}

const quotaError = (nextAt: string) =>
  new HttpError(402, `На Free доступен 1 разбор в неделю. Следующий — ${new Date(nextAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}. С Pro — без ограничений.`);

export async function assertQuota(userId: string, profile: Profile) {
  const q = await quota(userId, profile);
  if (q.nextAt) throw quotaError(q.nextAt);
}

export async function analyze(txs: Tx[]): Promise<AnalysisResult> {
  if (!txs.length) throw new HttpError(422, "Не нашли ни одной траты. Проверьте, что в выписке есть списания с датой и суммой.");
  const cats = txs.map(categorize);
  const unknown = txs.filter((_, i) => cats[i] === "other").map((t) => t.description);
  if (unknown.length) {
    const ai = await aiCategorizeUnknown(unknown);
    txs.forEach((t, i) => {
      if (cats[i] === "other") cats[i] = ai.get(scrubKey(t.description)) ?? "other";
    });
  }
  const result = aggregate(txs, cats);
  const recs = await aiRecommendations(result);
  if (recs) Object.assign(result, { recommendations: recs, aiUsed: true });
  return result;
}

/** Saves only the aggregate; the quota is re-checked under a per-user lock so parallel uploads can't exceed it. */
export async function saveAnalysis(userId: string, profile: Profile, source: string, result: AnalysisResult) {
  return prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `analyze:${userId}`);
    if (!isPro(profile)) {
      const last = await tx.spendAnalysis.findFirst({ where: { userId, createdAt: { gt: new Date(Date.now() - WEEK) } }, select: { createdAt: true } });
      if (last) throw quotaError(new Date(last.createdAt.getTime() + WEEK).toISOString());
    }
    return tx.spendAnalysis.create({ data: { userId, source, txCount: result.txCount, total: result.total, result: result as unknown as Prisma.InputJsonValue }, select: { id: true, createdAt: true } });
  });
}

export async function listAnalyses(userId: string) {
  return prisma.spendAnalysis.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, source: true, txCount: true, total: true, createdAt: true } });
}

export async function getAnalysis(userId: string, id: string) {
  const a = await prisma.spendAnalysis.findFirst({ where: { id, userId, deletedAt: null } });
  if (!a?.result) throw new HttpError(404, "Разбор не найден");
  return { id: a.id, source: a.source, createdAt: a.createdAt.toISOString(), result: a.result as unknown as AnalysisResult };
}

/** Wipes the stored result; only the timestamp remains for the weekly quota. */
export async function deleteAnalysis(userId: string, id: string) {
  const r = await prisma.spendAnalysis.updateMany({ where: { id, userId, deletedAt: null }, data: { deletedAt: new Date(), result: Prisma.DbNull, txCount: 0, total: 0 } });
  if (!r.count) throw new HttpError(404, "Разбор не найден");
}
