import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { isUniqueViolation } from "@/lib/db/lock";
import { HttpError } from "@/lib/api/http";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";

/**
 * Proof of real savings: a screenshot of the bank transfer/balance attached to a deposit.
 * Unconfirmed deposits still count for the user's own piggy bank; only confirmed ones count for the business
 * leaderboard, challenges and the ✓ badge on team contributions. Images are wiped after PROOF_TTL_DAYS.
 */
export const MAX_PROOF_BYTES = 3 * 1024 * 1024;
export const PROOF_TTL_DAYS = 30;
export type ProofStatus = "pending" | "confirmed" | "rejected";
export type EntryProofState = "confirmed" | "pending" | "unconfirmed";
export const PROOF_LABELS: Record<EntryProofState, string> = { confirmed: "подтверждён", pending: "на проверке", unconfirmed: "не подтверждён" };
export const PRIVACY_NOTE = "Скрин видит только проверка, удаляем через 30 дней.";

/** Zod field for a proof data URL (~3 MB of bytes in base64). */
export const ProofImageField = z.string().max(4_300_000, "Скриншот больше 3 МБ");

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

type Kind = "jpeg" | "png" | "webp";
function sniff(b: Buffer): Kind | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null;
}

const bad = () => new HttpError(422, "Файл повреждён или это не картинка", { proof: "Неверный формат" });

/** Drops EXIF/XMP/comments (APP1–APP13, APP15, COM). Keeps JFIF (APP0) and Adobe (APP14) colour info. */
function stripJpeg(b: Buffer): Buffer {
  const out: Buffer[] = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) throw bad();
    while (b[i] === 0xff && i < b.length) i++; // fill bytes
    const marker = b[i];
    i++;
    if (marker === 0xd9) {
      out.push(Buffer.from([0xff, 0xd9]));
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(Buffer.from([0xff, marker]));
      continue;
    }
    if (i + 2 > b.length) throw bad();
    const len = b.readUInt16BE(i);
    if (len < 2 || i + len > b.length) throw bad();
    const seg = b.subarray(i - 2, i + len);
    if (marker === 0xda) {
      out.push(b.subarray(i - 2)); // start of scan: the rest is image data
      break;
    }
    const drop = (marker >= 0xe1 && marker <= 0xed) || marker === 0xef || marker === 0xfe;
    if (!drop) out.push(seg);
    i += len;
  }
  return Buffer.concat(out);
}

const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
function stripPng(b: Buffer): Buffer {
  const out: Buffer[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = b.readUInt32BE(i);
    const type = b.toString("latin1", i + 4, i + 8);
    const end = i + 12 + len;
    if (end > b.length) throw bad();
    if (!PNG_DROP.has(type)) out.push(b.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(out);
}

function stripWebp(b: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const type = b.toString("latin1", i, i + 4);
    const len = b.readUInt32LE(i + 4);
    const end = i + 8 + len + (len % 2);
    if (i + 8 + len > b.length) throw bad();
    if (type !== "EXIF" && type !== "XMP ") {
      const c = Buffer.from(b.subarray(i, Math.min(end, b.length)));
      if (type === "VP8X" && c.length > 8) c[8] &= ~0x0c; // clear the EXIF and XMP flags
      chunks.push(c);
    }
    i = end;
  }
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(12);
  head.write("RIFF", 0, "latin1");
  head.writeUInt32LE(body.length + 4, 4);
  head.write("WEBP", 8, "latin1");
  return Buffer.concat([head, body]);
}

/** Validates a data URL (type by magic bytes, ≤ 3 MB), strips metadata and hashes the result. */
export function prepareProofImage(dataUrl: string): { bytes: Buffer; mime: string; hash: string } {
  const m = DATA_URL.exec(dataUrl);
  if (!m) throw new HttpError(422, "Нужна картинка JPEG, PNG или WebP", { proof: "Неверный формат" });
  const raw = Buffer.from(m[2], "base64");
  if (raw.length > MAX_PROOF_BYTES) throw new HttpError(422, "Скриншот больше 3 МБ", { proof: "Слишком большой файл" });
  const kind = sniff(raw);
  if (!kind) throw new HttpError(422, "Нужна картинка JPEG, PNG или WebP", { proof: "Неверный формат" });
  const bytes = kind === "jpeg" ? stripJpeg(raw) : kind === "png" ? stripPng(raw) : stripWebp(raw);
  return { bytes, mime: `image/${kind}`, hash: createHash("sha256").update(bytes).digest("hex") };
}

export async function assertFreshHash(hash: string) {
  if (await prisma.depositProof.findUnique({ where: { imageHash: hash }, select: { id: true } })) {
    throw new HttpError(409, "Этот скриншот уже использовался для другого взноса", { proof: "Скриншот уже был" });
  }
}

/** Upload limits: 10 an hour, 30 a day per user. */
export async function limitProofUploads(userId: string) {
  await enforceDbRateLimit(`proof-h:${userId}`, 10, 3_600_000);
  await enforceDbRateLimit(`proof-d:${userId}`, 30, 86_400_000);
}

// ───────────── AI check (Gemini vision when configured) ─────────────

const Verdict = z.object({
  bank: z.boolean(),
  amount: z.number().nonnegative().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});
type CheckResult = { status: "confirmed" | "pending"; note: string; by: string };

export const proofVisionEnabled = () => !!process.env.GEMINI_API_KEY?.trim();

/** Decides from a model verdict. Never auto-rejects: anything doubtful goes to a human. */
export function judge(v: z.infer<typeof Verdict>, amount: number, now = new Date()): CheckResult {
  if (!v.bank) return { status: "pending", note: "ИИ: не похоже на банковское приложение", by: "ai" };
  if (v.amount === null || Math.abs(v.amount - amount) > Math.max(1, amount * 0.02)) return { status: "pending", note: `ИИ: сумма не совпала (${v.amount ?? "не найдена"})`, by: "ai" };
  if (!v.date) return { status: "pending", note: "ИИ: дата не найдена", by: "ai" };
  const age = (now.getTime() - new Date(`${v.date}T12:00:00Z`).getTime()) / 86_400_000;
  if (age > 7 || age < -2) return { status: "pending", note: `ИИ: дата не свежая (${v.date})`, by: "ai" };
  return { status: "confirmed", note: "ИИ: сумма и дата совпали", by: "ai" };
}

async function aiCheck(bytes: Buffer, mime: string, amount: number): Promise<CheckResult | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const prompt = `Это скриншот из банковского приложения? Найди сумму перевода/пополнения в рублях и дату операции. Верни только JSON: {"bank": true|false, "amount": число или null, "date": "YYYY-MM-DD" или null}. Сегодня ${new Date().toISOString().slice(0, 10)}.`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: bytes.toString("base64") } }, { text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 512 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const v = Verdict.safeParse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
    return v.success ? judge(v.data, amount) : null;
  } catch {
    return null;
  }
}

