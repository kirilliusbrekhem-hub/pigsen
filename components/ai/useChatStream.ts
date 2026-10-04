"use client";
import { useCallback, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import type { ContentCardDTO, MessageDTO } from "@/types";

export interface ChatMessage extends MessageDTO {
  status?: "thinking" | "streaming" | "done" | "error";
  mock?: boolean;
}

type StreamEvent =
  | { type: "meta"; userMessageId: string; provider: string; mock: boolean; related: ContentCardDTO[]; followUps: string[] }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string }
  | { type: "error"; message: string };

/** Owns the chat transcript and the NDJSON streaming protocol of POST /api/ai/conversations/:id/messages. */
export function useChatStream(initial: ChatMessage[]) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; question: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const patchLast = (fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((ms) => (ms.length && ms[ms.length - 1].role === "assistant" ? [...ms.slice(0, -1), fn(ms[ms.length - 1])] : ms));

  const send = useCallback(async (conversationId: string, question: string, opts: { retry?: boolean } = {}) => {
    setError(null);
    setBusy(true);
    const now = new Date().toISOString();
    setMessages((ms) => {
      const base = opts.retry && ms.length && ms[ms.length - 1].role === "assistant" ? ms.slice(0, -1) : ms;
      const withQ = opts.retry ? base : [...base, { id: `tmp-u-${now}`, role: "user" as const, content: question, createdAt: now, related: [], followUps: [], provider: null }];
      return [...withQ, { id: `tmp-a-${now}`, role: "assistant" as const, content: "", createdAt: now, related: [], followUps: [], provider: null, status: "thinking" as const }];
    });

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`/api/ai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: question }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Не удалось получить ответ");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let failed: string | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as StreamEvent;
          if (ev.type === "meta") patchLast((m) => ({ ...m, related: ev.related, followUps: ev.followUps, provider: ev.provider, mock: ev.mock }));
          else if (ev.type === "delta") patchLast((m) => ({ ...m, content: m.content + ev.text, status: "streaming" }));
          else if (ev.type === "done") patchLast((m) => ({ ...m, id: ev.messageId, status: "done" }));
          else if (ev.type === "error") failed = ev.message;
        }
      }
      if (failed) throw new Error(failed);
      patchLast((m) => (m.status === "done" ? m : { ...m, status: "done" }));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        patchLast((m) => ({ ...m, status: "done", content: m.content || "_Ответ остановлен._" }));
      } else {
        patchLast((m) => ({ ...m, status: "error" }));
        setError({ message: errorMessage(e), question });
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }, []);

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback((next: ChatMessage[] = []) => {
    abortRef.current?.abort();
    setMessages(next);
    setError(null);
  }, []);

  return { messages, busy, error, send, stop, reset };
}

export async function createConversation(): Promise<string> {
  try {
    const r = await api<{ id: string }>("/api/ai/conversations", { method: "POST", body: {} });
    return r.id;
  } catch (e) {
    throw new Error(errorMessage(e));
  }
}
