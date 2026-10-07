"use client";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { api } from "@/lib/client/api";
import type { ConversationView } from "@/lib/social/meta";
import { usePoll } from "./usePoll";

const when = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function DmList({ initial }: { initial: ConversationView[] }) {
  const [list, setList] = useState(initial);
  usePoll(async () => setList((await api<{ conversations: ConversationView[] }>("/api/dm")).conversations), 10_000);
  if (!list.length) return <p className="muted cm-empty">Диалогов пока нет. Напишите автору понравившегося поста в комьюнити.</p>;
  return (
    <ul className="card dm-list">
      {list.map((c) => (
        <li key={c.user.id}>
          <Link href={`/messages/${c.user.id}`} className={`dm-row ${c.unread ? "is-unread" : ""}`}>
            <Avatar name={c.user.name} src={c.user.avatarUrl} className="dm-av" />
            <span className="dm-body">
              <span className="dm-top">
                <b>{c.user.name}</b>
                {c.user.pro && <span className="pro-badge">Pro</span>}
                <time className="muted" dateTime={c.last.createdAt}>{when(c.last.createdAt)}</time>
              </span>
              <span className="dm-last muted">{c.last.mine ? "Вы: " : ""}{c.last.text}</span>
            </span>
            {c.unread > 0 && <span className="dm-badge">{c.unread}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
