import "server-only";
import type { Prisma } from "@prisma/client";

/** Serializes concurrent work on one key (e.g. a userId) until the surrounding transaction ends. */
export async function advisoryLock(tx: Prisma.TransactionClient, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

export const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === "P2002";
