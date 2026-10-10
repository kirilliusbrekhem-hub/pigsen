"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { dictFor, type Lang } from "@/lib/kapital/i18n";
import { Ico } from "./Art";

interface Msg {
  k: "me" | "cap" | "oops";
  text: string;
}

const STORE = "kap-cap-chat";

/** 1:1 chat with CAP. History lives in this tab's sessionStorage; answers come from /api/kapital/cap. */
export function CapChat({ lang, bizName, greeting, compact = false }: { lang: Lang; bizName: string | null; greeting: string; compact?: boolean }) {
  const t = dictFor(lang);
  const [msgs, setMsgs] = useState<Msg[]>([{ k: "cap", text: greeting }]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [limited, setLimited] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE);
      const saved = raw ? (JSON.parse(raw) as Msg[]) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore this tab's history after mount
      if (Array.isArray(saved) && saved.length) setMsgs([{ k: "cap", text: greeting }, ...saved.filter((m) => m && typeof m.text === "string").slice(-30)]);
    } catch {}
    const ts = timers.current;
    return () => ts.forEach((x) => window.clearTimeout(x));
  }, [greeting]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(1).slice(-30)));
    } catch {}
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing]);

  async function ask(q: string) {
    const text = q.trim().slice(0, 300);
    if (!text || typing) return;
    setDraft("");
    setMsgs((m) => [...m, { k: "me", text }]);
    setTyping(true);
    try {
      const r = await api<{ messages: { kind: "cap" | "oops"; text: string }[]; limited: boolean }>("/api/kapital/cap", { method: "POST", body: { text, lang } });
      if (r.limited) {
        setLimited(true);
        setMsgs((m) => [...m, { k: "cap", text: t.capLimit }]);
        setTyping(false);
        return;
      }
      // Replies arrive one by one, like a person typing; a correction comes a beat later.
      r.messages.forEach((m, i) => {
        timers.current.push(
          window.setTimeout(() => {
            setMsgs((xs) => [...xs, { k: m.kind, text: m.text }]);
            if (i === r.messages.length - 1) setTyping(false);
          }, 500 + i * 1400),
        );
      });
      if (!r.messages.length) setTyping(false);
    } catch (e) {
      setMsgs((m) => [...m, { k: "cap", text: errorMessage(e) }]);
      setTyping(false);
    }
  }

  return (
    <>
      <div className="head" style={compact ? { display: "flex", alignItems: "center", gap: 12, paddingBottom: 12, borderBottom: "1px solid var(--k-line)" } : undefined}>
        <span className="cap-av solid" style={compact ? { width: 46, height: 46, borderRadius: 14, fontSize: 14 } : undefined}>CAP</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: compact ? 15 : 16 }}>CAP</div>
          <div style={{ fontSize: 13, color: "var(--k-muted)" }}>{compact || !bizName ? t.capSubShort : t.capSub(bizName)}</div>
        </div>
      </div>
      <div className="scroll chat" ref={scroller} style={compact ? { flex: 1, overflowY: "auto", padding: "14px 0", minHeight: 0 } : undefined} aria-live="polite">
        {msgs.map((m, i) =>
          m.k === "oops" ? (
            <div key={i} className="bub oops">
              <b>{t.correction}</b>
              {m.text}
            </div>
          ) : (
            <div key={i} className={`bub ${m.k}`}>
              {m.text}
            </div>
          ),
        )}
        {typing && (
          <div className="typing" aria-label="CAP печатает">
            <i />
            <i />
            <i />
          </div>
        )}
      </div>
      <div className="k-chips">
        {t.asks.map((q) => (
          <button key={q} type="button" className="k-chip" style={{ borderColor: "var(--k-line2)", minHeight: 38 }} onClick={() => ask(q)} disabled={typing}>
            {q}
          </button>
        ))}
      </div>
      {limited ? (
        <Link href="/plans" className="k-btn sm" style={{ width: "100%", marginTop: 4 }}>
          Pro
        </Link>
      ) : (
        <form
          className="askbar"
          style={{ marginTop: 4 }}
          onSubmit={(e) => {
            e.preventDefault();
            void ask(draft);
          }}
        >
          <label className="sr" htmlFor={compact ? "cap-q-side" : "cap-q"}>
            {t.msgLabel}
          </label>
          <input id={compact ? "cap-q-side" : "cap-q"} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.askCap} maxLength={300} autoComplete="off" />
          <button type="submit" className="k-send" aria-label={t.send} disabled={!draft.trim() || typing}>
            <Ico name="up" size={16} color="#06120B" />
          </button>
        </form>
      )}
    </>
  );
}
