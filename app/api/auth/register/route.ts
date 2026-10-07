import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { clientIp, handler, HttpError, json, parseBody } from "@/lib/api/http";
import { hashPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validation/schemas";
import { saveAttribution } from "@/lib/analytics/attribution";
import { GOAL_COOKIE } from "@/lib/analytics/utm";
import { attachReferral, REF_COOKIE } from "@/lib/growth/referral";

const schema = registerSchema.extend({ ref: z.string().max(64).optional() });

function cookieRef(req: Request): string | null {
  const m = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${REF_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export const POST = handler(async (req: Request) => {
  await enforceDbRateLimit(`register:${clientIp(req)}`, 10, 60 * 60_000);
  const { name, email, password, ref } = await parseBody(req, schema);
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) throw new HttpError(409, "Аккаунт с таким email уже существует", { email: "Этот email уже зарегистрирован" });
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), profile: { create: {} } },
  });
  let referred = false;
  try {
    referred = await attachReferral(user.id, ref || cookieRef(req));
  } catch (e) {
    console.error("[referral] attach failed", e);
  }
  await saveAttribution(user.id, req, referred);
  await startSession(user.id);
  const res = json({ id: user.id, name: user.name, referred }, 201);
  if (referred) res.cookies.set(REF_COOKIE, "", { maxAge: 0, path: "/" });
  res.cookies.set(GOAL_COOKIE, "register", { maxAge: 600, path: "/", sameSite: "lax" });
  return res;
});
