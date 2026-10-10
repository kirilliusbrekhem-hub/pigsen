"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { ConversationSummaryDTO } from "@/types";

function when(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (days < 7) return d.toLocaleDateString("ru-RU", { weekday: "short" });
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

interface Props {
  items: ConversationSummaryDTO[];
  activeId: string | null;
  onDelete: (id: string) => void;
  onSelect?: () => void;
}

export function ConversationList({ items, activeId, onDelete, onSelect }: Props) {
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!items.length) {
    return <p className="muted" style={{ fontSize: 12.5, padding: "4px 10px" }}>Здесь появится история ваших разговоров с CAP.</p>;
  }
  return (
    <div className="ctx-list">
      {items.map((c) => (
        <div key={c.id} className={`convo-item ${c.id === activeId ? "is-active" : ""}`}>
          <Link href={`/ai/${c.id}`} onClick={onSelect} aria-current={c.id === activeId ? "page" : undefined}>
            <b>{c.title}</b>
            <span>
              {when(c.updatedAt)} · {c.messageCount} сообщ.
            </span>
          </Link>
          {confirm === c.id ? (
            <button className="btn btn-danger btn-sm" style={{ marginRight: 4 }} onClick={() => onDelete(c.id)} onBlur={() => setConfirm(null)} autoFocus>
              Удалить
            </button>
          ) : (
            <button className="icon-btn del" aria-label={`Удалить разговор «${c.title}»`} onClick={() => setConfirm(c.id)}>
              <Icon name="trash" size="sm" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
