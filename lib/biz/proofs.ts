import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { advisoryLock } from "@/lib/db/lock";
import { HttpError } from "@/lib/api/http";
import { addCoins } from "@/lib/coins/service";
import { awardXp } from "@/lib/gamification/service";
import { sendPushToUser } from "@/lib/push/send";
import { checkGoalImage } from "@/lib/savings/image";
import { CHALLENGES as SOCIAL, challengeById } from "@/lib/social/challenges";
import { CHALLENGE_ITEMS, challengeItemFor } from "./catalog";
import { CHALLENGES as BIZ, netSavedThisWeek } from "./challenges";
import { clampRating } from "./engine";

/**
 * Admin-reviewed challenge proofs for both the business savings challenges (source "biz", per team) and the offline
 * challenges at /challenges (source "social", per user). Approval grants the challenge's unique ch-* item to the
 * business, plus the existing modest coins/XP. One approval per challenge per owner, enforced under an advisory lock.
 */

type Tx = Prisma.TransactionClient;
export type Source = "biz" | "social";
export const PROOF_TEXT_MIN = 10;
export const PROOF_TEXT_MAX = 500;
const MAX_PENDING_PER_USER = 10;

const ownerKey = (source: Source, challengeId: string, userId: string, businessId: string | null) => `chs:${source}:${source === "biz" ? businessId : userId}:${challengeId}`;

function defOf(source: Source, id: string) {
  if (source === "biz") {
    const d = BIZ.find((c) => c.id === id);
    return d ? { title: d.title, coins: d.coins, rating: d.rating } : null;
  }
  const d = challengeById(id);
  return d ? { title: d.title, coins: d.reward, rating: 0 } : null;
}

export async function submitProof(userId: string, source: Source, challengeId: string, text: string, image: string | null, pro: boolean) {
  const def = defOf(source, challengeId);
  if (!def || !challengeItemFor(source, challengeId)) throw new HttpError(404, "Челлендж не найден");
  if (source === "social" && !pro && !SOCIAL.find((c) => c.id === challengeId)?.free) throw new HttpError(403, "Этот челлендж доступен в Pro");
  const img = image ? checkGoalImage(image) : null;
  let businessId: string | null = null;
  if (source === "biz") {
    const m = await prisma.bizMember.findUnique({ where: { userId } });
    if (!m) throw new HttpError(404, "У вас пока нет бизнеса");
    businessId = m.businessId;
    // Savings challenges still need real, screenshot-confirmed savings this week before a proof can be sent.
    const target = BIZ.find((c) => c.id === challengeId)!.target;
    if ((await netSavedThisWeek(userId)) < target) throw new HttpError(409, `Нужно ${target.toLocaleString("ru-RU")} ₽ подтверждённых взносов за неделю: приложите скрин перевода к взносу в копилке`);
  } else if (await prisma.challengeDone.findUnique({ where: { userId_challengeId: { userId, challengeId } } })) {
    throw new HttpError(409, "Челлендж уже выполнен");
  }
  return prisma.$transaction(async (tx) => {
    await advisoryLock(tx, ownerKey(source, challengeId, userId, businessId));
    const owner = source === "biz" ? { businessId } : { userId };
    if (await tx.challengeSubmission.findFirst({ where: { source, challengeId, status: "approved", ...owner } })) throw new HttpError(409, source === "biz" ? "Команда уже получила награду за этот челлендж" : "Челлендж уже выполнен");
    if (await tx.challengeSubmission.findFirst({ where: { source, challengeId, status: "pending", ...owner } })) throw new HttpError(409, "Уже на проверке");
    if ((await tx.challengeSubmission.count({ where: { userId, status: "pending" } })) >= MAX_PENDING_PER_USER) throw new HttpError(429, "Слишком много заявок на проверке — дождитесь ответа");
    const s = await tx.challengeSubmission.create({ data: { userId, source, challengeId, businessId, text, image: img } });
    if (businessId) {
      const me = await tx.bizMember.findUnique({ where: { userId } });
      await tx.bizEvent.create({ data: { businessId, kind: "challenge-sent", text: `${me?.name ?? "Участник"} отправил(а) челлендж «${def.title}» на проверку`, userId } });
    }
    return { id: s.id, status: s.status };
  });
}

/** Gives a user's approved offline-challenge items to the business they create or join. */
export async function grantApprovedItems(tx: Tx, userId: string, businessId: string) {
  const rows = await tx.challengeSubmission.findMany({ where: { userId, source: "social", status: "approved" }, select: { challengeId: true } });
  const items = rows.map((r) => challengeItemFor("social", r.challengeId)).filter((x) => !!x);
  if (items.length) await tx.bizUpgrade.createMany({ data: items.map((i) => ({ businessId, itemId: i.id, price: 0, boughtBy: userId })), skipDuplicates: true });
}

