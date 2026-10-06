import { handler, json, requireApiUser } from "@/lib/api/http";
import { vapidPublicKey } from "@/lib/push/config";

export const GET = handler(async () => {
  await requireApiUser();
  return json({ key: vapidPublicKey() });
});
