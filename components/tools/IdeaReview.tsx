"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Orb } from "@/components/ui/Orb";
import { ErrorBox } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import { xpMessage } from "@/lib/client/xp";
import { rewardXp } from "@/components/fx";
import type { IdeaReviewDTO, XpResultDTO } from "@/types";

interface Past {
  id: string;
  idea: string;
  at: string;
  result: IdeaReviewDTO;
}

const MAX = 2000;

function ReviewCard({ idea, r }: { idea: string; r: IdeaReviewDTO }) {
  const tone = r.score >= 7 ? "pos" : r.score >= 4 ? "warn" : "neg";
  return (
    <div className="idea-card fade-in">
      <div className="idea-score">
        <span className={`score ${tone}`}>
          <b className="num">{r.score}</b>/10
        </span>
        <p>{r.verdict}</p>
      </div>
      <div className="idea-cols">
        <div>
          <span className="label">Сильные стороны</span>
          <ul>{r.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <div>
          <span className="label">Риски</span>
          <ul>{r.risks.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <div>
          <span className="label">Первые шаги</span>
          <ol>{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
      </div>
      <Link className="btn btn-secondary" style={{ alignSelf: "flex-start" }} href={`/ai?q=${encodeURIComponent(`Помоги развить бизнес-идею: ${idea.slice(0, 1500)}\n\nТы оценил её на ${r.score}/10. Давай разберём главный риск и составим план проверки на 2 недели.`)}`}>
        <Icon name="message" size="sm" /> Обсудить с CAP
      </Link>
    </div>
  );
}

export function IdeaReview({ history }: { history: Past[] }) {
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<{ idea: string; result: IdeaReviewDTO; demo: boolean } | null>(null);
  const toast = useToast();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || idea.trim().length < 20) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ result: IdeaReviewDTO; xp: XpResultDTO; demo: boolean }>("/api/ai/idea", { method: "POST", body: { idea } });
      setCurrent({ idea, result: r.result, demo: r.demo });
      if (r.xp.gained > 0) {
        toast.show(xpMessage(r.xp, "Разбор готов."));
        rewardXp(r.xp, null, 1.2);
      }
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <form className="card card-pad stack" style={{ gap: 12 }} onSubmit={submit}>
        <div className="row" style={{ gap: 12 }}>
          <Orb thinking={busy} />
          <div>
            <b>Опишите идею, а CAP разберёт её как ментор-инвестор</b>
            <p className="muted" style={{ fontSize: 13 }}>
              Кто клиент, какую проблему решаете, как будете зарабатывать. Чем конкретнее, тем точнее разбор.
            </p>
          </div>
        </div>
        <textarea
          className="input idea-input"
          value={idea}
          onChange={(e) => setIdea(e.target.value.slice(0, MAX))}
          placeholder="Например: сервис, который за 5 минут собирает для кофейни меню и цены на основе продаж, по подписке 1 990 ₽ в месяц…"
          rows={5}
          maxLength={MAX}
          aria-label="Описание бизнес-идеи"
          disabled={busy}
        />
        <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span className="muted mono" style={{ fontSize: 12 }}>
            {idea.length} / {MAX}
          </span>
          <Button variant="accent" type="submit" loading={busy} disabled={idea.trim().length < 20}>
            <Icon name="rocket" size="sm" /> Разобрать идею
          </Button>
        </div>
      </form>

      {error && <ErrorBox message={error} />}
      {busy && <p className="muted">CAP изучает идею: рынок, клиентов, риски…</p>}
      {current && (
        <>
          {current.demo && (
            <div className="safety">
              <Icon name="info" />
              <span>Демо-режим: разбор собран по правилам. С подключённым AI-ключом CAP разберёт идею по существу.</span>
            </div>
          )}
          <ReviewCard idea={current.idea} r={current.result} />
        </>
      )}

      {history.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="label">Прошлые разборы</span>
          {history.map((h) => (
            <details key={h.id} className="card idea-past">
              <summary>
                <span className="mono">{h.result.score}/10</span>
                <span className="t">{h.idea}</span>
                <span className="muted mono" style={{ fontSize: 11.5 }}>
                  {new Date(h.at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                </span>
              </summary>
              <ReviewCard idea={h.idea} r={h.result} />
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
