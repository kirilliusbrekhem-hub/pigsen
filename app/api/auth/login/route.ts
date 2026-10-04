import { prisma } from "@/lib/db/prisma";
import { clientIp, enforceRateLimit, handler, HttpError, json, parseBody } from "@/lib/api/http";
import { verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/schemas";

export const POST = handler(async (req: Request) => {
  const { email, password } = await parseBody(req, loginSchema);
  enforceRateLimit(`login:${clientIp(req)}:${email}`, 10, 15 * 60_000);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, "Неверный email или пароль");
  }
  await prisma.profile.upsert({ where: { userId: user.id }, update: { lastActiveAt: new Date() }, create: { userId: user.id } });
  await startSession(user.id);
  return json({ id: user.id, name: user.name });
});
