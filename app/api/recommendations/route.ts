import { handler, json, requireApiUser } from "@/lib/api/http";
import { getRecommendations } from "@/lib/recommendations/service";

export const GET = handler(async () => {
  const user = await requireApiUser();
  return json({ items: await getRecommendations(user.id, 6) });
});
