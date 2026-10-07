import { enforceRateLimit, handler, json, requireApiUser } from "@/lib/api/http";
import { endSession, revokeSessions } from "@/lib/auth/session";

/** Signs the user out on every device (this one included) by bumping their session version. */
export const POST = handler(async () => {
  const user = await requireApiUser();
  enforceRateLimit(`logout-all:${user.id}`, 5, 15 * 60_000);
  await revokeSessions(user.id);
  await endSession();
  return json({ ok: true });
});
