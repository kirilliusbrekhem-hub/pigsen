import { handler, json } from "@/lib/api/http";
import { endSession } from "@/lib/auth/session";

export const POST = handler(async () => {
  await endSession();
  return json({ ok: true });
});
