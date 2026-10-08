"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Orb } from "@/components/ui/Orb";
import { ErrorBox } from "@/components/ui/States";
import { api, errorMessage } from "@/lib/client/api";
import { burst, rewardXp } from "@/components/fx";
import type { QuizQuestionDTO, QuizResultDTO } from "@/types";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "play"; attemptId: string; questions: QuizQuestionDTO[]; index: number; answers: number[]; picked: number | null }
  | { kind: "submitting"; questions: QuizQuestionDTO[]; answers: number[] }
  | { kind: "done"; questions: QuizQuestionDTO[]; answers: number[]; result: QuizResultDTO };

export function LessonQuiz({ lessonId, passedBefore }: { lessonId: string; passedBefore: boolean }) {
  const [s, setS] = useState<State>({ kind: "idle" });
  const router = useRouter();

  async function start() {
    setS({ kind: "loading" });
    try {
      const r = await api<{ attemptId: string; questions: QuizQuestionDTO[] }>(`/api/lessons/${lessonId}/quiz`, { method: "POST" });
      setS({ kind: "play", attemptId: r.attemptId, questions: r.questions, index: 0, answers: [], picked: null });
    } catch (e) {
      setS({ kind: "error", message: errorMessage(e) });
    }
  }

  async function next() {
    if (s.kind !== "play" || s.picked === null) return;
    const answers = [...s.answers, s.picked];
    if (s.index + 1 < s.questions.length) {
      setS({ ...s, index: s.index + 1, answers, picked: null });
      return;
    }
    setS({ kind: "submitting", questions: s.questions, answers });
    try {
      const result = await api<QuizResultDTO>(`/api/quiz/${s.attemptId}`, { method: "POST", body: { answers } });
      setS({ kind: "done", questions: s.questions, answers, result });
      const perfect = result.score === result.total;
      if (result.xp.gained > 0) rewardXp(result.xp, null, perfect ? 2.5 : 1);
      else if (result.score > 0) burst(null, perfect ? 2 : 0.8);
      router.refresh();
    } catch (e) {
      setS({ kind: "error", message: errorMessage(e) });
    }
  }

  return (
    <section className="card quiz" aria-label="Квиз по уроку">
      <div className="quiz-head">
        <Orb thinking={s.kind === "loading" || s.kind === "submitting"} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="label">Квиз от $PIG</span>
          <h3>Проверьте себя</h3>
        </div>
        {s.kind === "play" && (
          <span className="mono muted" style={{ fontSize: 12 }}>
            {s.index + 1} / {s.questions.length}
          </span>
        )}
      </div>

      {s.kind === "idle" && (
        <div className="stack" style={{ gap: 12 }}>
          <p className="ink2">
            {passedBefore ? "Вы уже проходили квиз по этому уроку. Можно пройти новый, но XP за урок начисляется один раз." : "4 вопроса по уроку. За каждый верный ответ +10 XP."}
          </p>
          <Button variant="accent" onClick={start} style={{ alignSelf: "flex-start" }}>
            <Icon name="bulb" size="sm" /> {passedBefore ? "Пройти ещё раз" : "Начать квиз"}
          </Button>
        </div>
      )}

      {s.kind === "loading" && <p className="muted">$PIG составляет вопросы по уроку…</p>}
      {s.kind === "submitting" && <p className="muted">Проверяем ответы…</p>}

      {s.kind === "error" && (
        <ErrorBox
          message={s.message}
          action={
            <button className="btn btn-danger btn-sm" onClick={start}>
              Повторить
            </button>
          }
        />
      )}

      {s.kind === "play" && (
        <div className="stack fade-in" key={s.index} style={{ gap: 12 }}>
          <p className="quiz-q">{s.questions[s.index].q}</p>
          <div className="quiz-opts" role="radiogroup" aria-label="Варианты ответа">
            {s.questions[s.index].options.map((o, i) => (
              <button key={i} role="radio" aria-checked={s.picked === i} className={`quiz-opt ${s.picked === i ? "is-picked" : ""}`} onClick={() => setS({ ...s, picked: i })}>
                <span className="mark">{String.fromCharCode(65 + i)}</span>
                <span>{o}</span>
              </button>
            ))}
          </div>
          <Button variant="primary" onClick={next} disabled={s.picked === null} style={{ alignSelf: "flex-end" }}>
            {s.index + 1 < s.questions.length ? "Дальше" : "Проверить"} <Icon name="arrow" size="sm" />
          </Button>
        </div>
      )}

      {s.kind === "done" && (
        <div className="stack fade-in" style={{ gap: 14 }}>
          <div className="quiz-score">
            <span className="num">
              {s.result.score}/{s.result.total}
            </span>
            <span>
              {s.result.score === s.result.total ? "Идеально! " : s.result.score >= s.result.total / 2 ? "Хороший результат. " : "Стоит перечитать урок. "}
              {s.result.xp.gained > 0 ? <b className="xp-pop">+{s.result.xp.gained} XP</b> : !s.result.firstTime ? <span className="muted">XP за этот урок уже получены</span> : null}
              {s.result.xp.leveledUp && <span className="badge pos" style={{ marginLeft: 8 }}>Новый уровень: {s.result.xp.level.name}</span>}
            </span>
          </div>
          <ol className="quiz-review">
            {s.questions.map((q, i) => {
              const r = s.result.results[i];
              return (
                <li key={i} className={r.correct ? "ok" : "bad"}>
                  <b>{q.q}</b>
                  <span>
                    <Icon name={r.correct ? "check" : "close"} size="sm" /> {r.correct ? "Верно" : `Правильно: ${q.options[r.answer]}`}
                  </span>
                  {r.explain && <span className="muted">{r.explain}</span>}
                </li>
              );
            })}
          </ol>
          <Button variant="secondary" onClick={start} style={{ alignSelf: "flex-start" }}>
            <Icon name="refresh" size="sm" /> Новый квиз
          </Button>
        </div>
      )}
    </section>
  );
}
