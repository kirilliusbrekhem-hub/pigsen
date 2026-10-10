import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

const PUBLIC_PAGES = new Set(["/", "/login", "/register", "/terms", "/privacy", "/offer", "/rules"]);
const AUTH_PAGES = new Set(["/login", "/register"]);
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers / server calls
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

function canonicalHost(): string | null {
  if (process.env.VERCEL_ENV !== "production" || !process.env.APP_URL) return null;
  try {
    return new URL(process.env.APP_URL).host;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // Session cookies are per host: visitors landing on a per-deploy *.vercel.app URL get logged out after
  // every deploy (the project's own production domain is never redirected, so a stale APP_URL can't 404 it). Send page views to the canonical APP_URL host (the _c flag stops any redirect loop).
  const canonical = canonicalHost();
  const host = req.headers.get("host");
  if (canonical && host && host !== canonical && host !== process.env.VERCEL_PROJECT_PRODUCTION_URL && host.endsWith(".vercel.app") && !isApi && req.method === "GET" && !req.nextUrl.searchParams.has("_c")) {
    const url = new URL(pathname + search, `https://${canonical}`);
    url.searchParams.set("_c", "1");
    return NextResponse.redirect(url, 308);
  }

  if (isApi && MUTATING.has(req.method) && !sameOrigin(req)) {
    return NextResponse.json({ error: "Запрос отклонён" }, { status: 403 });
  }

  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (isApi) {
    if (pathname.startsWith("/api/auth/") || pathname === "/api/billing/webhook" || pathname.startsWith("/api/telegram/") || pathname.startsWith("/api/cron/") || (pathname === "/api/visit" && req.method === "POST")) return NextResponse.next();
    if (!userId) return NextResponse.json({ error: "Нужно войти в аккаунт" }, { status: 401 });
    return NextResponse.next();
  }

  if (userId && (AUTH_PAGES.has(pathname) || pathname === "/") && !req.nextUrl.searchParams.has("gone")) {
    return NextResponse.redirect(new URL("/business", req.url));
  }
  if (!userId && !PUBLIC_PAGES.has(pathname)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|icon\.png.*|pig.png|sw.js|robots.txt|landing/|opengraph-image).*)"],
};
