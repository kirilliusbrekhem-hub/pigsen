import type { Instrumentation } from "next";

export async function register() {}

/** Persists server errors to ErrorLog (shown on /admin/metrics). Never throws. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const e = err as Error & { digest?: string };
    const { prisma } = await import("@/lib/db/prisma");
    await prisma.errorLog.create({
      data: {
        message: String(e?.message ?? err).slice(0, 1000),
        digest: String(e?.digest ?? "").slice(0, 100),
        path: String(request.path ?? "").slice(0, 300),
        method: String(request.method ?? "").slice(0, 10),
        routeType: String(context.routeType ?? ""),
        routePath: String(context.routePath ?? "").slice(0, 300),
        stack: String(e?.stack ?? "").slice(0, 4000),
      },
    });
  } catch (e) {
    console.error("[instrumentation] failed to log error", e);
  }
};
