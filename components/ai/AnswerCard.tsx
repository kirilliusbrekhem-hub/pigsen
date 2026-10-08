"use client";
import { lazy, Suspense, useState } from "react";
import { ContentRow } from "@/components/content/ContentCard";
import { Icon } from "@/components/ui/Icon";
import { Orb } from "@/components/ui/Orb";
import type { ChatMessage } from "./useChatStream";

// react-markdown + remark-gfm are ~150 KB of JS: load them only once an answer is shown, not with the /ai page.
const Markdown = lazy(() => import("@/components/content/Markdown").then((m) => ({ default: m.Markdown })));

const STEPS = ["Понимаю вопрос", "Ищу материалы в библиотеке PIGSEN", "Формулирую ответ"];

export function AnswerCard({ m, onAsk, last }: { m: ChatMessage; onAsk: (q: string) => void; last: boolean }) {
  const [copied, setCopied] = useState(false);
  const thinking = m.status === "thinking";
  const streaming = m.status === "streaming";
  const step = m.related.length || m.followUps.length ? 2 : 1;

  async function copy() {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="a-msg">
      <div className="a-head">
        <Orb thinking={thinking || streaming} />
        $PIG
        {m.provider && (m.mock || m.provider === "Демо-режим") && <span className="badge warn">демо-режим</span>}
      </div>
      {thinking ? (
        <div className="thinking" aria-live="polite">
          {STEPS.map((s, i) => (
            <div key={s} className={`think-step ${i < step ? "done" : i === step ? "run" : ""}`}>
              <span className="st" />
              {s}
            </div>
          ))}
        </div>
      ) : (
        <div className="answer">
          {m.content ? (
            <Suspense fallback={<div className={`md ${streaming ? "streaming" : ""}`} style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>}>
              <Markdown className={streaming ? "streaming" : ""}>{m.content}</Markdown>
            </Suspense>
          ) : (
            <div className="ans-block muted">Ответ не получен.</div>
          )}
          {!streaming && m.related.length > 0 && (
            <div className="ans-block">
              <span className="label">Материалы PIGSEN по теме</span>
              <div className="row-list" style={{ margin: "0 -12px" }}>
                {m.related.map((r) => (
                  <ContentRow key={r.id} item={r} />
                ))}
              </div>
            </div>
          )}
          {!streaming && last && m.followUps.length > 0 && (
            <div className="ans-block">
              <span className="label">Можно спросить дальше</span>
              <div className="row-wrap">
                {m.followUps.map((q) => (
                  <button key={q} className="chip" onClick={() => onAsk(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!streaming && m.content && (
            <div className="ans-actions">
              <button className="btn btn-secondary btn-sm" onClick={copy}>
                <Icon name={copied ? "check" : "article"} size="sm" />
                {copied ? "Скопировано" : "Копировать ответ"}
              </button>
              <span className="note">
                <Icon name="info" />
                $PIG обучает и объясняет. Важные решения проверяйте и принимайте самостоятельно.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
