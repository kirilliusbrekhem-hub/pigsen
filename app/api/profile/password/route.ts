import { prisma } from "@/lib/db/prisma";
import { enforceRateLimit, handler, HttpError, json, parseBody, requireApiUser } from "@/lib/api/http";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { passwordChangeSchema } from "@/lib/validation/schemas";

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  enforceRateLimit(`pwd:${user.id}`, 5, 15 * 60_000);
  const { currentPassword, newPassword } = await parseBody(req, passwordChangeSchema);
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(currentPassword, row.passwordHash))) {
    throw new HttpError(422, "Проверьте введённые данные", { currentPassword: "Неверный текущий пароль" });
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  return json({ ok: true });
});
