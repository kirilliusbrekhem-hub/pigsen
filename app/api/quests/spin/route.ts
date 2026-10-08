import { enforceRateLimit, handler, HttpError, json, requireApiUser } from "@/lib/api/http";
import { spinWheel } from "@/lib/gamification/quests";

/** Daily wheel of fortune: the prize is drawn on the server, the client only animates to `index`. */
export const POST = handler(async () => {
  const user = await requireApiUser();
  enforceRateLimit(`spin:${user.id}`, 10, 60_000);
  const r = await spinWheel(user.id);
  if (!r.ok) throw new HttpError(409, "Колесо уже крутили сегодня. Приходите завтра!");
  return json(r);
});
