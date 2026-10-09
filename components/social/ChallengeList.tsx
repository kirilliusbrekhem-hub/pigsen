"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Coin } from "@/components/ui/Coin";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import { CHALLENGES, DIFFICULTY_LABEL, type Challenge } from "@/lib/social/challenges";
import { fileToGoalImage } from "@/components/savings/GoalImage";

export interface DoneInfo {
  note: string;
  date: string;
}

/** Admin review state of the latest proof: pending («на проверке») or rejected with a reason. */
export interface ProofInfo {
  status: string;
  comment: string;
  item: string;
}

function Card({ c, done, locked, proof }: { c: Challenge; done?: DoneInfo; locked: boolean; proof?: ProofInfo }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const len = note.trim().length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/challenges/${c.id}/complete`, { method: "POST", body: { note, image } });
      toast.show("Отправлено на проверку. После одобрения — PigCoin$ и уникальный предмет в бизнес");
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
      ) : proof?.status === "pending" ? (
        <div className="ch-done" data-testid="challenge-pending">
          <Icon name="clock" size="sm" /> На проверке у модератора
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
          {proof?.status === "rejected" && <p className="muted" data-testid="challenge-rejected">Не принято: {proof.comment}. Исправьте и отправьте ещё раз.</p>}
          <textarea id={`n-${c.id}`} className="input textarea" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Коротко расскажи, как прошло (10–500 символов)" />
          <label className="muted">
            Фото (необязательно):{" "}
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                try {
                  setImage(f ? await fileToGoalImage(f) : null);
                } catch (err) {
                  toast.show((err as Error).message, { kind: "err" });
                }
              }}
            />
          </label>
          <div className="ch-actions">
            <span className="muted">{len}/500</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button className="btn btn-primary btn-sm" disabled={busy || len < 10}>
              Отправить на проверку
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
          {proof?.status === "rejected" ? "Отправить ещё раз" : "Я выполнил"}
        </button>
      )}
    </article>
  );
}

export function ChallengeList({ done, pro, proofs = {} }: { done: Record<string, DoneInfo>; pro: boolean; proofs?: Record<string, ProofInfo> }) {
  return (
    <div className="ch-grid">
      {CHALLENGES.map((c) => (
        <Card key={c.id} c={c} done={done[c.id]} locked={!pro && !c.free} proof={proofs[c.id]} />
      ))}
    </div>
  );
}
