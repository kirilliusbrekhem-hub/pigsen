import { handler, json, requireApiUser } from "@/lib/api/http";
import { listConversations } from "@/lib/social/dm";

export const GET = handler(async () => {
  const user = await requireApiUser();
  return json({ conversations: await listConversations(user.id) });
});
