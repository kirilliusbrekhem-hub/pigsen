import { timingSafeEqual } from "node:crypto";
import { handler, HttpError, json } from "@/lib/api/http";
import { awardLastWeek } from "@/lib/social/leaderboard";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Weekly cron: awards last week's leaderboard winners (idempotent). */
export const GET = handler(async (req: Request) => {
  if (!authorized(req)) throw new HttpError(401, "Unauthorized");
  return json(await awardLastWeek());
});
