"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Emblem } from "@/components/profile/ProfileCard";
import { nameCls, ringCls } from "@/lib/profile/cosmetics";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import { CHAT_MAX, CHAT_ROOMS, type ChatMsgView, type RoomId } from "@/lib/social/meta";
import { usePoll } from "./usePoll";

const time = (iso: string) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

export function ChatRoom({ room, initial, admin }: { room: RoomId; initial: ChatMsgView[]; admin: boolean }) {
  const [msgs, setMsgs] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const toast = useToast();

  const merge = (add: ChatMsgView[]) => setMsgs((m) => {
    const ids = new Set(m.map((x) => x.id));
    const fresh = add.filter((x) => !ids.has(x.id));
    return fresh.length ? [...m, ...fresh].slice(-300) : m;
  });

  usePoll(async () => {
    const last = msgs[msgs.length - 1]?.createdAt;
    const r = await api<{ messages: ChatMsgView[] }>(`/api/chat/${room}${last ? `?after=${encodeURIComponent(last)}` : ""}`);
    merge(r.messages);
  }, 3000);

  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ message: ChatMsgView }>(`/api/chat/${room}`, { method: "POST", body: { text } });
      setText("");
      stick.current = true;
      merge([r.message]);
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }
  async function del(id: string) {
    if (!confirm("Удалить сообщение?")) return;
    try {
      await api(`/api/chat/message/${id}`, { method: "DELETE" });
      setMsgs((m) => m.filter((x) => x.id !== id));
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    }
  }

  return (
    <div className="card chat-card">
      <div className="chat-rooms" role="tablist" aria-label="Комнаты">
        {CHAT_ROOMS.map((r) => (
          <Link key={r.id} href={`/community/chat?room=${r.id}`} role="tab" aria-selected={r.id === room} className={`cm-chip ${r.id === room ? "is-on" : ""}`}>
            {r.name}
          </Link>
        ))}
      </div>
      <div
        className="chat-log"
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {msgs.length === 0 && <p className="muted cm-empty">Здесь пока пусто — начните разговор!</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`chat-msg ${m.mine ? "is-mine" : ""}`}>
            {!m.mine && <Avatar name={m.author.name} src={m.author.avatarUrl} className={`chat-av${ringCls(m.author.look)}`} />}
            <div className="chat-bubble">
              {!m.mine && (
                <div className="chat-meta">
                  <Link href={`/u/${m.author.id}`} title="Профиль" className={nameCls(m.author.look)}>{m.author.name}</Link>
                  <Emblem value={m.author.look?.emblem} />
                  {m.author.pro && <span className="pro-badge">Pro</span>}
                </div>
              )}
              <p className="cm-text">{m.text}</p>
              <div className="chat-time">
                <time dateTime={m.createdAt}>{time(m.createdAt)}</time>
                {(admin || m.mine) && (
                  <button className="cm-del" onClick={() => del(m.id)} aria-label="Удалить"><Icon name="trash" size="sm" /></button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={send}>
        <input className="input" value={text} maxLength={CHAT_MAX} onChange={(e) => setText(e.target.value)} placeholder="Сообщение" aria-label="Сообщение" />
        <button className="btn btn-primary" disabled={busy || !text.trim()} aria-label="Отправить"><Icon name="send" size="sm" /></button>
      </form>
    </div>
  );
}
