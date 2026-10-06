import { handler, json } from "@/lib/api/http";
import { requireApiAdmin } from "@/lib/admin/auth";
import { listReviews } from "@/lib/growth/reviews";

export const GET = handler(async (req: Request) => {
  await requireApiAdmin();
  const s = new URL(req.url).searchParams.get("status");
  const status = s === "approved" || s === "rejected" ? s : "pending";
  return json({ reviews: await listReviews(status) });
});
