import { HttpError, enforceRateLimit, handler, json, requireApiUser } from "@/lib/api/http";
import { buildReminder } from "@/lib/savings/reminders";
import { sendPushToUser } from "@/lib/push/send";

export const POST = handler(async () => {
  const user = await requireApiUser();
  enforceRateLimit(`push-test:${user.id}`, 3, 60_000);
  const p = (await buildReminder(user.id)) ?? { title: "PìgBiz", body: "Уведомления работают! Поставьте цель в копилке 🐷", url: "/savings" };
  const sent = await sendPushToUser(user.id, { ...p, tag: "pigsen-test" });
  if (!sent) throw new HttpError(404, "Нет активных подписок на этом аккаунте. Включите напоминания ещё раз.");
  return json({ sent });
});