export async function reviewProof(adminId: string, id: string, action: "approve" | "reject", comment: string) {
  const sub = await prisma.challengeSubmission.findUnique({ where: { id } });
  if (!sub) throw new HttpError(404, "Заявка не найдена");
  const source = sub.source as Source;
  const def = defOf(source, sub.challengeId);
  const item = challengeItemFor(source, sub.challengeId);
  if (!def || !item) throw new HttpError(404, "Челлендж не найден");
  if (action === "reject" && comment.length < 3) throw new HttpError(422, "Напишите причину отказа", { comment: "Минимум 3 символа" });
  const r = await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, ownerKey(source, sub.challengeId, sub.userId, sub.businessId));
    const cur = await tx.challengeSubmission.findUnique({ where: { id } });
    if (!cur || cur.status !== "pending") throw new HttpError(409, "Заявка уже проверена");
    const owner = source === "biz" ? { businessId: sub.businessId } : { userId: sub.userId };
    const dup = action === "approve" && !!(await tx.challengeSubmission.findFirst({ where: { source, challengeId: sub.challengeId, status: "approved", ...owner } }));
    const status = action === "approve" && !dup ? "approved" : "rejected";
    const note = dup ? "Награда за этот челлендж уже получена" : comment;
    await tx.challengeSubmission.update({ where: { id }, data: { status, comment: note, reviewedBy: adminId, reviewedAt: new Date() } });
    // Where the unique item goes: the team the proof came from (biz) or the user's current business (social).
    let businessId: string | null = null;
    if (source === "biz") businessId = sub.businessId && (await tx.bizBusiness.findUnique({ where: { id: sub.businessId }, select: { id: true } })) ? sub.businessId : null;
    else businessId = (await tx.bizMember.findUnique({ where: { userId: sub.userId } }))?.businessId ?? null;
    if (businessId) await advisoryLock(tx, `biz:${businessId}`);
    if (status === "approved") {
      if (businessId) {
        await tx.bizUpgrade.createMany({ data: [{ businessId, itemId: item.id, price: 0, boughtBy: sub.userId }], skipDuplicates: true });
        if (def.rating) {
          const b = await tx.bizBusiness.findUniqueOrThrow({ where: { id: businessId } });
          await tx.bizBusiness.update({ where: { id: businessId }, data: { rating: clampRating(b.rating + def.rating) } });
        }
      }
      if (source === "social") await tx.challengeDone.createMany({ data: [{ userId: sub.userId, challengeId: sub.challengeId, note: sub.text.slice(0, 500) }], skipDuplicates: true });
    }
    if (businessId) {
      const name = (await tx.bizMember.findUnique({ where: { userId: sub.userId } }))?.name ?? "Участник";
      await tx.bizEvent.create({
        data: {
          businessId,
          kind: status === "approved" ? "challenge" : "challenge-rejected",
          text: status === "approved" ? `Челлендж «${def.title}» (${name}) одобрен! В бизнесе появилось: «${item.title}» — за челлендж${def.rating ? `, рейтинг +${def.rating}` : ""}` : `Челлендж «${def.title}» (${name}) не принят: ${note}. Можно отправить ещё раз`,
          userId: sub.userId,
        },
      });
    }
    return { status, note, businessId };
  });
  let coins = 0;
  if (r.status === "approved") {
    if (def.coins && (await prisma.dailyClaim.createMany({ data: [{ userId: sub.userId, key: `chs:${source}:${sub.challengeId}` }], skipDuplicates: true })).count) {
      coins = await addCoins(sub.userId, def.coins, `challenge:${source}:${sub.challengeId}`);
      await awardXp(sub.userId, 10).catch(() => null);
    }
  }
  await sendPushToUser(sub.userId, {
    title: r.status === "approved" ? "Челлендж засчитан!" : "Челлендж не принят",
    body: r.status === "approved" ? `«${def.title}»: в бизнесе новая награда «${item.title}»${coins ? `, +${coins} PigCoin$` : ""}` : `«${def.title}»: ${r.note}. Можно отправить ещё раз.`,
    url: source === "biz" ? "/biz" : `/challenges#${sub.challengeId}`,
    tag: `chs-${sub.id}`,
  }).catch(() => 0);
  return { status: r.status, coins, itemId: r.status === "approved" ? item.id : null, granted: !!r.businessId && r.status === "approved" };
}

export async function listProofs(status: string, take = 100) {
  const rows = await prisma.challengeSubmission.findMany({ where: { status }, orderBy: { createdAt: status === "pending" ? "asc" : "desc" }, take });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { id: true, name: true, email: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return Promise.all(
    rows.map(async (r) => {
      const source = r.source as Source;
      const def = defOf(source, r.challengeId);
      const bizDef = source === "biz" ? BIZ.find((c) => c.id === r.challengeId) : null;
      return {
        id: r.id,
        source,
        challengeId: r.challengeId,
        title: def?.title ?? r.challengeId,
        item: challengeItemFor(source, r.challengeId)?.title ?? "",
        text: r.text,
        hasImage: !!r.image,
        status: r.status,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        user: byId.get(r.userId) ?? { id: r.userId, name: "?", email: "" },
        /** biz: confirmed net savings this week vs the challenge target, as a hint for the reviewer. */
        savings: bizDef && r.status === "pending" ? { saved: await netSavedThisWeek(r.userId), target: bizDef.target } : null,
      };
    }),
  );
}

/** Per-user state of the offline challenges for /challenges. */
export async function socialProofState(userId: string) {
  const rows = await prisma.challengeSubmission.findMany({ where: { userId, source: "social" }, orderBy: { createdAt: "desc" }, select: { challengeId: true, status: true, comment: true } });
  const out: Record<string, { status: string; comment: string; item: string }> = {};
  for (const r of rows) {
    if (out[r.challengeId] && out[r.challengeId].status === "approved") continue;
    if (!out[r.challengeId] || r.status === "approved") out[r.challengeId] = { status: r.status, comment: r.status === "rejected" ? r.comment : "", item: challengeItemFor("social", r.challengeId)?.title ?? "" };
  }
  return out;
}

export async function proofImage(id: string, viewer: { id: string; admin: boolean }) {
  const r = await prisma.challengeSubmission.findUnique({ where: { id }, select: { image: true, userId: true } });
  if (!r || !r.image || (!viewer.admin && r.userId !== viewer.id)) return null;
  return r.image;
}

export const CHALLENGE_ITEM_IDS = CHALLENGE_ITEMS.map((i) => i.id);
