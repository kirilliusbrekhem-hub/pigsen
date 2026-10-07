import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { HttpError } from "@/lib/api/http";
import { prisma } from "@/lib/db/prisma";
import { advisoryLock } from "@/lib/db/lock";

function inAdminEmails(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

/**
 * Admin access lives in AdminGrant. ADMIN_EMAILS is only a bootstrap: while no grant exists at all,
 * the first listed user to be checked claims it. After that a listed email alone grants nothing, so a
 * stranger registering an unclaimed admin email (or a deleted owner's email) can't take over the panel.
 */
export async function isAdmin(user: { id: string; email: string } | null | undefined): Promise<boolean> {
  if (!user) return false;
  if (await prisma.adminGrant.findUnique({ where: { userId: user.id }, select: { userId: true } })) return true;
  if (!inAdminEmails(user.email)) return false;
  return prisma.$transaction(async (tx) => {
    await advisoryLock(tx, "admin-bootstrap");
    if ((await tx.adminGrant.count()) > 0) return false;
    await tx.adminGrant.create({ data: { userId: user.id } });
    return true;
  });
}

/** For admin pages: non-admins get a plain 404, so the panel's existence isn't revealed. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !(await isAdmin(user))) notFound();
  return user;
}

export async function requireApiAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Нужно войти в аккаунт");
  if (!(await isAdmin(user))) throw new HttpError(404, "Не найдено");
  return user;
}
