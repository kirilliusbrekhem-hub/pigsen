"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { call } from "./api";
import { DuelShare } from "./DuelShare";

type Ans = { choice: number; ms: number; points: number } | null;
type State = {
  id: string;
  code: string;
  kind: string;
  status: string;
  stake: number;
  rematchId: string | null;
  isCreator: boolean;
  total: number;
  me: { name: string; score: number; correct: number; current: number; finished: boolean; result: string | null };
  opponent: { name: string; isBot: boolean; finished: boolean; current: number; score: number | null; correct: number | null } | null;
  review: { q: string; options: string[]; answer: number; mine: Ans; theirs: Ans }[];
};
type Question = { done: false; index: number; total: number; q: string; options: string[]; remainingMs: number } | { done: true };
type Feedback = { choice: number; answer: number; correct: boolean; points: number; late: boolean };

const QUESTION_MS = 15_000;

export function DuelRoom({ id }: { id: string }) {
  const router = useRouter();
  const [s, setS] = useState<State | null>(null);
  const [q, setQ] = useState<Extract<Question, { done: false }> | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [fb, setFb] = useState<Feedback | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const load = useCallback(async () => {
    try {
      setS(await call<State>(`/api/duels/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    load();
  }, [load]);

  // Poll while waiting for a match or for the opponent's run.
  const waiting = !!s && (s.status === "waiting" || (s.me.finished && s.status === "active"));
  useEffect(() => {
    if (!waiting || playing) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [waiting, playing, load]);

  const next = useCallback(async () => {
    setFb(null);
    try {
      const r = await call<Question>(`/api/duels/${id}/question`, {});
      if (r.done) {
        setQ(null);
        setPlaying(false);
        await load();
        return;
      }
      setQ(r);
      setDeadline(Date.now() + r.remainingMs);
      setNow(Date.now());
    } catch (e) {
      setError((e as Error).message);
      setPlaying(false);
    }
  }, [id, load]);

  useEffect(() => {
    if (!q || fb) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [q, fb]);

  const left = q && !fb ? Math.max(0, deadline - now) : 0;
  // Time is up: the server records the timeout on the next fetch (after its grace period).
  useEffect(() => {
    if (!q || fb || left > 0) return;
    const t = setTimeout(next, 1700);
    return () => clearTimeout(t);
  }, [q, fb, left, next]);

  async function answer(choice: number) {
    if (!q || fb || sending.current) return;
    sending.current = true;
    try {
      const r = await call<{ correct: boolean; answer: number; points: number; late: boolean; finished: boolean }>(`/api/duels/${id}/answer`, { index: q.index, choice });
      setFb({ choice, ...r });
      setTimeout(next, 900);
    } catch {
      setTimeout(next, 300);
    } finally {
      sending.current = false;
    }
  }

  function play() {
    setPlaying(true);
    next();
  }

  async function doRematch() {
    setBusy(true);
    try {
      const r = await call<{ id: string }>(`/api/duels/${id}/rematch`, {});
      router.push(`/duels/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!s) return <div className="duel card card-pad">{error || "Загрузка…"}</div>;

  if (playing && q) {
    const pct = (left / QUESTION_MS) * 100;
    return (
      <div className="duel duel-play stack" style={{ gap: 16 }}>
        <div className="duel-play-head">
          <span className="label">Вопрос {q.index + 1} из {q.total}</span>
          <span className={`duel-timer num${left < 5000 ? " low" : ""}`} data-testid="duel-timer">{Math.ceil(left / 1000)}</span>
        </div>
        <div className="duel-bar" aria-hidden><span style={{ width: `${fb ? 0 : pct}%` }} /></div>
        <h2 className="duel-q" data-testid="duel-question">{q.q}</h2>
        <div className="duel-options">
          {q.options.map((o, i) => {
            const cls = fb ? (i === fb.answer ? " right" : i === fb.choice ? " wrong" : " dim") : "";
            return (
              <button key={i} type="button" className={`duel-option${cls}`} disabled={!!fb || left === 0} onClick={() => answer(i)} data-testid="duel-option">
                {o}
              </button>
            );
          })}
        </div>
        <p className="duel-fb" aria-live="polite">{fb ? (fb.late ? "Время вышло" : fb.correct ? `Верно! +${fb.points}` : "Мимо") : left === 0 ? "Время вышло" : " "}</p>
      </div>
    );
  }

  const opp = s.opponent;
  if (s.status === "waiting" && s.kind === "random") {
    return (
      <div className="duel card card-pad stack duel-hero" style={{ gap: 12 }}>
        <span className="duel-pulse" aria-hidden />
        <h1>Ищем соперника…</h1>
        <p className="muted">Если никого нет, сыграете против призрака — записи реального игрока.</p>
      </div>
    );
  }

  if (s.status === "cancelled") {
    return (
      <div className="duel card card-pad stack" style={{ gap: 12 }}>
        <h1>Вызов истёк</h1>
        <p className="muted">Никто не принял вызов за сутки. Ставка вернулась на баланс.</p>
        <Link className="btn btn-primary" href="/duels">К дуэлям</Link>
      </div>
    );
  }

  if (!s.me.finished) {
    return (
      <div className="duel stack" style={{ gap: 16 }}>
        <section className="card card-pad stack duel-hero" style={{ gap: 12 }}>
          <span className="label">{s.kind === "friend" ? "Дуэль с другом" : s.kind === "ghost" ? "Дуэль с призраком" : s.kind === "bot" ? "Дуэль с ботом" : "Дуэль"}</span>
          <h1>{s.me.name} <span className="muted">vs</span> {opp?.name ?? "…"}</h1>
          <p className="muted">7 вопросов · 15 секунд на каждый{s.stake ? ` · ставка ${s.stake} PigCoin$` : ""}. Отвечайте быстро: скорость приносит до 100 бонусных очков.</p>
          {s.me.current > 0 && <p>Вы остановились на вопросе {s.me.current + 1}. Открытый вопрос продолжает отсчёт.</p>}
          <button type="button" className="btn btn-primary btn-lg" onClick={play} data-testid="duel-play">
            <Icon name="play" /> {s.me.current > 0 ? "Продолжить" : "Начать"}
          </button>
          {error && <p className="duel-error" role="alert">{error}</p>}
        </section>
        {s.status === "waiting" && s.isCreator && (
          <section className="card card-pad stack" style={{ gap: 10 }}>
            <b>Отправьте вызов другу</b>
            <p className="muted duel-note">Можно сыграть сейчас — друг ответит на те же вопросы, когда примет вызов. Ссылка действует сутки.</p>
            <DuelShare code={s.code} stake={s.stake} />
          </section>
        )}
      </div>
    );
  }

  const res = s.me.result;
  return (
    <div className="duel stack" style={{ gap: 16 }}>
      <section className={`card card-pad stack duel-result ${res ?? "pending"}`} style={{ gap: 12 }} data-testid="duel-result">
        <span className="label">Итог</span>
        <h1>{res === "win" ? "Победа!" : res === "loss" ? "Поражение" : res === "draw" ? "Ничья" : "Ждём соперника"}</h1>
        <div className="duel-score">
          <div><span className="duel-name">{s.me.name}</span><b className="num" data-testid="duel-my-score">{s.me.score}</b><span className="muted">{s.me.correct}/{s.total} верно</span></div>
          <span className="duel-vs">vs</span>
          <div><span className="duel-name">{opp?.name ?? "—"}</span><b className="num">{opp?.score ?? "?"}</b><span className="muted">{opp?.finished ? `${opp.correct}/${s.total} верно` : `вопрос ${Math.min((opp?.current ?? 0) + 1, s.total)} из ${s.total}`}</span></div>
        </div>
        {s.stake > 0 && res && <p>{res === "win" ? `+${s.stake * 2} PigCoin$ на баланс` : res === "draw" ? `Ставка ${s.stake} PigCoin$ вернулась` : `Ставка ${s.stake} PigCoin$ ушла сопернику`}</p>}
        {s.status === "waiting" && s.isCreator && <DuelShare code={s.code} stake={s.stake} />}
        <div className="duel-row">
          {s.status === "done" && (
            <button type="button" className="btn btn-primary" onClick={doRematch} disabled={busy} data-testid="duel-rematch">
              <Icon name="repeat" /> {s.rematchId && opp && !opp.isBot ? "Принять реванш" : "Реванш"}
            </button>
          )}
          <Link className="btn btn-secondary" href="/duels">К дуэлям</Link>
        </div>
        {error && <p className="duel-error" role="alert">{error}</p>}
      </section>
      {s.review.length > 0 && (
        <section className="card card-pad stack" style={{ gap: 10 }}>
          <b>Разбор</b>
          <ol className="duel-review">
            {s.review.map((r, i) => (
              <li key={i}>
                <p>{r.q}</p>
                <p className="duel-right"><Icon name="check" /> {r.options[r.answer]}</p>
                <p className="muted duel-note">
                  Вы: {r.mine ? (r.mine.choice < 0 ? "нет ответа" : `${r.mine.points} оч. за ${(r.mine.ms / 1000).toFixed(1)} с`) : "—"}
                  {r.theirs && ` · соперник: ${r.theirs.choice < 0 ? "нет ответа" : `${r.theirs.points} оч. за ${(r.theirs.ms / 1000).toFixed(1)} с`}`}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
