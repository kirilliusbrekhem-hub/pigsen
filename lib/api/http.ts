import "server-only";
import { NextResponse } from "next/server";
import { z, type ZodTypeAny } from "zod";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { rateLimit } from "./rate-limit";
import type { ApiError } from "@/types";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, string>) {
    super(message);
  }
}

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    const body: ApiError = { error: err.message, ...(err.details ? { details: err.details } : {}) };
    return NextResponse.json(body, { status: err.status });
  }
  console.error("[api] unhandled", err);
  // Show a short, non-sensitive cause (error class and Prisma code like P1001/P2024) so failures can be diagnosed from a screenshot.
  const e = err as { name?: string; code?: string; errorCode?: string };
  const tag = [e?.name && e.name !== "Error" ? e.name.replace(/^PrismaClient/, "DB") : null, e?.code ?? e?.errorCode].filter(Boolean).join(" ");
  return NextResponse.json<ApiError>({ error: `Что-то пошло не так. Попробуйте ещё раз.${tag ? ` (код: ${tag})` : ""}` }, { status: 500 });
}

export async function requireApiUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Нужно войти в аккаунт");
  return user;
}

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Некорректный JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const details: Record<string, string> = {};
    for (const issue of parsed.error.issues) details[issue.path.join(".") || "_"] = issue.message;
    throw new HttpError(422, "Проверьте введённые данные", details);
  }
  return parsed.data;
}

export function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const r = rateLimit(key, limit, windowMs);
  if (!r.ok) throw new HttpError(429, `Слишком много запросов. Попробуйте через ${r.retryAfterSeconds} с.`);
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** Wraps a route handler with uniform error handling. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
