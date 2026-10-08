"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { call } from "./api";

type Lobby = {
  pro: boolean;
  coins: number;
  left: number | null;
  stakeLeft: number;
  rating: { userId: string; name: string; points: number; wins: number; score: number }[];
  recent: { id: string; status: string; kind: string; stake: number; result: string | null; score: number; opponent: string | null; opponentScore: number | null }[];
};

const STAKES = [0, 10, 50, 100];
const RESULT: Record<string, string> = { win: "Победа", loss: "Поражение", draw: "Ничья" };
const STATUS: Record<string, string> = { waiting: "Ждём соперника", active: "Идёт", cancelled: "Отменена" };

export function DuelLobby({ initial, me }: { initial: Lobby; me: string }) {
  const router = useRouter();
  const [stake, setStake] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const d = initial;

  async function start(mode: "friend" | "random") {
    setBusy(mode);
    setError("");
    try {
      const r = await call<{ id: string }>("/api/duels", { mode, stake });
      router.push(`/duels/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="duel stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <span className="label">Новое</span>
          <h1>Дуэли</h1>
          <p>7 вопросов о деньгах и бизнесе, 15 секунд на каждый. Очки за верный ответ и за скорость.</p>
        </div>
      </div>

      <section className="card card-pad stack duel-start" style={{ gap: 14 }}>
        <b>Ставка в PigCoin$</b>
        <div className="duel-stakes" role="radiogroup" aria-label="Ставка">
          {STAKES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={stake === s} className={`duel-stake${stake === s ? " on" : ""}`} disabled={s > d.coins || s > d.stakeLeft} onClick={() => setStake(s)}>
              {s === 0 ? "Без ставки" : `${s} PigCoin$`}
            </button>
          ))}
        </div>
        <p className="muted duel-note">
          Победитель забирает обе ставки, ничья — возврат. Против призрака или бота ставка не больше 10. Осталось ставок сегодня: {d.stakeLeft} PigCoin$.
          {d.left !== null && <> Дуэлей сегодня: {d.left} из 3.</>}
        </p>
        <div className="duel-row">
          <button type="button" className="btn btn-primary btn-lg" disabled={!!busy || d.left === 0} onClick={() => start("random")} data-testid="duel-random">
            <Icon name="bolt" /> {busy === "random" ? "Ищем…" : "Случайный соперник"}
          </button>
          <button type="button" className="btn btn-secondary btn-lg" disabled={!!busy || d.left === 0} onClick={() => start("friend")} data-testid="duel-friend">
            <Icon name="users" /> {busy === "friend" ? "Создаём…" : "Вызвать друга"}
          </button>
        </div>
        {d.left === 0 && <p className="duel-error">Бесплатные дуэли на сегодня закончились. В Pro — без ограничений.</p>}
        {error && <p className="duel-error" role="alert">{error}</p>}
      </section>

      <div className="duel-grid">
        <section className="card card-pad stack" style={{ gap: 10 }}>
          <b><Icon name="trophy" /> Рейтинг недели</b>
          {d.rating.length === 0 ? <p className="muted">Пока никто не сыграл. Будьте первым.</p> : (
            <ol className="duel-rating">
              {d.rating.map((r, i) => (
                <li key={r.userId} className={r.userId === me ? "me" : ""}>
                  <span className="duel-rank num">{i + 1}</span>
                  <span className="duel-name">{r.name}</span>
                  <span className="num">{r.points} оч.</span>
                </li>
              ))}
            </ol>
          )}
          <p className="muted duel-note">Победа — 3 очка, ничья — 1. Сброс в понедельник.</p>
        </section>

        <section className="card card-pad stack" style={{ gap: 10 }}>
          <b><Icon name="history" /> Мои дуэли</b>
          {d.recent.length === 0 ? <p className="muted">Ещё нет дуэлей.</p> : (
            <ul className="duel-recent">
              {d.recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/duels/${r.id}`}>
                    <span className="duel-name">{r.opponent ?? "Ждём соперника"}</span>
                    <span className={`duel-badge ${r.result ?? ""}`}>{r.result ? RESULT[r.result] : STATUS[r.status] ?? r.status}</span>
                    <span className="num muted">{r.result ? `${r.score}:${r.opponentScore ?? 0}` : ""}{r.stake ? ` · ${r.stake} PigCoin$` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
