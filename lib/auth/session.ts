import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySessionClaims } from "./token";

export async function startSession(userId: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  const token = await signSession(userId, u?.sessionVersion ?? 0);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

const getSessionClaims = cache(async () => {
  const jar = await cookies();
  return verifySessionClaims(jar.get(SESSION_COOKIE)?.value);
});

export const getSessionUserId = cache(async (): Promise<string | null> => (await getSessionClaims())?.userId ?? null);

/** Revokes every session of the user (all devices), e.g. after a password change. */
export async function revokeSessions(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}

/** Current user with profile, or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const claims = await getSessionClaims();
  if (!claims) return null;
  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, email: true, name: true, createdAt: true, blocked: true, sessionVersion: true, profile: true },
  });
  // A blocked account, or a token issued before the last "log out everywhere", is treated as signed out.
  if (!user || user.blocked || user.sessionVersion !== claims.sessionVersion) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** For server components: the signed-in user, or a redirect to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  // A valid cookie with no usable account (blocked/deleted): the proxy lets ?gone=1 through, avoiding a /login ⇄ /dashboard loop.
  if (!user) redirect((await getSessionUserId()) ? "/login?gone=1" : "/login");
  return user;
}
