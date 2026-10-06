"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Coin } from "@/components/ui/Coin";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import { CHALLENGES, DIFFICULTY_LABEL, type Challenge } from "@/lib/social/challenges";

export interface DoneInfo {
  note: string;
  date: string;
}

function Card({ c, done, locked }: { c: Challenge; done?: DoneInfo; locked: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const len = note.trim().length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ coins: number }>(`/api/challenges/${c.id}/complete`, { method: "POST", body: { note } });
      toast.show(`Челлендж выполнен! +${r.coins} PigCoin$`);
      router.refresh();
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article id={c.id} className={`card card-pad ch-card${done ? " is-done" : ""}${locked ? " is-locked" : ""}`} data-testid="challenge">
      <div className="ch-top">
        <span className={`ch-diff ch-${c.difficulty}`}>{DIFFICULTY_LABEL[c.difficulty]}</span>
        <span className="ch-topic">{c.topic}</span>
        <span className="ch-reward">
          +{c.reward} <Coin size={14} />
        </span>
      </div>
      <h3>{c.title}</h3>
      <ol className="ch-steps">
        {c.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {done ? (
        <div className="ch-done">
          <Icon name="check" size="sm" /> Выполнено {new Date(done.date).toLocaleDateString("ru-RU")}
          <p className="muted">{done.note}</p>
        </div>
      ) : locked ? (
        <Link href="/pro" className="btn btn-secondary btn-sm">
          <Icon name="lock" size="sm" /> Доступно в Pro
        </Link>
      ) : open ? (
        <form className="ch-form" onSubmit={submit}>
          <label className="label" htmlFor={`n-${c.id}`}>
            {c.proof}
          </label>
          <textarea id={`n-${c.id}`} className="input textarea" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Коротко расскажи, как прошло (10–500 символов)" />
          <div className="ch-actions">
            <span className="muted">{len}/500</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button className="btn btn-primary btn-sm" disabled={busy || len < 10}>
              Готово
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
          Я выполнил
        </button>
      )}
    </article>
  );
}

export function ChallengeList({ done, pro }: { done: Record<string, DoneInfo>; pro: boolean }) {
  return (
    <div className="ch-grid">
      {CHALLENGES.map((c) => (
        <Card key={c.id} c={c} done={done[c.id]} locked={!pro && !c.free} />
      ))}
    </div>
  );
}
