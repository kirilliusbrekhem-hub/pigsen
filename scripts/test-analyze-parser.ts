// Unit tests for the statement parser and categorizer. Run: npx tsx scripts/test-analyze-parser.ts
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { decodeText, parseAmount, parseDate, parseFreeText, parseStatementText, sniff } from "../lib/analyze/parse";
import { categorize } from "../lib/analyze/categorize";
import { aggregate } from "../lib/analyze/aggregate";

const EXPECTED_ROWS = 90;
let ok = 0;
const t = (name: string, fn: () => void) => {
  fn();
  ok++;
  console.log(`✓ ${name}`);
};

t("amounts", () => {
  assert.equal(parseAmount("-1 234,56"), -1234.56);
  assert.equal(parseAmount("1 234.50 ₽"), 1234.5);
  assert.equal(parseAmount("+85 000,00"), 85000);
  assert.equal(parseAmount("−300"), -300);
  assert.equal(parseAmount("1,234.5"), 1234.5);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount("=1+2"), null);
});
t("dates", () => {
  assert.equal(parseDate("05.09.2026 14:05:00"), "2026-09-05");
  assert.equal(parseDate("2026-09-05"), "2026-09-05");
  assert.equal(parseDate("31.13.2026"), null);
});

let sum = -1;
for (const bank of ["sber", "tbank", "alfa"]) {
  t(`${bank} format`, () => {
    const bytes = new Uint8Array(readFileSync(new URL(`./fixtures/${bank}.csv`, import.meta.url)));
    assert.equal(sniff(bytes), "text");
    const txs = parseStatementText(decodeText(bytes));
    assert.equal(txs.length, EXPECTED_ROWS, "income and failed rows dropped");
    assert.ok(txs.every((x) => x.amount > 0 && /^2026-0[89]-\d\d$/.test(x.date!)));
    assert.ok(txs.some((x) => x.description === "Пятёрочка"), "cp1251/utf8 decoded");
    const total = Math.round(txs.reduce((s, x) => s + x.amount, 0));
    if (sum < 0) sum = total;
    assert.equal(total, sum, "same total across banks");
    const cats = txs.map(categorize);
    assert.equal(categorize(txs.find((x) => x.description === "Яндекс Еда")!), "delivery");
    assert.equal(categorize(txs.find((x) => x.description === "Кинопоиск")!), "subs");
    assert.ok(!cats.includes("other"));
    const r = aggregate(txs, cats);
    assert.equal(r.monthTotals.length, 2);
    assert.ok(r.leaks.some((l) => l.kind === "subs") && r.leaks.some((l) => l.kind === "delivery"));
    assert.equal(r.recommendations.length, 3);
  });
}

t("free text", () => {
  const txs = parseFreeText("12.09.2026 Пятёрочка -450,50\nТакси 380 ₽\nЗарплата +50000\nпросто строка");
  assert.equal(txs.length, 2);
  assert.equal(txs[0].amount, 450.5);
  assert.equal(txs[1].date, null);
});
t("sniff rejects binary/xlsx", () => {
  assert.equal(sniff(new Uint8Array([0x50, 0x4b, 3, 4])), "xlsx");
  assert.equal(sniff(new Uint8Array([0xff, 0xd8, 0xff, 0])), "jpeg");
  assert.throws(() => decodeText(new Uint8Array([65, 0, 66])));
});
console.log(`\n${ok} tests passed`);
