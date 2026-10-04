"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Orb } from "@/components/ui/Orb";
import { ErrorBox } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import type { ConversationSummaryDTO } from "@/types";
import { AnswerCard } from "./AnswerCard";
import { ConversationList } from "./ConversationList";
import { createConversation, useChatStream, type ChatMessage } from "./useChatStream";

const PROMPTS: Array<[string, string]> = [
  ["Объясни, как работает венчурное финансирование", "Фонды, раунды, доли"],
  ["Что такое юнит-экономика и как её посчитать?", "CAC, LTV, маржа"],
  ["Как проверить идею стартапа за неделю?", "Клиенты и MVP"],
  ["Где AI уже приносит деньги бизнесу?", "Кейсы и метрики"],
  ["Объясни сложный процент на примере", "Основы инвестиций"],
  ["Составь план изучения предпринимательства на месяц", "Учитывает ваш прогресс"],
];

const MAX = 4000;

interface Props {
  conversations: ConversationSummaryDTO[];
  conversationId: string | null;
  initialMessages: ChatMessage[];
  initialQuestion: string | null;
  firstName: string;
}

export function AIChat({ conversations: initialList, conversationId, initialMessages, initialQuestion, firstName }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [list, setList] = useState(initialList);
  const [activeId, setActiveId] = useState<string | null>(conversationId);
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const { messages, busy, error, send, stop, reset } = useChatStream(initialMessages);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoAsked = useRef(false);

  const [prevInitialList, setPrevInitialList] = useState(initialList);
  if (prevInitialList !== initialList) {
    setPrevInitialList(initialList);
    setList(initialList);
  }

  // Keep the newest content in view while streaming.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: busy ? "auto" : "smooth" });
  }, [messages, busy]);

  const refreshList = useCallback(async () => {
    try {
      const r = await api<{ conversations: ConversationSummaryDTO[] }>("/api/ai/conversations");
      setList(r.conversations);
    } catch {
      /* list refresh is best-effort */
    }
  }, []);

  const ask = useCallback(
    async (raw: string, retry = false) => {
      const q = raw.trim().slice(0, MAX);
      if (!q || busy) return;
      setInput("");
      let id = activeId;
      try {
        if (!id) {
          id = await createConversation();
          setActiveId(id);
          // Update the URL without remounting the page mid-stream.
          window.history.replaceState(null, "", `/ai/${id}`);
        }
      } catch (e) {
        toast.show(errorMessage(e), { kind: "err" });
        setInput(q);
        return;
      }
      await send(id, q, { retry });
      void refreshList();
    },
    [activeId, busy, send, refreshList, toast],
  );

  useEffect(() => {
    if (initialQuestion && !autoAsked.current) {
      autoAsked.current = true;
      void ask(initialQuestion);
    }
  }, [initialQuestion, ask]);

  function newChat() {
    reset([]);
    setActiveId(null);
    setHistoryOpen(false);
    router.push("/ai");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function remove(id: string) {
    try {
      await api(`/api/ai/conversations/${id}`, { method: "DELETE" });
      setList((xs) => xs.filter((x) => x.id !== id));
      toast.show("Разговор удалён");
      if (id === activeId) newChat();
    } catch (e) {
      toast.show(errorMessage(e), { kind: "err" });
    }
  }

  const history = (
    <>
      <button className="btn btn-secondary btn-sm" onClick={newChat} style={{ alignSelf: "flex-start" }}>
        <Icon name="plus" size="sm" />
        Новый разговор
      </button>
      <div className="stack" style={{ gap: 6 }}>
        <span className="label">История</span>
        <ConversationList items={list} activeId={activeId} onDelete={remove} onSelect={() => setHistoryOpen(false)} />
      </div>
    </>
  );

  return (
    <div className="ai-shell">
      <div className="ai-main">
        <div className="ai-mobile-bar">
          <button className="btn btn-secondary btn-sm" onClick={() => setHistoryOpen(true)}>
            <Icon name="history" size="sm" />
            История · {list.length}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={newChat}>
            <Icon name="plus" size="sm" />
            Новый
          </button>
        </div>
        <div className="ai-scroll" ref={scrollRef}>
          <div className="ai-thread" aria-live="polite">
            {!messages.length ? (
              <div className="ai-intro">
                <span className="label">$PIG · ваш AI-наставник</span>
                <h1>
                  {firstName}, спросите о бизнесе что угодно. <span>Объясню простыми словами и подскажу, что изучить дальше.</span>
                </h1>
                <div className="prompt-grid">
                  {PROMPTS.map(([q, c]) => (
                    <button key={q} className="prompt-card" onClick={() => ask(q)}>
                      <span className="q">{q}</span>
                      <span className="c">{c}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={m.id} className="q-msg">
                    <div className="bubble">{m.content}</div>
                    <span className="meta">Вы · {new Date(m.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ) : (
                  <AnswerCard key={m.id} m={m} onAsk={ask} last={i === messages.length - 1} />
                ),
              )
            )}
            {error && (
              <ErrorBox
                message={error.message}
                action={
                  <button className="btn btn-danger btn-sm" onClick={() => ask(error.question, true)}>
                    Повторить
                  </button>
                }
              />
            )}
          </div>
        </div>
        <div className="composer-wrap">
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
          >
            <Orb thinking={busy} />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={busy ? "$PIG отвечает..." : "Спросите о бизнесе, стартапах, финансах или AI..."}
              autoComplete="off"
              aria-label="Вопрос для $PIG"
              maxLength={MAX}
              disabled={busy}
            />
            {busy ? (
              <button className="send" type="button" onClick={stop} aria-label="Остановить ответ">
                <Icon name="pause" />
              </button>
            ) : (
              <button className="send" type="submit" aria-label="Отправить" disabled={!input.trim()}>
                <Icon name="send" />
              </button>
            )}
          </form>
          <div className="composer-foot">
            <Icon name="shield" />
            $PIG обучает и объясняет. Это не персональная финансовая или юридическая консультация.
          </div>
        </div>
      </div>
      <aside className="ctx" aria-label="История разговоров">
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">$PIG</span>
          <h3>
            <Orb />
            Разговоры
          </h3>
          <p className="muted" style={{ fontSize: 12.5 }}>
            Продолжайте любой разговор: $PIG помнит его контекст.
          </p>
        </div>
        {history}
      </aside>

      {historyOpen && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="История разговоров">
          <div className="scrim" onClick={() => setHistoryOpen(false)} />
          <div className="modal">
            <div className="sheet-grab" />
            <div className="modal-head">
              <h2>История разговоров</h2>
              <button className="icon-btn" onClick={() => setHistoryOpen(false)} aria-label="Закрыть">
                <Icon name="close" />
              </button>
            </div>
            <div className="modal-body">{history}</div>
          </div>
        </div>
      )}
    </div>
  );
}
