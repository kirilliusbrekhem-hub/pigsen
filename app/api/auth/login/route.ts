import { prisma } from "@/lib/db/prisma";
import { clientIp, handler, HttpError, json, parseBody } from "@/lib/api/http";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/schemas";

export const POST = handler(async (req: Request) => {
  const { email, password } = await parseBody(req, loginSchema);
  await enforceDbRateLimit(`login-ip:${clientIp(req)}`, 30, 15 * 60_000);
  await enforceDbRateLimit(`login-email:${email.toLowerCase()}`, 10, 15 * 60_000);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, "Неверный email или пароль");
  }
  if (user.blocked) throw new HttpError(403, "Аккаунт заблокирован. Напишите в поддержку.");
  await prisma.profile.upsert({ where: { userId: user.id }, update: { lastActiveAt: new Date() }, create: { userId: user.id } });
  await startSession(user.id);
  return json({ id: user.id, name: user.name });
});
