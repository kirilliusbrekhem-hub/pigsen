"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RunView } from "@/lib/sim/service";
import type { BizKind, DecisionKey, Decisions } from "@/lib/sim/engine";
import { rub } from "@/lib/client/format";

interface KindCard {
  kind: BizKind;
  title: string;
  emoji: string;
  blurb: string;
  startCash: number;
}
interface Recent {
  id: string;
  title: string;
  status: string;
  score: number | null;
  week: number;
}

async function api(url: string, body?: unknown): Promise<{ run: RunView }> {
  const res = await fetch(url, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Не получилось. Попробуйте ещё раз.");
  return data;
}

const delta = (n: number) => (n > 0 ? `+${n.toLocaleString("ru-RU")}` : n.toLocaleString("ru-RU"));

export function SimGame({ initial, kinds, recent, runsLeft, pro }: { initial: RunView | null; kinds: KindCard[]; recent: Recent[]; runsLeft: number | null; pro: boolean }) {
  const [run, setRun] = useState<RunView | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState<Partial<Decisions>>({});

  async function start(kind: BizKind) {
    setBusy(true);
    setError("");
    try {
      setRun((await api("/api/sim", { kind })).run);
      setChoice({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function play() {
    if (!run?.turn) return;
    setBusy(true);
    setError("");
    try {
      setRun((await api(`/api/sim/${run.id}/turn`, { week: run.turn.week, decisions: choice })).run);
      setChoice({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!run) {
    const blocked = runsLeft === 0;
    return (
      <div className="sim stack">
        <p className="muted sim-limit">{pro ? "Pro: игр без ограничений." : blocked ? "Сегодняшняя бесплатная игра сыграна. Возвращайтесь завтра или откройте Pro." : "Бесплатно: 1 игра в день. С Pro — без ограничений."}</p>
        {blocked && !pro && <Link href="/pro" className="btn btn-primary btn-sm sim-pro">Открыть Pro</Link>}
        <div className="sim-kinds">
          {kinds.map((k) => (
            <button key={k.kind} type="button" className="card sim-kind" disabled={busy || blocked} onClick={() => start(k.kind)}>
              <span className="sim-kind-emoji" aria-hidden>{k.emoji}</span>
              <b>{k.title}</b>
              <span className="muted">{k.blurb}</span>
              <span className="sim-kind-cash">Старт: {rub(k.startCash)}</span>
            </button>
          ))}
        </div>
        {error && <p className="sim-error" role="alert">{error}</p>}
        {recent.length > 0 && (
          <div className="card card-pad stack">
            <span className="label">Прошлые игры</span>
            {recent.map((r) => (
              <Link key={r.id} href={`/sim/${r.id}`} className="sim-recent">
                <span>{r.title}</span>
                <span className="muted">{r.status === "bankrupt" ? `банкрот на ${r.week} нед.` : `${r.score ?? 0} очков`}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const s = run.state;
  const last = run.history[run.history.length - 1];
  const metrics = [
    { k: "Касса", v: rub(s.cash), d: last ? delta(last.report.profit) + " ₽" : "", neg: (last?.report.profit ?? 0) < 0 },
    { k: "Выручка", v: rub(s.lastRevenue), d: "за неделю" },
    { k: "Расходы", v: rub(s.lastCosts), d: "за неделю" },
    { k: "Клиенты", v: s.lastCustomers.toLocaleString("ru-RU"), d: last?.report.lost ? `упущено ${last.report.lost}` : run.unit, neg: !!last?.report.lost },
    { k: "Рейтинг", v: s.rating.toFixed(1), d: last ? delta(last.report.ratingDelta) : "из 5", neg: (last?.report.ratingDelta ?? 0) < 0 },
    { k: "Склад", v: s.stock.toLocaleString("ru-RU"), d: run.unit },
  ];

  return (
    <div className="sim stack">
      <div className="sim-head">
        <span className="label">{run.emoji} {run.title}</span>
        <span className="sim-week">{run.turn ? `Неделя ${run.turn.week} из 12` : run.status === "bankrupt" ? "Банкротство" : "Игра окончена"}</span>
      </div>
      <div className="sim-progress" aria-hidden><i style={{ width: `${(s.week / 12) * 100}%` }} /></div>

      <div className="sim-metrics">
        {metrics.map((m) => (
          <div key={m.k} className="card sim-metric">
            <span className="label">{m.k}</span>
            <b className="num">{m.v}</b>
            <span className={m.neg ? "sim-neg" : "muted"}>{m.d}</span>
          </div>
        ))}
      </div>

      {last && (
        <div className="card card-pad sim-review" data-testid="sim-review">
          <span className="label">$PIG о неделе {last.report.week}{last.ai ? "" : " · шаблон"}</span>
          <p>{last.review}</p>
        </div>
      )}

      {run.turn && (
        <div className="card card-pad stack sim-turn">
          <div className="sim-event">
            <span className="label">Событие недели</span>
            <b>{run.turn.event.title}</b>
            <span className="muted">{run.turn.event.text}</span>
          </div>
          {run.turn.decisions.map((d) => {
            const current = choice[d.key] ?? d.options.find((o) => ["keep", 0, "none"].includes(o.value as string | number))?.value ?? d.options[0].value;
            return (
              <fieldset key={d.key} className="sim-decision">
                <legend>{d.title}</legend>
                <div className="sim-options">
                  {d.options.map((o) => (
                    <button
                      key={String(o.value)}
                      type="button"
                      className={`sim-option${current === o.value ? " is-on" : ""}`}
                      aria-pressed={current === o.value}
                      onClick={() => setChoice((c) => ({ ...c, [d.key as DecisionKey]: o.value }))}
                    >
                      <b>{o.label}</b>
                      <span>{o.hint}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            );
          })}
          {error && <p className="sim-error" role="alert">{error}</p>}
          <button type="button" className="btn btn-primary" disabled={busy} onClick={play}>
            {busy ? "Считаем неделю…" : "Сыграть неделю"}
          </button>
        </div>
      )}

      {run.result && <ResultCard run={run} />}

      {run.history.length > 1 && (
        <details className="card card-pad sim-log">
          <summary>История недель</summary>
          <table>
            <thead>
              <tr><th>Нед.</th><th>Выручка</th><th>Прибыль</th><th>Касса</th><th>Рейт.</th></tr>
            </thead>
            <tbody>
              {run.history.map((h) => (
                <tr key={h.report.week}>
                  <td>{h.report.week}</td>
                  <td>{h.report.revenue.toLocaleString("ru-RU")}</td>
                  <td className={h.report.profit < 0 ? "sim-neg" : ""}>{delta(h.report.profit)}</td>
                  <td>{h.report.cash.toLocaleString("ru-RU")}</td>
                  <td>{h.report.rating.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

function ResultCard({ run }: { run: RunView }) {
  const r = run.result!;
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  function newGame() {
    // /sim remounts the game (keyed by the active run) once the server sees no active run.
    router.push("/sim");
    router.refresh();
  }
  const text = `Я прошёл бизнес-симулятор PìgBiz: ${run.title}, ${run.status === "bankrupt" ? `продержался ${run.state.week} нед.` : `12 недель, капитал ${rub(r.netWorth)}`} — ${r.score} очков («${r.grade}»).`;
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: "PìgBiz · Бизнес-симулятор", text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }
    } catch {
      /* cancelled */
    }
  }
  return (
    <>
      <div className="sim-result" data-testid="sim-result">
        <span className="sim-result-brand">PìgBiz · Бизнес-симулятор</span>
        <span className="sim-result-kind">{run.emoji} {run.title}</span>
        <b className="sim-result-score">{r.score}</b>
        <span className="sim-result-grade">{r.grade}</span>
        <div className="sim-result-row">
          <span>Капитал<b>{rub(r.netWorth)}</b></span>
          <span>Рейтинг<b>{run.state.rating.toFixed(1)}</b></span>
          <span>Недель<b>{run.state.week}/12</b></span>
        </div>
        {r.reward > 0 && <span className="sim-result-reward">+{r.reward} PigCoin$</span>}
      </div>
      <div className="sim-result-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={share}>{copied ? "Скопировано ✓" : "Поделиться"}</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={newGame}>Новая игра</button>
      </div>
      {r.reward === 0 && <p className="muted">Награда PigCoin$ за симулятор начисляется раз в день — сегодня уже получена.</p>}
      <div className="card card-pad stack">
        <span className="label">Уроки этой игры</span>
        <ol className="sim-lessons">
          {r.lessons.map((l) => <li key={l}>{l}</li>)}
        </ol>
      </div>
    </>
  );
}
