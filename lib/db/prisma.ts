import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Behind Supabase's transaction pooler (pgbouncer=true) a single connection per server instance makes
 * pages that run many queries in parallel (the dashboard) hit Prisma's pool timeout. The pooler multiplexes
 * client connections, so allow a few per instance and wait longer before failing.
 */
function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw?.startsWith("postgres")) return undefined;
  try {
    const url = new URL(raw);
    if (url.searchParams.get("pgbouncer") === "true") {
      const limit = Number(url.searchParams.get("connection_limit") ?? "0");
      if (limit < 5) url.searchParams.set("connection_limit", "5");
      if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ datasourceUrl: datasourceUrl(), log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
