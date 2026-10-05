import { NextResponse } from "next/server";
import { handleUpdate, validSecret } from "@/lib/billing/telegram";

// Telegram bot webhook. Only Telegram knows the secret token we registered with setWebhook.
export async function POST(req: Request) {
  if (!validSecret(req.headers.get("x-telegram-bot-api-secret-token"))) return NextResponse.json({ ok: false }, { status: 401 });
  const update = await req.json().catch(() => null);
  try {
    if (update) await handleUpdate(update);
  } catch (err) {
    console.error("[telegram] update failed", err instanceof Error ? err.message : err);
  }
  return NextResponse.json({ ok: true });
}
