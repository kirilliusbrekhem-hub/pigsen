// Pure bank-statement parsing (no I/O, no eval). Used by the API and by scripts/test-analyze-parser.ts.

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 5000;
export const MAX_TEXT_CHARS = 200_000;

export interface Tx {
  /** YYYY-MM-DD, or null when the source had no date. */
  date: string | null;
  /** Spending amount in rubles, always positive. */
  amount: number;
  description: string;
  bankCategory: string;
  mcc: string;
}

export class ParseError extends Error {}

const clean = (s: string) =>
  s
    .replace(/[\u0000-\u001F\u007F​-‏﻿]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

/** Decodes bytes as UTF-8, falling back to Windows-1251 (Sber/Alfa exports). Rejects binary content. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes.includes(0)) throw new ParseError("Файл похож на двоичный. Загрузите CSV-выписку.");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1251").decode(bytes);
  }
}

export type Sniffed = "text" | "xlsx" | "xls" | "pdf" | "jpeg" | "png" | "webp" | "unknown";
export function sniff(b: Uint8Array): Sniffed {
  const at = (i: number, ...xs: number[]) => xs.every((x, k) => b[i + k] === x);
  if (at(0, 0x50, 0x4b, 0x03, 0x04)) return "xlsx";
  if (at(0, 0xd0, 0xcf, 0x11, 0xe0)) return "xls";
  if (at(0, 0x25, 0x50, 0x44, 0x46)) return "pdf";
  if (at(0, 0xff, 0xd8, 0xff)) return "jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "png";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "webp";
  return b.subarray(0, 4096).includes(0) ? "unknown" : "text";
}

function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).slice(0, 20);
  let best = ",";
  let bestScore = -1;
  for (const d of [";", ",", "\t", "|"]) {
    const counts = lines.map((l) => l.split(d).length - 1).filter((n) => n > 0);
    const score = counts.length ? counts.reduce((a, c) => a + c, 0) / lines.length + counts.length : 0;
    if (score > bestScore) [best, bestScore] = [d, score];
  }
  return best;
}

/** RFC-4180-ish CSV with quotes. */
export function parseCsv(text: string, delim = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else if (c === '"' && cell.trim() === "") {
      q = true;
      cell = "";
    } else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
      if (rows.length > MAX_ROWS + 20) throw new ParseError(`Слишком много строк: максимум ${MAX_ROWS} операций.`);
    } else cell += c;
    if (cell.length > 2000) throw new ParseError("Слишком длинное значение в ячейке. Проверьте формат файла.");
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/** "-1 234,56", "1 234.56 ₽", "+500", "−300" → number; null when not a number. */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[\s  ]/g, "").replace(/[−–—]/g, "-").replace(/(руб\.?|rub|₽|р\.)$/i, "");
  if (!/^[+-]?\d[\d.,']*$/.test(s)) return null;
  s = s.replace(/'/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if ((s.match(/\./g) ?? []).length > 1) return null;
  const n = Number(s);
  return Number.isFinite(n) && Math.abs(n) < 1e10 ? n : null;
}

/** dd.mm.yyyy[ hh:mm[:ss]], dd.mm.yy, yyyy-mm-dd[Thh:mm] → YYYY-MM-DD. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let r = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:[ T,]+\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(s);
  if (r) {
    d = +r[1];
    m = +r[2];
    y = r[3].length === 2 ? 2000 + +r[3] : +r[3];
  } else if ((r = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(s))) {
    y = +r[1];
    m = +r[2];
    d = +r[3];
  } else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

type Col = "date" | "amount" | "desc" | "category" | "mcc" | "type" | "status";
const HEADER: Record<Col, RegExp[]> = {
  date: [/^дата операции/, /^дата и время/, /^дата$/, /^operation ?date/, /^date/, /^дата/],
  amount: [/^сумма платежа/, /сумма в валюте сч[её]та/, /сумма в рублях/, /^сумма операции/, /^сумма$/, /^amount/, /^сумма(?!.*(кэшб|бонус|округл|комисс))/],
  desc: [/^описание/, /назначение/, /контрагент|получатель|merchant|место/, /^description/],
  category: [/^категория/, /^category/],
  mcc: [/^mcc/],
  type: [/^тип/, /направлени/, /^type/, /приход.?расход/],
  status: [/^статус/, /^status/],
};

function mapHeader(cells: string[]): Partial<Record<Col, number>> | null {
  const norm = cells.map((c) => clean(c).toLowerCase());
  const out: Partial<Record<Col, number>> = {};
  for (const col of Object.keys(HEADER) as Col[]) {
    for (const re of HEADER[col]) {
      const i = norm.findIndex((c, k) => re.test(c) && !Object.values(out).includes(k));
      if (i >= 0) {
        out[col] = i;
        break;
      }
    }
  }
  return out.date !== undefined && out.amount !== undefined ? out : null;
}

/** No header: guess columns from the data itself. */
function guessColumns(rows: string[][]): Partial<Record<Col, number>> | null {
  const sample = rows.slice(0, 50);
  const width = Math.max(...sample.map((r) => r.length));
  const share = (f: (s: string) => boolean, i: number) => sample.filter((r) => r[i] !== undefined && f(r[i])).length / sample.length;
  let date = -1, amount = -1, desc = -1, bestLen = 0;
  for (let i = 0; i < width && date < 0; i++) if (share((s) => !!parseDate(s), i) > 0.6) date = i;
  for (let i = width - 1; i >= 0 && amount < 0; i--) if (i !== date && share((s) => parseAmount(s) !== null && /[.,]|^-|^\+/.test(s.trim()), i) > 0.6) amount = i;
  for (let i = 0; i < width && amount < 0; i++) if (i !== date && share((s) => parseAmount(s) !== null, i) > 0.6) amount = i;
  for (let i = 0; i < width; i++) {
    if (i === date || i === amount) continue;
    const len = sample.reduce((a, r) => a + (/[a-zа-яё]/i.test(r[i] ?? "") ? (r[i] ?? "").length : 0), 0);
    if (len > bestLen) [desc, bestLen] = [i, len];
  }
  if (date < 0 || amount < 0) return null;
  return { date, amount, ...(desc >= 0 ? { desc } : {}) };
}

const EXPENSE_TYPE = /расход|списан|debit|покупк|оплат|снят/i;
const INCOME_TYPE = /пополн|приход|зачисл|credit|доход|возврат|поступ/i;
const BAD_STATUS = /failed|отклон|отмен|declin|cancel/i;

/** Table rows → spending transactions. Income, failed and zero rows are dropped. */
export function rowsToTransactions(rows: string[][]): Tx[] {
  let start = 0;
  let cols: Partial<Record<Col, number>> | null = null;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    cols = mapHeader(rows[i]);
    if (cols) {
      start = i + 1;
      break;
    }
  }
  if (!cols) cols = guessColumns(rows);
  if (!cols) throw new ParseError("Не нашли столбцы с датой и суммой. Нужна CSV-выписка Сбера, Т-Банка, Альфы или похожая.");
  const data = rows.slice(start);
  if (data.length > MAX_ROWS) throw new ParseError(`Слишком много строк: максимум ${MAX_ROWS} операций.`);
  const get = (r: string[], c: Col) => (cols![c] !== undefined ? (r[cols![c]!] ?? "") : "");

  const parsed = data
    .map((r) => ({ r, date: parseDate(get(r, "date")), amount: parseAmount(get(r, "amount")), raw: get(r, "amount").trim() }))
    .filter((x) => x.date && x.amount !== null && x.amount !== 0 && !BAD_STATUS.test(get(x.r, "status")));
  const anyNegative = parsed.some((x) => x.amount! < 0);

  const out: Tx[] = [];
  for (const x of parsed) {
    const type = get(x.r, "type");
    let expense: boolean;
    if (cols.type !== undefined && EXPENSE_TYPE.test(type)) expense = true;
    else if (cols.type !== undefined && INCOME_TYPE.test(type)) expense = false;
    else if (anyNegative) expense = x.amount! < 0;
    else expense = !x.raw.startsWith("+");
    if (!expense) continue;
    out.push({
      date: x.date,
      amount: Math.round(Math.abs(x.amount!) * 100) / 100,
      description: clean(get(x.r, "desc")) || clean(get(x.r, "category")) || "Без описания",
      bankCategory: clean(get(x.r, "category")),
      mcc: /^\d{4}$/.test(get(x.r, "mcc").trim()) ? get(x.r, "mcc").trim() : "",
    });
  }
  return out;
}

export function parseStatementText(text: string): Tx[] {
  if (text.length > MAX_TEXT_CHARS * 12) throw new ParseError("Файл слишком большой.");
  const rows = parseCsv(text);
  const width = Math.max(0, ...rows.slice(0, 50).map((r) => r.length));
  if (width >= 2) {
    try {
      const txs = rowsToTransactions(rows);
      if (txs.length) return txs;
    } catch (e) {
      if (!(e instanceof ParseError) || /строк/.test(e.message)) throw e;
    }
  }
  return parseFreeText(text);
}

/** Pasted lines like "12.09 Пятёрочка -450,50" or "Такси 380 ₽". */
export function parseFreeText(text: string): Tx[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > MAX_ROWS) throw new ParseError(`Слишком много строк: максимум ${MAX_ROWS}.`);
  const year = new Date().getFullYear();
  const out: Tx[] = [];
  for (const line of lines) {
    let rest = line;
    let date: string | null = null;
    const dm = /(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/.exec(rest);
    if (dm) {
      const ds = dm[1];
      date = parseDate(/^\d{1,2}\.\d{1,2}$/.test(ds) ? `${ds}.${year}` : ds);
      if (date) rest = rest.replace(dm[0], " ");
    }
    const am = /([+\-−]?\s?\d{1,3}(?:[  ]\d{3})*(?:[.,]\d{1,2})?|[+\-−]?\d+(?:[.,]\d{1,2})?)\s*(?:₽|руб\.?|р\.?)?\s*$/i.exec(rest.trim());
    if (!am) continue;
    const amount = parseAmount(am[1]);
    if (amount === null || amount === 0 || am[1].trim().startsWith("+")) continue;
    const description = clean(rest.trim().slice(0, rest.trim().length - am[0].length).replace(/[;,|\t]+/g, " "));
    if (!description) continue;
    out.push({ date, amount: Math.abs(amount), description, bankCategory: "", mcc: "" });
  }
  return out;
}
