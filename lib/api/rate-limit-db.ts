import "server-only";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "./http";

/**
 * Fixed-window limiter in Postgres (RateHit), shared by every serverless instance.
 * One atomic upsert per hit: the window resets once resetAt has passed.
 */
export async function dbRateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateHit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + ${windowMs} * interval '1 millisecond')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateHit"."resetAt" < now() THEN 1 ELSE "RateHit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateHit"."resetAt" < now() THEN now() + ${windowMs} * interval '1 millisecond' ELSE "RateHit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  if (!row || row.count <= limit) return { ok: true, retryAfterSeconds: 0 };
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((new Date(row.resetAt).getTime() - Date.now()) / 1000)) };
}

export async function enforceDbRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const r = await dbRateLimit(key, limit, windowMs);
  if (!r.ok) throw new HttpError(429, `Слишком много запросов. Попробуйте через ${r.retryAfterSeconds} с.`);
}
