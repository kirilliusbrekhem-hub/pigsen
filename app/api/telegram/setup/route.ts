import { NextResponse } from "next/server";
import { registerWebhook, starsEnabled, validSecret } from "@/lib/billing/telegram";

// One-time setup: open /api/telegram/setup?key=<TELEGRAM_WEBHOOK_SECRET> in the browser after deploying.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!starsEnabled()) return new NextResponse("Не заданы TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET в Vercel.", { status: 503 });
  if (!validSecret(url.searchParams.get("key"))) return new NextResponse("Неверный ключ.", { status: 401 });
  try {
    await registerWebhook(url.origin);
    return new NextResponse("Готово! Бот подключён к сайту, оплата Pro через Telegram Stars работает.", { headers: { "content-type": "text/plain; charset=utf-8" } });
  } catch (err) {
    return new NextResponse(`Не получилось: ${err instanceof Error ? err.message : "ошибка"}`, { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}
