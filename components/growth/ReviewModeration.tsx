"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client/api";

export function ReviewModeration({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function act(action: "approve" | "reject") {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/admin/reviews/${id}`, { method: "POST", body: { action } });
      router.refresh();
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <div className="growth-mod">
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => act("approve")}>Одобрить и наградить</button>
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act("reject")}>Отклонить</button>
      {err && <span className="muted">{err}</span>}
    </div>
  );
}
