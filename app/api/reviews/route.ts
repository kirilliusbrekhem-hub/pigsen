import { enforceRateLimit, handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { myReview, reviewSchema, upsertReview } from "@/lib/growth/reviews";

export const GET = handler(async () => {
  const user = await requireApiUser();
  return json({ review: await myReview(user.id) });
});

export const PUT = handler(async (req: Request) => {
  const user = await requireApiUser();
  enforceRateLimit(`review:${user.id}`, 10, 60 * 60_000);
  const input = await parseBody(req, reviewSchema);
  return json({ review: await upsertReview(user.id, input) });
});
