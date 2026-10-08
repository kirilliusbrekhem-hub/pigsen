"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ProgressRing } from "@/components/fx/ProgressRing";
import { burst, haptic, preloadFx, reward } from "@/components/fx";
import { LuckyWheel } from "@/components/dashboard/LuckyWheel";
import { api, errorMessage } from "@/lib/client/api";
import type { Badge, LevelInfo } from "@/lib/gamification/service";
import type { QuestBoard, QuestView } from "@/lib/gamification/quests";
import type { XpResultDTO } from "@/types";

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

interface Props {
  board: QuestBoard;
  streak: number;
  xp: number;
  level: LevelInfo;
  next: Badge | null;
}

export function TodayPanel({ board: initial, streak, xp, level, next }: Props) {
  const [board, setBoard] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  const flameRef = useRef<HTMLSpanElement>(null);

  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setBoard(initial);
  }

  // Streak flame: a bigger "pop" on the first dashboard visit of the day.
  useEffect(() => {
    if (!streak) return;
    const day = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem("pigsen-flame") === day) return;
      localStorage.setItem("pigsen-flame", day);
    } catch {
      return;
    }
    flameRef.current?.classList.add("fx-pop");
    haptic(10);
    const t = setTimeout(() => burst(flameRef.current, 0.6), 350);
    return () => clearTimeout(t);
  }, [streak]);

  async function claim(id: string, el: HTMLElement | null) {
    setBusy(id);
    try {
      const r = await api<{ xp: XpResultDTO; coins: number; board: QuestBoard }>("/api/quests", { method: "POST", body: { id } });
      setBoard(r.board);
      reward({ xp: r.xp.gained, coins: r.coins, origin: el, level: r.xp.level, leveledUp: r.xp.leveledUp, power: id === "chest" || id === "weekly" ? 2.5 : 1.2 });
      if (id === "chest") toast.show(`Сундук открыт: +${r.coins} PigCoin$ и +${r.xp.gained} XP!`);
      router.refresh();
    } catch (e) {
      toast.show(errorMessage(e), { kind: "err" });
    } finally {
      setBusy(null);
    }
  }

  const doneCount = board.daily.filter((q) => q.done).length;
  const hours = Math.floor(board.resetIn / 3600);
  const mins = Math.floor((board.resetIn % 3600) / 60);

  return (
    <section className="today card" aria-labelledby="today-h" data-testid="today-panel">
      <div className="today-head">
        <div>
          <h2 id="today-h">Сегодня</h2>
          <span className="muted">
            Задания обновятся через {hours} ч {mins} мин
          </span>
        </div>
        <span ref={flameRef} className={`streak fx-streak ${streak ? "on" : ""}`} title="Дней подряд с активностью">
          <Icon name="flame" size="sm" className="flame" />
          <span className="num">{streak}</span>
          <span className="muted">{plural(streak, "день", "дня", "дней")}</span>
        </span>
      </div>

      <div className="today-grid">
        <div className="today-quests">
          <div className="today-sub">
            <b>Задания дня</b>
            <span className="muted num">
              {doneCount} из {board.daily.length}
            </span>
          </div>
          <ul className="quests" data-testid="quests">
            {board.daily.map((q) => (
              <QuestRow key={q.id} q={q} busy={busy === q.id} onClaim={claim} />
            ))}
          </ul>
          <button
            type="button"
            className={`chest ${board.chest.ready && !board.chest.claimed ? "ready" : ""} ${board.chest.claimed ? "opened" : ""}`}
            disabled={!board.chest.ready || board.chest.claimed || busy === "chest"}
            onPointerEnter={preloadFx}
            onClick={(e) => claim("chest", e.currentTarget)}
            data-testid="quest-chest"
          >
            <span className="chest-ic">
              <Icon name={board.chest.claimed ? "check" : "gem"} />
            </span>
            <span className="chest-txt">
              <b>{board.chest.claimed ? "Сундук открыт" : "Все 3 выполнены: бонусный сундук"}</b>
              <span className="muted">
                +{board.chest.coins} PigCoin$ и +{board.chest.xp} XP
              </span>
            </span>
            {board.chest.ready && !board.chest.claimed && <span className="chest-cta">Открыть</span>}
          </button>
          <div className="today-sub" style={{ marginTop: 6 }}>
            <b>Задание недели</b>
          </div>
          <ul className="quests">
            <QuestRow q={board.weekly} busy={busy === "weekly"} onClaim={claim} />
          </ul>
        </div>

        <div className="today-side">
          <Link href="/profile?tab=progress" className="today-level">
            <ProgressRing percent={level.percent} label="Прогресс до следующего уровня">
              <b className="num">{level.index}</b>
              <span>ур.</span>
            </ProgressRing>
            <span>
              <b>{level.name}</b>
              <span className="muted">{level.nextMin !== null ? `${level.nextMin - xp} XP до «${level.nextName}»` : "Максимальный уровень"}</span>
            </span>
          </Link>
          {next && next.target ? (
            <Link href="/profile?tab=progress" className="today-badge" data-testid="next-badge">
              <span className="ic">
                <Icon name={next.icon} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  Следующий бейдж
                </span>
                <b>{next.name}</b>
                <span className="qbar">
                  <i style={{ width: `${Math.round(((next.progress ?? 0) / next.target) * 100)}%` }} />
                </span>
                <span className="muted num" style={{ fontSize: 12 }}>
                  {next.progress ?? 0} / {next.target} · {next.description}
                </span>
              </span>
            </Link>
          ) : null}
          <LuckyWheel available={board.spin.available} prizes={board.spin.prizes} />
        </div>
      </div>
    </section>
  );
}

function QuestRow({ q, busy, onClaim }: { q: QuestView; busy: boolean; onClaim: (id: string, el: HTMLElement | null) => void }) {
  const pct = Math.round((q.progress / q.target) * 100);
  return (
    <li className={`quest ${q.done ? "done" : ""} ${q.claimed ? "claimed" : ""}`} data-quest={q.id}>
      <span className="q-ic">
        <Icon name={q.claimed ? "check" : q.icon} size="sm" />
      </span>
      <span className="q-body">
        <b>{q.title}</b>
        <span className="qbar" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </span>
        <span className="muted q-meta">
          <span className="num">
            {q.progress}/{q.target}
          </span>{" "}
          · +{q.rewardXp} XP{q.rewardCoins ? ` и +${q.rewardCoins} PigCoin$` : ""}
        </span>
      </span>
      {q.claimed ? (
        <span className="q-state">Получено</span>
      ) : q.done ? (
        <button type="button" className="btn btn-accent btn-sm q-claim" disabled={busy} onPointerEnter={preloadFx} onClick={(e) => onClaim(q.id, e.currentTarget)}>
          Забрать
        </button>
      ) : (
        <Link className="btn btn-secondary btn-sm" href={q.href} aria-label={`${q.title}: перейти`}>
          <Icon name="arrow" size="sm" />
        </Link>
      )}
    </li>
  );
}
