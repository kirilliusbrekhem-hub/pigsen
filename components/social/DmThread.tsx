"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import { DM_MAX, type DmView } from "@/lib/social/meta";
import { usePoll } from "./usePoll";

const time = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function DmThread({ otherId, initial, canStart }: { otherId: string; initial: DmView[]; canStart: boolean }) {
  const [msgs, setMsgs] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const locked = !canStart && !msgs.some((m) => !m.mine);

  usePoll(async () => {
    const r = await api<{ messages: DmView[] }>(`/api/dm/${otherId}`);
    setMsgs(r.messages);
  }, 4000);

  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ message: DmView }>(`/api/dm/${otherId}`, { method: "POST", body: { text } });
      setText("");
      setMsgs((m) => [...m, r.message]);
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card chat-card">
      <div className="chat-log" ref={box}>
        {msgs.length === 0 && <p className="muted cm-empty">Сообщений пока нет. Поздоровайтесь!</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`chat-msg ${m.mine ? "is-mine" : ""}`}>
            <div className="chat-bubble">
              <p className="cm-text">{m.text}</p>
              <div className="chat-time">
                <time dateTime={m.createdAt}>{time(m.createdAt)}</time>
                {m.mine && <span>{m.read ? "Прочитано" : "Отправлено"}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {locked ? (
        <div className="chat-locked">
          <span className="muted">Начать переписку можно в Pro.</span>
          <a className="btn btn-accent btn-sm" href="/pro">Перейти на Pro</a>
        </div>
      ) : (
        <form className="chat-form" onSubmit={send}>
          <textarea className="input chat-input" rows={1} value={text} maxLength={DM_MAX} onChange={(e) => setText(e.target.value)} placeholder="Сообщение" aria-label="Сообщение" />
          <button className="btn btn-primary" disabled={busy || !text.trim()} aria-label="Отправить"><Icon name="send" size="sm" /></button>
        </form>
      )}
    </div>
  );
}
