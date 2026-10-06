"use client";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client/api";

type Review = { rating: number; text: string; status: string } | null;

const STATUS: Record<string, string> = {
  pending: "На проверке. Пока отзыв не проверен, его можно изменить.",
  approved: "Одобрен, награда начислена. Спасибо!",
  rejected: "Отклонён модератором.",
};

export function ReviewForm({ initial }: { initial: Review }) {
  const [rating, setRating] = useState(initial?.rating ?? 5);
  const [text, setText] = useState(initial?.text ?? "");
  const [status, setStatus] = useState(initial?.status ?? null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = status === "approved" || status === "rejected";
  const len = text.trim().length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (len < 30 || len > 1000) return setMsg("Текст: от 30 до 1000 символов");
    setBusy(true);
    try {
      const r = await api<{ review: { status: string } }>("/api/reviews", { method: "PUT", body: { rating, text } });
      setStatus(r.review.status);
      setMsg("Отзыв отправлен на проверку");
    } catch (err) {
      setMsg(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" style={{ gap: 12 }} onSubmit={submit}>
      {status && <span className={`chip ${status === "approved" ? "pos" : ""}`}>{STATUS[status] ?? status}</span>}
      <div className="growth-stars" role="radiogroup" aria-label="Оценка">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} из 5`} disabled={locked} className={n <= rating ? "on" : ""} onClick={() => setRating(n)}>
            ★
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="review-text">Ваш отзыв</label>
        <textarea id="review-text" className="input textarea" rows={5} maxLength={1000} disabled={locked} value={text} onChange={(e) => setText(e.target.value)} placeholder="Что понравилось, что помогло, чего не хватает?" />
        <span className="hint">{len}/1000, минимум 30</span>
      </div>
      {msg && <p className="muted" role="status">{msg}</p>}
      {!locked && (
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {status ? "Сохранить изменения" : "Отправить отзыв"}
        </button>
      )}
    </form>
  );
}