/**
 * Attaches a prepared proof to the user's own deposit entry, then checks it (AI if available, otherwise the admin queue).
 * IDOR: the entry must belong to one of the user's goals and be a deposit without a proof yet.
 */
export async function attachProof(userId: string, entryId: string, img: { bytes: Buffer; mime: string; hash: string }) {
  const entry = await prisma.savingsEntry.findFirst({ where: { id: entryId, goal: { userId } }, include: { proof: { select: { id: true, status: true } } } });
  if (!entry) throw new HttpError(404, "Взнос не найден");
  if (entry.amount <= 0) throw new HttpError(422, "Подтверждать нужно только пополнения");
  if (entry.proof && entry.proof.status !== "rejected") throw new HttpError(409, "К этому взносу уже приложен скриншот");
  await assertFreshHash(img.hash);
  let proofId: string;
  try {
    const data = { userId, amount: entry.amount, status: "pending", image: new Uint8Array(img.bytes), mime: img.mime, imageHash: img.hash, checkedBy: "", note: "", reviewedAt: null, purgedAt: null };
    const p = entry.proof ? await prisma.depositProof.update({ where: { id: entry.proof.id }, data: { ...data, createdAt: new Date() } }) : await prisma.depositProof.create({ data: { ...data, entryId } });
    proofId = p.id;
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, "Этот скриншот уже использовался для другого взноса", { proof: "Скриншот уже был" });
    throw e;
  }
  const r = await aiCheck(img.bytes, img.mime, entry.amount);
  if (r) await prisma.depositProof.update({ where: { id: proofId }, data: { status: r.status, note: r.note, checkedBy: r.by, reviewedAt: r.status === "confirmed" ? new Date() : null } });
  const status: EntryProofState = r?.status === "confirmed" ? "confirmed" : "pending";
  return { id: proofId, status, label: PROOF_LABELS[status] };
}

export const entryProofState = (p: { status: string } | null | undefined): EntryProofState =>
  p?.status === "confirmed" ? "confirmed" : p?.status === "pending" ? "pending" : "unconfirmed";

// ───────────── confirmed savings (for biz leaderboard, challenges, team ✓) ─────────────

/**
 * Net real savings that count publicly: confirmed deposits minus all withdrawals, by entry date (≥ since).
 * Can be negative. Unconfirmed deposits never count here.
 */
export async function confirmedSavings(userId: string, since?: Date): Promise<number> {
  return (await confirmedSavingsMany([userId], since)).get(userId) ?? 0;
}

