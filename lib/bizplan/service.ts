import "server-only";
import { HttpError } from "@/lib/api/http";
import { isPro } from "@/lib/billing/plan";
import type { CurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { advisoryLock } from "@/lib/db/lock";
import { sanitizeText } from "@/lib/validation/schemas";
import { computeModel, type PlanModel } from "./model";
import { PlanInputSchema, type PlanInput } from "./schema";
import { writeSections, type PlanSections } from "./text";

export const FREE_PLANS = 1;

export interface PlanView {
  id: string;
  title: string;
  input: PlanInput;
  sections: PlanSections;
  model: PlanModel;
  demo: boolean;
  updatedAt: string;
}

/** Strips control characters from every string in the input (zod already bounded the sizes). */
export function cleanInput(input: PlanInput): PlanInput {
  const walk = (v: unknown): unknown => (typeof v === "string" ? sanitizeText(v) : Array.isArray(v) ? v.map(walk) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v);
  return walk(input) as PlanInput;
}

function toView(row: { id: string; title: string; input: unknown; sections: unknown; aiDemo: boolean; updatedAt: Date }): PlanView {
  // Stored input is re-validated on read: the model only ever runs on well-formed numbers.
  const input = PlanInputSchema.parse(row.input);
  return { id: row.id, title: row.title, input, sections: row.sections as PlanSections, model: computeModel(input), demo: row.aiDemo, updatedAt: row.updatedAt.toISOString() };
}

export const planPro = (user: CurrentUser) => isPro(user.profile);

export async function listPlans(userId: string) {
  return prisma.bizPlan.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, updatedAt: true }, take: 200 });
}

export async function getPlan(userId: string, id: string): Promise<PlanView | null> {
  const row = await prisma.bizPlan.findFirst({ where: { id, userId } });
  return row ? toView(row) : null;
}

export async function createPlan(user: CurrentUser, raw: PlanInput): Promise<PlanView> {
  // Cheap pre-check before the AI call; the locked re-check below is the one that counts.
  if (!planPro(user) && (await prisma.bizPlan.count({ where: { userId: user.id } })) >= FREE_PLANS) {
    throw new HttpError(402, "На Free доступен 1 бизнес-план. Удалите старый или оформите Pro для безлимита.");
  }
  const input = cleanInput(raw);
  const model = computeModel(input);
  const { sections, demo } = await writeSections(input, model);
  const row = await prisma.$transaction(async (tx) => {
    // Lock per user so two parallel creates can't both pass the Free limit.
    await advisoryLock(tx, `bizplan:${user.id}`);
    if (!planPro(user) && (await tx.bizPlan.count({ where: { userId: user.id } })) >= FREE_PLANS) {
      throw new HttpError(402, "На Free доступен 1 бизнес-план. Удалите старый или оформите Pro для безлимита.");
    }
    if ((await tx.bizPlan.count({ where: { userId: user.id } })) >= 200) throw new HttpError(429, "Слишком много планов");
    return tx.bizPlan.create({ data: { userId: user.id, title: input.title, input, sections: sections as object, aiDemo: demo } });
  });
  return toView(row);
}

export async function updatePlan(userId: string, id: string, raw: PlanInput): Promise<PlanView> {
  const existing = await prisma.bizPlan.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw new HttpError(404, "План не найден");
  const input = cleanInput(raw);
  const { sections, demo } = await writeSections(input, computeModel(input));
  const row = await prisma.bizPlan.update({ where: { id }, data: { title: input.title, input, sections: sections as object, aiDemo: demo } });
  return toView(row);
}

export async function deletePlan(userId: string, id: string): Promise<void> {
  const r = await prisma.bizPlan.deleteMany({ where: { id, userId } });
  if (!r.count) throw new HttpError(404, "План не найден");
}
