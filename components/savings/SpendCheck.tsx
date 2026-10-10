"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Orb } from "@/components/ui/Orb";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import { rub } from "@/lib/client/format";

interface Result {
  amount: number;
  percentOfGoal: number | null;
  delayDays: number | null;
  goalTitle: string | null;
  future5: number;
  future10: number;
  verdict: string;
  tip: string;
  alternative: string;
  demo: boolean;
}

/** "What happens if I spend it?" with CAP's take and a one-tap "save it instead". */
export function SpendCheck({ goals, defaultGoal }: { goals: Array<{ id: string; title: string }>; defaultGoal?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [item, setItem] = useState("");
  const [goalId, setGoalId] = useState(defaultGoal ?? goals[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [saved, setSaved] = useState(false);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      setRes(await api<Result>("/api/savings/spend", { method: "POST", body: { amount: Math.round(Number(amount) || 0), item, goalId: goalId || null } }));
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  async function resist() {
    if (!res || !goalId) return;
    setBusy(true);
    try {
      const r = await api<{ coins: number; milestone: number | null }>("/api/savings/resist", { method: "POST", body: { goalId, amount: res.amount, item } });
      setSaved(true);
      toast.show(`Сильное решение! ${rub(res.amount)} в копилке${r.coins ? `, +${r.coins} PigCoin$` : ""}.${r.milestone ? ` Пройдено ${r.milestone}% цели!` : ""}`);
      router.refresh();
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-pad stack spend-card" style={{ gap: 14 }} id="spend">
      <div className="row" style={{ gap: 12 }}>
        <Orb thinking={busy} />
        <div>
          <b>Что будет, если я потрачу?</b>
          <p className="muted" style={{ fontSize: 13 }}>
            Введите покупку, и CAP покажет, как она скажется на вашей цели и сколько эти деньги могли бы стать.
          </p>
        </div>
      </div>
      <form className="spend-form" onSubmit={check}>
        <input className="input" value={item} onChange={(e) => setItem(e.target.value)} placeholder="Что хочу купить: новые кроссовки" maxLength={120} aria-label="Покупка" />
        <input className="input" type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма, ₽" required aria-label="Сумма" />
        {goals.length > 0 && (
          <select className="input" value={goalId} onChange={(e) => setGoalId(e.target.value)} aria-label="Цель">
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        )}
        <Button variant="primary" type="submit" loading={busy} disabled={!Number(amount)}>
          Проверить
        </Button>
      </form>

      {res && (
        <div className="spend-res fade-in">
          <div className="calc-kpis">
            {res.percentOfGoal !== null && (
              <div>
                <span className="label">Доля цели</span>
                <b className="num">{res.percentOfGoal}%</b>
              </div>
            )}
            {res.delayDays !== null && (
              <div>
                <span className="label">Цель отодвинется</span>
                <b className="num neg">на {res.delayDays} дн.</b>
              </div>
            )}
            <div>
              <span className="label">Через 10 лет при 8%</span>
              <b className="num pos">{rub(res.future10)}</b>
            </div>
          </div>
          <p>{res.verdict}</p>
          <p className="muted">
            <Icon name="bulb" size="sm" /> {res.tip}
          </p>
          <p className="muted">
            <Icon name="repeat" size="sm" /> {res.alternative}
          </p>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            {goals.length > 0 && !saved && (
              <Button variant="accent" onClick={resist} loading={busy}>
                <Icon name="piggy" size="sm" /> Не трачу, кладу в копилку
              </Button>
            )}
            {saved && <span className="pos">Отложено в копилку ✓</span>}
            <span className="muted" style={{ fontSize: 12 }}>
              {res.demo ? "Базовый разбор. В Pro CAP разбирает каждую трату." : "Разбор от CAP."} Это не финансовая рекомендация.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