/** Batch form of confirmedSavings: userId → net confirmed savings. */
export async function confirmedSavingsMany(userIds: string[], since?: Date): Promise<Map<string, number>> {
  const out = new Map<string, number>(userIds.map((id) => [id, 0]));
  if (!userIds.length) return out;
  const date = since ? { createdAt: { gte: since } } : {};
  const [dep, wd] = await Promise.all([
    prisma.depositProof.groupBy({ by: ["userId"], where: { userId: { in: userIds }, status: "confirmed", entry: date }, _sum: { amount: true } }),
    prisma.savingsEntry.findMany({ where: { amount: { lt: 0 }, goal: { userId: { in: userIds } }, ...date }, select: { amount: true, goal: { select: { userId: true } } } }),
  ]);
  for (const d of dep) out.set(d.userId, (out.get(d.userId) ?? 0) + (d._sum.amount ?? 0));
  for (const w of wd) out.set(w.goal.userId, (out.get(w.goal.userId) ?? 0) + w.amount);
  return out;
}

/** Confirmed deposits only (no withdrawals), for the team ✓ badge. */
export async function confirmedDeposits(userIds: string[], since?: Date): Promise<Map<string, number>> {
  const out = new Map<string, number>(userIds.map((id) => [id, 0]));
  if (!userIds.length) return out;
  const rows = await prisma.depositProof.groupBy({ by: ["userId"], where: { userId: { in: userIds }, status: "confirmed", ...(since ? { entry: { createdAt: { gte: since } } } : {}) }, _sum: { amount: true } });
  for (const r of rows) out.set(r.userId, r._sum.amount ?? 0);
  return out;
}

/** "Подтверждено X из Y ₽": deposits of the user (or one goal) split by proof state. */
export async function proofMeter(userId: string, goalId?: string) {
  const entries = await prisma.savingsEntry.findMany({
    where: { amount: { gt: 0 }, goal: { userId, ...(goalId ? { id: goalId } : {}) } },
    select: { amount: true, proof: { select: { status: true } } },
  });
  let total = 0;
  let confirmed = 0;
  let pending = 0;
  for (const e of entries) {
    total += e.amount;
    const s = entryProofState(e.proof);
    if (s === "confirmed") confirmed += e.amount;
    else if (s === "pending") pending += e.amount;
  }
  return { total, confirmed, pending };
}

// ───────────── admin review + retention ─────────────

export async function listProofs(status: ProofStatus, take = 50) {
  return prisma.depositProof.findMany({
    where: { status },
    orderBy: { createdAt: status === "pending" ? "asc" : "desc" },
    take,
    select: { id: true, amount: true, status: true, note: true, checkedBy: true, createdAt: true, reviewedAt: true, purgedAt: true, mime: true, userId: true, entry: { select: { createdAt: true, note: true, goal: { select: { title: true, user: { select: { id: true, name: true, email: true } } } } } } },
  });
}

export async function reviewProof(adminId: string, id: string, action: "approve" | "reject", note = "") {
  const status = action === "approve" ? "confirmed" : "rejected";
  const r = await prisma.depositProof.updateMany({ where: { id, status: { not: status } }, data: { status, checkedBy: `admin:${adminId}`, reviewedAt: new Date(), ...(note ? { note } : {}) } });
  if (!r.count && !(await prisma.depositProof.findUnique({ where: { id }, select: { id: true } }))) throw new HttpError(404, "Не найдено");
  return { id, status };
}

export async function proofImage(id: string) {
  return prisma.depositProof.findUnique({ where: { id }, select: { image: true, mime: true } });
}

/** Wipes screenshots older than 30 days; keeps status and hash (so the image can't be reused). */
export async function purgeOldProofImages(now = new Date()) {
  const r = await prisma.depositProof.updateMany({
    where: { image: { not: null }, createdAt: { lt: new Date(now.getTime() - PROOF_TTL_DAYS * 86_400_000) } },
    data: { image: null, purgedAt: now },
  });
  return { purged: r.count };
}

/**
 * Dated ledger behind confirmedSavings (for investor deals): confirmed deposits (+) and all withdrawals (−) of these users
 * since a date, by entry date. Summing it gives confirmedSavings.
 */
export async function confirmedLedger(userIds: string[], since: Date): Promise<{ amount: number; at: number }[]> {
  if (!userIds.length) return [];
  const rows = await prisma.savingsEntry.findMany({
    where: { goal: { userId: { in: userIds } }, createdAt: { gte: since }, OR: [{ amount: { lt: 0 } }, { proof: { status: "confirmed" } }] },
    select: { amount: true, createdAt: true },
  });
  return rows.map((r) => ({ amount: r.amount, at: r.createdAt.getTime() }));
}
