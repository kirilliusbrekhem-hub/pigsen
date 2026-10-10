// Runs once when a server instance starts. Makes sure the additive Kapital columns exist even if the
// build-time `prisma db push` did not reach the production database. Every statement is idempotent.
const STATEMENTS = [
  `ALTER TABLE "BizBusiness" ADD COLUMN IF NOT EXISTS "idea" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "BizBusiness" ADD COLUMN IF NOT EXISTS "pitch" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "BizBusiness" ADD COLUMN IF NOT EXISTS "typeLabel" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "BizBusiness" ADD COLUMN IF NOT EXISTS "target" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "BizBusiness" ADD COLUMN IF NOT EXISTS "monthly" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "BizBusiness" ADD COLUMN IF NOT EXISTS "plan" JSONB NOT NULL DEFAULT '[]'`,
  `ALTER TABLE "BizMember" ADD COLUMN IF NOT EXISTS "goalId" TEXT`,
];

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { prisma } = await import("./lib/db/prisma");
    for (const sql of STATEMENTS) await prisma.$executeRawUnsafe(sql);
  } catch (e) {
    console.error("[instrumentation] schema check failed", e);
  }
}
