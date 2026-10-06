import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

const PUBLIC_PAGES = new Set(["/", "/login", "/register"]);
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

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isApi && MUTATING.has(req.method) && !sameOrigin(req)) {
    return NextResponse.json({ error: "Запрос отклонён" }, { status: 403 });
  }

  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (isApi) {
    if (pathname.startsWith("/api/auth/") || pathname === "/api/billing/webhook" || pathname.startsWith("/api/telegram/") || pathname.startsWith("/api/cron/")) return NextResponse.next();
    if (!userId) return NextResponse.json({ error: "Нужно войти в аккаунт" }, { status: 401 });
    return NextResponse.next();
  }

  if (userId && (AUTH_PAGES.has(pathname) || pathname === "/") && !req.nextUrl.searchParams.has("gone")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (!userId && !PUBLIC_PAGES.has(pathname)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|icon\.png.*|pig.png|sw.js|robots.txt).*)"],
};
