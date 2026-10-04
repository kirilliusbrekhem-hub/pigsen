import { prisma } from "@/lib/db/prisma";
import { clientIp, enforceRateLimit, handler, HttpError, json, parseBody } from "@/lib/api/http";
import { hashPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validation/schemas";

export const POST = handler(async (req: Request) => {
  enforceRateLimit(`register:${clientIp(req)}`, 10, 60 * 60_000);
  const { name, email, password } = await parseBody(req, registerSchema);
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) throw new HttpError(409, "Аккаунт с таким email уже существует", { email: "Этот email уже зарегистрирован" });
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), profile: { create: {} } },
  });
  await startSession(user.id);
  return json({ id: user.id, name: user.name }, 201);
});
