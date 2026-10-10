import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { DISCLAIMER_TEXT } from "./disclaimer";
import type { PlanView } from "./service";

// Geist (SIL OFL) ships with the `geist` package and covers Cyrillic and ₽.
const FONT_DIR = path.join(process.cwd(), "node_modules", "geist", "dist", "fonts", "geist-sans");
let fontCache: Promise<[Uint8Array, Uint8Array]> | null = null;
const loadFonts = () => (fontCache ??= Promise.all([readFile(path.join(FONT_DIR, "Geist-Regular.ttf")), readFile(path.join(FONT_DIR, "Geist-SemiBold.ttf"))]));

const GREEN = rgb(0x0e / 255, 0x7a / 255, 0x52 / 255);
const GREEN_SOFT = rgb(0xe2 / 255, 0xf0 / 255, 0xe8 / 255);
const INK = rgb(0x0c / 255, 0x11 / 255, 0x14 / 255);
const INK2 = rgb(0.38, 0.42, 0.41);
const LINE = rgb(0.89, 0.9, 0.88);
const W = 595.28;
const H = 841.89;
const M = 48;

const num = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)).replace(/ | /g, " ");
const rub = (n: number) => `${num(n)} ₽`;
const mon = (n: number | null) => (n === null ? "> 36 мес." : `${n} мес.`);

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont, private watermark: boolean) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([W, H]);
    this.y = H - M;
    if (this.watermark) {
      this.page.drawText("Kapital Free", { x: 120, y: 300, size: 72, font: this.bold, color: GREEN, opacity: 0.08, rotate: degrees(35) });
    }
  }
  ensure(h: number) {
    if (this.y - h < M + 20) this.newPage();
  }
  wrap(text: string, size: number, width: number, f = this.font): string[] {
    const out: string[] = [];
    for (const para of text.replace(/\r/g, "").split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(next, size) > width && line) {
          out.push(line);
          line = word;
        } else line = next;
      }
      out.push(line);
    }
    return out;
  }
  text(text: string, { size = 10.5, f = this.font, color = INK, gap = 4, x = M, width = W - 2 * M } = {}) {
    for (const line of this.wrap(text, size, width, f)) {
      this.ensure(size + 4);
      this.page.drawText(line, { x, y: this.y - size, size, font: f, color });
      this.y -= size + 4;
    }
    this.y -= gap;
  }
  heading(t: string) {
    this.ensure(60);
    this.y -= 10;
    this.page.drawRectangle({ x: M, y: this.y - 16, width: 4, height: 16, color: GREEN });
    this.page.drawText(t, { x: M + 12, y: this.y - 14, size: 14, font: this.bold, color: INK });
    this.y -= 28;
  }
  table(head: string[], rows: string[][], widths: number[]) {
    const size = 8.5;
    const rowH = 15;
    const draw = (cells: string[], f: PDFFont, bg?: typeof GREEN_SOFT) => {
      this.ensure(rowH);
      if (bg) this.page.drawRectangle({ x: M, y: this.y - rowH + 3, width: W - 2 * M, height: rowH, color: bg });
      let x = M + 4;
      cells.forEach((c, i) => {
        const w = widths[i];
        const tw = f.widthOfTextAtSize(c, size);
        this.page.drawText(c, { x: i === 0 ? x : x + w - tw - 8, y: this.y - 8, size, font: f, color: INK });
        x += w;
      });
      this.page.drawLine({ start: { x: M, y: this.y - rowH + 3 }, end: { x: W - M, y: this.y - rowH + 3 }, thickness: 0.5, color: LINE });
      this.y -= rowH;
    };
    draw(head, this.bold, GREEN_SOFT);
    rows.forEach((r) => draw(r, this.font));
    this.y -= 8;
  }
}

