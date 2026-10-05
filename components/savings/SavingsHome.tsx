"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import { dateRu, rub } from "@/lib/client/format";
import { THEMES } from "@/lib/savings/themes";
import { GoalArt } from "./GoalArt";
import { SpendCheck } from "./SpendCheck";

export interface GoalView {
  id: string;
  title: string;
  why: string;
  target: number;
  saved: number;
  theme: string;
  deadline: string | null;
  percent: number;
  needPerMonth: number | null;
  eta: string | null;
}

export function SavingsHome({ goals, themes, canCreate, quote }: { goals: GoalView[]; themes: string[]; canCreate: boolean; quote: string }) {
  const [open, setOpen] = useState(goals.length === 0);
  const total = goals.reduce((s, g) => s + g.saved, 0);
  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="save-hero card">
        <div>
          <span className="label">Всего в копилке</span>
          <b className="num save-total">{rub(total)}</b>
          <p className="muted">«{quote}»</p>
        </div>
        <Button variant="accent" onClick={() => setOpen((v) => !v)}>
          <Icon name="plus" size="sm" /> Новая цель
        </Button>
      </div>

      {open && (canCreate ? <NewGoalForm themes={themes} onDone={() => setOpen(false)} /> : <LimitNote />)}

      {goals.length > 0 && (
        <div className="goal-grid">
          {goals.map((g) => (
            <Link key={g.id} href={`/savings/${g.id}`} className="card goal-card clickable">
              <GoalArt theme={g.theme} percent={g.percent} title={g.title} />
              <div className="goal-card-body">
                <b>{g.title}</b>
                <span className="num">
                  {rub(g.saved)} <span className="muted">из {rub(g.target)}</span>
                </span>
                <div className="progress">
                  <i style={{ width: `${g.percent}%` }} />
                </div>
                <span className="muted goal-hint">
                  {g.percent >= 100
                    ? "Цель достигнута 🎉"
                    : g.needPerMonth !== null
                      ? `${rub(g.needPerMonth)} в месяц до ${dateRu(g.deadline!)}`
                      : g.eta
                        ? `При текущем темпе: ${dateRu(g.eta)}`
                        : "Сделайте первый взнос"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <SpendCheck goals={goals.map((g) => ({ id: g.id, title: g.title }))} />
    </div>
  );
}

function LimitNote() {
  return (
    <div className="card card-pad row" style={{ gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
      <span>На бесплатном плане можно вести до 3 целей одновременно.</span>
      <Link className="btn btn-accent btn-sm" href="/pro">
        <Icon name="sparkle" size="sm" /> Открыть Pro
      </Link>
    </div>
  );
}

function NewGoalForm({ themes, onDone }: { themes: string[]; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [target, setTarget] = useState("");
  const [initial, setInitial] = useState("");
  const [deadline, setDeadline] = useState("");
  const [theme, setTheme] = useState("piggy");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const r = await api<{ goal: { id: string } }>("/api/savings", {
        method: "POST",
        body: { title, why, target: Math.round(Number(target) || 0), initial: Math.round(Number(initial) || 0), theme, deadline: deadline || null },
      });
      toast.show("Цель создана! $PIG уже готов помочь.");
      onDone();
      router.push(`/savings/${r.goal.id}`);
    } catch (err) {
      const d = (err as { details?: Record<string, string> }).details;
      if (d) setErrors(d);
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card card-pad stack goal-form" style={{ gap: 14 }} onSubmit={submit}>
      <b>На что копим?</b>
      <div className="goal-form-grid">
        <label className="calc-field">
          <span>Цель</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Отпуск в Турции" maxLength={80} required />
          {errors.title && <small className="neg">{errors.title}</small>}
        </label>
        <label className="calc-field">
          <span>Сколько нужно, ₽</span>
          <input className="input" type="number" inputMode="numeric" min={100} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="150000" required />
          {errors.target && <small className="neg">{errors.target}</small>}
        </label>
        <label className="calc-field">
          <span>Уже есть, ₽</span>
          <input className="input" type="number" inputMode="numeric" min={0} value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0" />
        </label>
        <label className="calc-field">
          <span>К какому сроку (необязательно)</span>
          <input className="input" type="date" value={deadline} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDeadline(e.target.value)} />
          {errors.deadline && <small className="neg">{errors.deadline}</small>}
        </label>
      </div>
      <label className="calc-field">
        <span>Зачем это мне (поможет не сорваться)</span>
        <input className="input" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Хочу впервые свозить родителей на море" maxLength={300} />
      </label>
      <div className="stack" style={{ gap: 8 }}>
        <span className="label">Обложка</span>
        <div className="theme-pick">
          {THEMES.map((t) => {
            const locked = !themes.includes(t.id);
            return (
              <button
                type="button"
                key={t.id}
                className={`theme-opt ${theme === t.id ? "is-selected" : ""}`}
                style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
                onClick={() => (locked ? router.push("/pro") : setTheme(t.id))}
                aria-pressed={theme === t.id}
                title={locked ? `${t.label}: в Pro или в магазине` : t.label}
              >
                <Icon name={locked ? "lock" : t.icon} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <Button variant="accent" type="submit" loading={busy}>
          Создать цель
        </Button>
      </div>
    </form>
  );
}
