import { HttpError, handler, json, requireApiUser } from "@/lib/api/http";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { MAX_FILE_BYTES, MAX_TEXT_CHARS, ParseError, decodeText, parseFreeText, parseStatementText, sniff, type Tx } from "@/lib/analyze/parse";
import { analyze, assertQuota, listAnalyses, quota, saveAnalysis } from "@/lib/analyze/service";
import { receiptToTransactions, visionEnabled } from "@/lib/analyze/vision";

export const GET = handler(async () => {
  const user = await requireApiUser();
  const [items, q] = await Promise.all([listAnalyses(user.id), quota(user.id, user.profile)]);
  return json({ items, quota: q });
});

const IMAGE_MIME = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

/** multipart/form-data: `file` (CSV statement or receipt photo) or `text` (pasted lines). Nothing is stored but the aggregate. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  await enforceDbRateLimit(`analyze:${user.id}`, 6, 10 * 60_000);
  await assertQuota(user.id, user.profile);
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_FILE_BYTES + 64 * 1024) throw new HttpError(413, "Файл больше 2 МБ");
  if (!(req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) throw new HttpError(415, "Ожидается форма с файлом");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Не удалось прочитать форму");
  }
  const file = form.get("file");
  const text = form.get("text");
  let txs: Tx[];
  let source: string;
  try {
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) throw new HttpError(413, "Файл больше 2 МБ");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const kind = sniff(bytes);
      if (kind === "jpeg" || kind === "png" || kind === "webp") {
        if (!visionEnabled()) throw new HttpError(422, "Разбор фото чеков скоро появится. Пока загрузите CSV-выписку.");
        txs = await receiptToTransactions(bytes, IMAGE_MIME[kind]);
        source = "photo";
      } else if (kind === "xlsx" || kind === "xls") {
        throw new HttpError(415, "Excel пока не поддерживается: сохраните выписку как CSV (Файл → Сохранить как → CSV).");
      } else if (kind === "text") {
        txs = parseStatementText(decodeText(bytes));
        source = "csv";
      } else throw new HttpError(415, "Поддерживаются CSV-выписки и фото чеков (JPG, PNG, WebP).");
    } else if (typeof text === "string" && text.trim()) {
      if (text.length > MAX_TEXT_CHARS) throw new HttpError(413, "Слишком длинный текст: до 200 000 символов.");
      txs = parseStatementText(text);
      if (!txs.length) txs = parseFreeText(text);
      source = "text";
    } else throw new HttpError(422, "Загрузите файл или вставьте текст выписки");
  } catch (e) {
    if (e instanceof ParseError) throw new HttpError(422, e.message);
    throw e;
  }
  const result = await analyze(txs);
  const saved = await saveAnalysis(user.id, user.profile, source, result);
  return json({ id: saved.id, createdAt: saved.createdAt, source, result }, 201);
});
