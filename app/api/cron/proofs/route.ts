import { timingSafeEqual } from "node:crypto";
import { handler, HttpError, json } from "@/lib/api/http";
import { purgeOldProofImages } from "@/lib/savings/proof";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Daily cron: deletes deposit screenshots older than 30 days, keeping only status (and hash against reuse). */
export const GET = handler(async (req: Request) => {
  if (!authorized(req)) throw new HttpError(401, "Unauthorized");
  return json(await purgeOldProofImages());
});
