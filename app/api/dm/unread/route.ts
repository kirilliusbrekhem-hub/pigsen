import { handler, json, requireApiUser } from "@/lib/api/http";
import { unreadCount } from "@/lib/social/dm";

export const GET = handler(async () => {
  const user = await requireApiUser();
  return json({ unread: await unreadCount(user.id) });
});
