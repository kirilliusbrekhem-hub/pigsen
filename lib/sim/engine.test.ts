// Run: npx tsx --test lib/sim/engine.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, playTurn, turnView, finalScore, lessons, SIM_WEEKS, BIZ_KINDS, type WeekReport, type SimState } from "./engine";

function play(kind: (typeof BIZ_KINDS)[number], seed: number, pick: (w: number) => object) {
  let s: SimState = newGame(kind);
  const reps: WeekReport[] = [];
  while (s.status === "active") {
    const r = playTurn(s, seed, pick(s.week + 1));
    s = r.state;
    reps.push(r.report);
  }
  return { s, reps };
}

test("deterministic for same seed", () => {
  for (const k of BIZ_KINDS) assert.deepEqual(play(k, 42, () => ({ ad: 1, stock: 1 })), play(k, 42, () => ({ ad: 1, stock: 1 })));
});

test("sensible play finishes 12 weeks, passive play does not crash", () => {
  for (const k of BIZ_KINDS) {
    const { s, reps } = play(k, 7, () => ({ ad: 1, stock: 1 }));
    assert.ok(s.status === "finished" || s.status === "bankrupt");
    if (s.status === "finished") assert.equal(reps.length, SIM_WEEKS);
    assert.ok(finalScore(s) >= 0);
    assert.equal(lessons(s, reps).length, 3);
  }
});

test("reckless spending leads to bankruptcy", () => {
  const { s } = play("shop", 3, () => ({ ad: 2, stock: 2, staff: 1, price: "down" }));
  assert.equal(s.status, "bankrupt");
});

test("week view offers 2-4 decisions, unoffered decisions are ignored", () => {
  const s = newGame("coffee");
  const v = turnView(s, 1);
  assert.ok(v.decisions.length >= 2 && v.decisions.length <= 4);
  const r = playTurn(s, 1, { staff: 1, loan: "take" }); // week 1 offers neither
  assert.equal(r.state.staff, s.staff);
  assert.equal(r.state.loan, 0);
});

test("input state is not mutated", () => {
  const s = newGame("barber");
  const copy = { ...s };
  playTurn(s, 9, { price: "up" });
  assert.deepEqual(s, copy);
});
