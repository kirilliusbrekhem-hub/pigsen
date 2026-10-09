"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Orb } from "@/components/ui/Orb";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import { reward } from "@/components/fx";
import { dateRu, rub } from "@/lib/client/format";
import type { GoalView } from "./SavingsHome";
import { ProofPicker } from "./Proof";

interface Advice {
  message: string;
  plan: string[];
  challenge: string;
  demo: boolean;
  mode: "edu" | "partner";
}

const QUICK = [500, 1000, 5000];

export function GoalActions({ goal }: { goal: GoalView }) {
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState<number | null>(null);

  async function add(sign: 1 | -1, value?: number) {
    const n = Math.round(value ?? Number(amount));
    if (!n || n < 0) return;
    setBusy(true);
    try {
      const withProof = sign > 0 && proof ? { proof } : {};
      const r = await api<{ coins: number; milestone: number | null; proof?: { label: string } | null; proofError?: string }>(`/api/savings/${goal.id}/entries`, { method: "POST", body: { amount: sign * n, note, ...withProof } });
      setAmount("");
      setNote("");
      setProof(null);
      if (r.proofError) toast.show(`Взнос сохранён, но скриншот не принят: ${r.proofError}`, { kind: "err" });
      if (r.milestone) setCelebrate(r.milestone);
      if (sign > 0) reward({ coins: r.coins, origin: document.activeElement, power: r.milestone ? (r.milestone >= 100 ? 3 : 2) : r.coins ? 0.8 : 0 });
      if (!r.proofError) toast.show(sign > 0 ? `+${rub(n)} в копилку${r.coins ? `, +${r.coins} PigCoin$` : ""}${r.proof ? ` · ${r.proof.label}` : ""}` : `Снято ${rub(n)}`);
      router.refresh();
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-pad stack" style={{ gap: 12 }}>
      {celebrate && (
        <div className="celebrate fade-in" role="status">
          <span className="celebrate-big">🎉</span>
          <div>
            <b>{celebrate >= 100 ? "Цель достигнута!" : `Пройдено ${celebrate}% цели!`}</b>
            <p className="muted">{celebrate >= 100 ? "Вы доказали себе, что умеете копить. Поставьте следующую цель." : "Каждый этап приближает мечту. Так держать!"}</p>
          </div>
          <button className="icon-btn" onClick={() => setCelebrate(null)} aria-label="Закрыть">
            <Icon name="close" />
          </button>
        </div>
      )}
      <b>Пополнить копилку</b>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {QUICK.map((q) => (
          <button key={q} className="chip" onClick={() => add(1, q)} disabled={busy}>
            +{rub(q)}
          </button>
        ))}
      </div>
      <form
        className="spend-form"
        onSubmit={(e) => {
          e.preventDefault();
          void add(1);
        }}
      >
        <input className="input" type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма, ₽" aria-label="Сумма" />
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий (необязательно)" maxLength={120} aria-label="Комментарий" />
        <Button variant="accent" type="submit" loading={busy} disabled={!Number(amount)}>
          Отложить
        </Button>
        <Button variant="ghost" type="button" disabled={busy || !Number(amount)} onClick={() => add(-1)}>
          Снять
        </Button>
      </form>
      <ProofPicker value={proof} onChange={setProof} disabled={busy} />
    </section>
  );
}

export function Coach({ goalId, partner = false }: { goalId: string; partner?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);

  async function ask() {
    setBusy(true);
    try {
      setAdvice(await api<Advice>(`/api/savings/${goalId}/coach`, { method: "POST" }));
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-pad stack coach-card" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 12 }}>
          <Orb thinking={busy} />
          <div>
            <b>{partner ? "$PIG-партнёр" : "$PIG-коуч"}</b>
            <p className="muted" style={{ fontSize: 13 }}>
              {partner ? "Личный план под твою цель, идеи «давай попробуем…» и задание на неделю." : "Объяснит, что значат ваши цифры и как посчитать план самому."}
            </p>
          </div>
        </div>
        <Button variant="primary" onClick={ask} loading={busy}>
          <Icon name="sparkle" size="sm" /> {advice ? "Новый совет" : "Получить совет"}
        </Button>
      </div>
      {advice && (
        <div className="stack fade-in" style={{ gap: 10 }}>
          <span className="label" data-testid="coach-mode" data-mode={advice.mode}>
            {advice.mode === "partner" ? "Личный план партнёра" : "Объяснение"}
          </span>
          <p>{advice.message}</p>
          <ol className="coach-plan">
            {advice.plan.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
          <div className="coach-challenge">
            <Icon name="target" size="sm" />
            <span>
              <b>{advice.mode === "partner" ? "Челлендж недели:" : "Упражнение:"}</b> {advice.challenge}
            </span>
          </div>
          {advice.mode === "edu" && (
            <div className="pig-lock" data-testid="coach-lock">
              <span className="ic" aria-hidden>
                <Icon name="lock" size="sm" />
              </span>
              <div>
                <b>Личный план от $PIG-партнёра — в Pro</b>
                <p>Партнёр сам предложит, сколько и когда откладывать под вашу цель, подкинет идеи и напомнит завтра.</p>
                <Link href="/pro" className="btn btn-primary btn-sm">
                  Открыть Pro
                </Link>
              </div>
            </div>
          )}
          {advice.demo && <span className="muted" style={{ fontSize: 12 }}>Базовый совет. Лимит советов $PIG на сегодня исчерпан или AI недоступен; в Pro советы без ограничений.</span>}
        </div>
      )}
    </section>
  );
}

export function GoalDanger({ goalId }: { goalId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  async function remove() {
    try {
      await api(`/api/savings/${goalId}`, { method: "DELETE" });
      toast.show("Цель удалена");
      router.push("/savings");
      router.refresh();
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    }
  }
  return confirm ? (
    <div className="row" style={{ gap: 8 }}>
      <span className="muted">Удалить цель и историю?</span>
      <button className="btn btn-danger btn-sm" onClick={remove}>
        Удалить
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>
        Отмена
      </button>
    </div>
  ) : (
    <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(true)}>
      <Icon name="trash" size="sm" /> Удалить цель
    </button>
  );
}

export function GoalNumbers({ goal, pacePerMonth }: { goal: GoalView; pacePerMonth: number }) {
  return (
    <div className="calc-kpis">
      <div>
        <span className="label">Осталось</span>
        <b className="num">{rub(Math.max(0, goal.target - goal.saved))}</b>
      </div>
      <div>
        <span className="label">Темп</span>
        <b className="num">{rub(pacePerMonth)}/мес</b>
      </div>
      <div>
        <span className="label">{goal.needPerMonth !== null ? "Нужно в месяц" : "Финиш при темпе"}</span>
        <b className="num">{goal.needPerMonth !== null ? rub(goal.needPerMonth) : goal.eta ? dateRu(goal.eta) : "—"}</b>
      </div>
    </div>
  );
}
