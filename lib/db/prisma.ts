import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Runtime connection URL. Supabase's session pooler (port 5432) allows only ~15 clients in total, and every
 * serverless instance opens several, so a busy site exhausts it ("max clients reached") and pages start failing.
 * At runtime we therefore always go through the transaction pooler (port 6543, pgbouncer mode), which multiplexes
 * many clients, and cap each instance at a few connections. DIRECT_URL (session mode) stays for `prisma db push` only.
 */
function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw?.startsWith("postgres")) return undefined;
  try {
    const url = new URL(raw);
    if (url.hostname.endsWith(".pooler.supabase.com") && url.port === "5432") {
      url.port = "6543";
      url.searchParams.set("pgbouncer", "true");
    }
    if (url.searchParams.get("pgbouncer") === "true") {
      const limit = Number(url.searchParams.get("connection_limit") ?? "0");
      if (limit < 1 || limit > 5) url.searchParams.set("connection_limit", "5");
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
