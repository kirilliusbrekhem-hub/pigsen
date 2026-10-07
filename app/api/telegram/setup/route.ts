import { NextResponse } from "next/server";
import { registerWebhook, starsEnabled, validSecret } from "@/lib/billing/telegram";

// One-time setup after deploying: send the secret in the `x-setup-key` header, or open
// /api/telegram/setup?key=<TELEGRAM_WEBHOOK_SECRET> in the browser. Compared in constant time.
// The webhook URL is built from APP_URL when set (not from the request's Host header).
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!starsEnabled()) return new NextResponse("Не заданы TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET в Vercel.", { status: 503 });
  if (!validSecret(req.headers.get("x-setup-key") ?? url.searchParams.get("key"))) return new NextResponse("Неверный ключ.", { status: 401 });
  try {
    await registerWebhook(process.env.APP_URL ? new URL(process.env.APP_URL).origin : url.origin);
    return new NextResponse("Готово! Бот подключён к сайту, оплата Pro через Telegram Stars работает.", { headers: { "content-type": "text/plain; charset=utf-8" } });
  } catch (err) {
    return new NextResponse(`Не получилось: ${err instanceof Error ? err.message : "ошибка"}`, { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}
