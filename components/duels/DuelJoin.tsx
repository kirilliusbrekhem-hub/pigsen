"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { call } from "./api";

export function DuelJoin({ code, creator, stake, open }: { code: string; creator: string; stake: number; open: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function join() {
    setBusy(true);
    setError("");
    try {
      const r = await call<{ id: string }>("/api/duels/join", { code });
      router.push(`/duels/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="duel stack" style={{ gap: 20 }}>
      <section className="card card-pad stack duel-hero" style={{ gap: 14 }}>
        <span className="label">Вызов на дуэль</span>
        <h1>{creator} вызывает вас</h1>
        <p>7 вопросов о деньгах и бизнесе, 15 секунд на каждый.{stake ? ` Ставка: ${stake} PigCoin$, победитель забирает ${stake * 2}.` : " Без ставки."}</p>
        {open ? (
          <button type="button" className="btn btn-primary btn-lg" onClick={join} disabled={busy} data-testid="duel-accept">{busy ? "Подключаемся…" : "Принять вызов"}</button>
        ) : (
          <p className="duel-error">Этот вызов уже принят или истёк.</p>
        )}
        {error && <p className="duel-error" role="alert">{error}</p>}
        <Link href="/duels" className="muted">К дуэлям</Link>
      </section>
    </div>
  );
}
