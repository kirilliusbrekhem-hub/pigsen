import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { HttpError } from "@/lib/api/http";

/** Admins are listed by email in the ADMIN_EMAILS env var (comma separated). Nothing else grants access. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** For admin pages: non-admins get a plain 404, so the panel's existence isn't revealed. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) notFound();
  return user;
}

export async function requireApiAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Нужно войти в аккаунт");
  if (!isAdminEmail(user.email)) throw new HttpError(404, "Не найдено");
  return user;
}
