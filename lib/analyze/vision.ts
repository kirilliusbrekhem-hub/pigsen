import "server-only";
import { z } from "zod";
import type { Tx } from "./parse";
import { ParseError } from "./parse";

// The shared AIProvider interface is text-only (YandexGPT has no vision); receipts go to Gemini directly when its key is set.
export const visionEnabled = () => !!process.env.GEMINI_API_KEY?.trim();

const MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"];
const Receipt = z.object({
  store: z.string().max(80).default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  items: z.array(z.object({ name: z.string().min(1).max(80), amount: z.number().positive().max(1_000_000) })).max(200),
});

export async function receiptToTransactions(bytes: Uint8Array, mime: string): Promise<Tx[]> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new ParseError("Разбор фото чеков скоро появится.");
  const models = [process.env.GEMINI_MODEL?.trim(), ...MODELS].filter((m): m is string => !!m);
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [
      { inline_data: { mime_type: mime, data: Buffer.from(bytes).toString("base64") } },
      { text: 'Это фото кассового чека. Верни только JSON: {"store":"название магазина","date":"YYYY-MM-DD или null","items":[{"name":"товар","amount":итоговая цена позиции в рублях числом}]}. Если это не чек — {"store":"","date":null,"items":[]}.' },
    ] }],
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4096 },
  });
  for (const model of [...new Set(models)]) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body,
      signal: AbortSignal.timeout(45_000),
    }).catch(() => null);
    if (!res?.ok) continue;
    const data = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    } catch {
      continue;
    }
    const r = Receipt.safeParse(parsed);
    if (!r.success) continue;
    if (!r.data.items.length) throw new ParseError("Не удалось распознать чек. Сфотографируйте его ровно и при хорошем свете.");
    const store = r.data.store.replace(/[\u0000-\u001F<>]/g, "").trim();
    return r.data.items.map((it) => ({ date: r.data.date, amount: Math.round(it.amount * 100) / 100, description: `${store ? `${store}: ` : ""}${it.name}`.replace(/[\u0000-\u001F<>]/g, "").slice(0, 120), bankCategory: store, mcc: "" }));
  }
  throw new ParseError("Сервис распознавания чеков сейчас недоступен. Попробуйте позже.");
}