export async function renderPlanPdf(plan: PlanView, opts: { watermark: boolean }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [reg, semi] = await loadFonts();
  const font = await doc.embedFont(reg, { subset: true });
  const bold = await doc.embedFont(semi, { subset: true });
  doc.setTitle(`Бизнес-план: ${plan.title}`);
  doc.setAuthor("Kapital");
  doc.setCreator("Kapital · Бизнес-план за 10 минут");
  const w = new Writer(doc, font, bold, opts.watermark);
  const { model: m, input, sections: s } = plan;

  // Cover band
  w.page.drawRectangle({ x: 0, y: H - 130, width: W, height: 130, color: INK });
  w.page.drawText("Kapital", { x: M, y: H - 50, size: 12, font: bold, color: GREEN });
  w.page.drawText("Бизнес-план", { x: M, y: H - 70, size: 10, font, color: rgb(0.8, 0.84, 0.82) });
  const titleLines = w.wrap(plan.title, 24, W - 2 * M, bold).slice(0, 2);
  titleLines.forEach((l, i) => w.page.drawText(l, { x: M, y: H - 100 - i * 26, size: 24, font: bold, color: rgb(1, 1, 1) }));
  w.y = H - 150;

  // KPIs
  const kpis: [string, string][] = [
    ["Стартовые вложения", rub(m.startup)],
    ["Окупаемость", mon(m.payback)],
    ["Безубыточность", m.breakEvenUnits === null ? "недостижима" : `${num(m.breakEvenUnits)} продаж/мес`],
    ["Прибыль за год", rub(m.year.net)],
  ];
  const kw = (W - 2 * M - 30) / 4;
  kpis.forEach(([label, value], i) => {
    const x = M + i * (kw + 10);
    w.page.drawRectangle({ x, y: w.y - 52, width: kw, height: 52, color: GREEN_SOFT });
    w.page.drawText(label, { x: x + 8, y: w.y - 18, size: 8, font, color: INK2 });
    w.page.drawText(value, { x: x + 8, y: w.y - 38, size: 12, font: bold, color: m.year.net < 0 && i === 3 ? rgb(0.69, 0.25, 0.17) : GREEN });
  });
  w.y -= 70;

  w.heading("Резюме");
  w.text(s.summary);
  w.heading("Рынок и конкуренты");
  w.text(s.market);
  if (input.competitors.some((c) => c.name)) {
    w.table(["Конкурент", "Цена", "Комментарий"], input.competitors.filter((c) => c.name).map((c) => [c.name.slice(0, 40), rub(c.price), c.note.slice(0, 50)]), [200, 100, 199]);
  }
  w.heading("Маркетинг и каналы");
  w.text(s.marketing);

  w.heading("Финансовая модель: 12 месяцев");
  w.text(`Цена ${rub(input.price)}, себестоимость ${rub(input.unitCost)}, маржа ${m.marginPct}%. Постоянные расходы ${rub(m.monthlyFixed)} в месяц, налог ${input.taxPct}% с прибыли.`, { size: 9, color: INK2 });
  // Bar chart: revenue (green) and net profit (ink), cash line
  w.ensure(170);
  const ch = 120;
  const top = w.y - 10;
  const base = top - ch;
  const max = Math.max(1, ...m.months.map((r) => Math.max(r.revenue, Math.abs(r.net), Math.abs(r.cash))));
  const zero = base + ch / 2;
  const sc = ch / 2 / max;
  w.page.drawLine({ start: { x: M, y: zero }, end: { x: W - M, y: zero }, thickness: 0.6, color: LINE });
  const slot = (W - 2 * M) / 12;
  m.months.forEach((r, i) => {
    const x = M + i * slot + 4;
    w.page.drawRectangle({ x, y: zero, width: slot / 2 - 4, height: Math.max(0.5, r.revenue * sc), color: GREEN });
    w.page.drawRectangle({ x: x + slot / 2 - 4, y: r.net >= 0 ? zero : zero + r.net * sc, width: slot / 2 - 4, height: Math.max(0.5, Math.abs(r.net) * sc), color: INK });
    w.page.drawText(String(r.month), { x: x + slot / 2 - 8, y: base - 12, size: 7, font, color: INK2 });
    if (i > 0) {
      const p = m.months[i - 1];
      w.page.drawLine({ start: { x: M + (i - 1) * slot + slot / 2, y: zero + p.cash * sc }, end: { x: M + i * slot + slot / 2, y: zero + r.cash * sc }, thickness: 1.5, color: GREEN, dashArray: [3, 2] });
    }
  });
  w.y = base - 22;
  w.text("Зелёные столбцы — выручка, чёрные — чистая прибыль, пунктир — накопленный денежный поток.", { size: 8, color: INK2 });
  w.table(
    ["Мес.", "Продажи", "Выручка", "Расходы", "Прибыль", "Деньги"],
    m.months.map((r) => [String(r.month), num(r.units), num(r.revenue), num(r.cogs + r.fixed + r.marketing + r.team + r.tax), num(r.net), num(r.cash)]),
    [50, 70, 95, 95, 95, 94],
  );
  w.table(["Итого за год", "", num(m.year.revenue), num(m.year.costs + m.year.tax), num(m.year.net), ""], [], [50 + 70, 0, 95, 95, 95, 94]);

  w.heading("Чувствительность: прибыль за год");
  const cell = (p: number, v: number) => m.sensitivity.find((c) => c.priceDelta === p && c.volumeDelta === v)!;
  w.table(
    ["Цена \\ продажи", "−20%", "план", "+20%"],
    [-0.2, 0, 0.2].map((p) => [p === 0 ? "план" : p < 0 ? "−20%" : "+20%", ...[-0.2, 0, 0.2].map((v) => `${rub(cell(p, v).yearNet)} · ${mon(cell(p, v).payback)}`)]),
    [110, 130, 130, 129],
  );

  w.heading("Стартовые и ежемесячные расходы");
  w.table(["Стартовые вложения", "Сумма"], [...input.startup.map((x) => [x.name, rub(x.amount)]), ["Итого", rub(m.startup)]], [380, 119]);
  w.table(
    ["Ежемесячно", "Сумма"],
    [...input.monthly.map((x) => [x.name, rub(x.amount)]), ...input.channels.map((x) => [`Маркетинг: ${x.name}`, rub(x.amount)]), ...input.team.map((x) => [`Команда: ${x.name}`, rub(x.amount)]), ["Итого", rub(m.monthlyFixed)]],
    [380, 119],
  );

  w.heading("Риски и как их снизить");
  s.risks.forEach((r, i) => {
    w.text(`${i + 1}. ${r.risk}`, { f: bold, gap: 0 });
    w.text(r.mitigation, { x: M + 14, width: W - 2 * M - 14, color: INK2 });
  });

  w.y -= 10;
  w.text(DISCLAIMER_TEXT, { size: 8, color: INK2 });
  if (opts.watermark) w.text("Создано на бесплатном тарифе Kapital. В Pro — без водяного знака и без лимита планов.", { size: 8, color: GREEN });

  // Page numbers
  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(`Kapital · ${i + 1}/${pages.length}`, { x: W - M - 70, y: 24, size: 8, font, color: INK2 }));
  return doc.save();
}
