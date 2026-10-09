"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client/api";

/** Approve (grants the unique business item + coins) or reject with a comment the user will see. */
export function ChallengeModeration({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function act(action: "approve" | "reject") {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/admin/challenges/${id}`, { method: "POST", body: { action, comment } });
      router.refresh();
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <div className="bg-mod" data-testid="chs-mod">
      <input className="input" maxLength={300} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий (обязателен при отказе)" aria-label="Комментарий" />
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => act("approve")}>
        Одобрить
      </button>
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy || comment.trim().length < 3} onClick={() => act("reject")}>
        Отклонить
      </button>
      {err && <span className="muted">{err}</span>}
    </div>
  );
}
