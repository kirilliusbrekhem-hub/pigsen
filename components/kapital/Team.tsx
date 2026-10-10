"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { dictFor, monthYear, rub, type Lang } from "@/lib/kapital/i18n";
import type { KapView } from "@/lib/kapital/service";
import { Guilloche } from "./Art";

export function TeamScreen({ lang, view }: { lang: Lang; view: KapView }) {
  const t = dictFor(lang);
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const b = view.biz;
  const full = view.members.length >= b.maxMembers;
  const weekPct = Math.min(100, Math.round((view.week.saved / view.week.target) * 100));

  async function copy() {
    if (!b.invitePath) return;
    const url = `${window.location.origin}${b.invitePath}`;
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) await navigator.share({ title: "Kapital", text: b.name, url });
      else await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        setError(url);
      }
    }
  }

  async function leave() {
    if (!window.confirm(t.leaveConfirm)) return;
    try {
      await api("/api/biz/leave", { method: "POST" });
      router.replace("/new");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="kp-screen" style={{ paddingTop: 20 }}>
      <h1 className="kp-title" style={{ overflowWrap: "anywhere" }}>{t.teamOf(b.name)}</h1>
      <p style={{ color: "var(--k-muted)", fontSize: 14, lineHeight: 1.45 }}>{t.teamSub}</p>

      <div className="k-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span className="eyebrow" style={{ fontSize: 11 }}>{t.weekGoal}</span>
          <span className="serif" style={{ fontSize: 18 }}>
            {rub(view.week.saved, lang)} / {rub(view.week.target, lang)}
          </span>
        </div>
        <div className="k-progress" style={{ marginTop: 10 }}>
          <i style={{ width: `${weekPct}%` }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--k-muted)" }}>{t.weekHint}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {view.members.map((m, i) => (
          <div key={i} className="k-row">
            <span className={`av ${m.you ? "me" : ""}`}>{m.initial}</span>
            <span className="t">
              <b>{m.name}</b>
              <span>
                {m.role === "founder" ? t.founder : t.cofounder} · {m.share}%
              </span>
            </span>
            <span className="amt">{rub(Math.max(0, m.contributed), lang)}</span>
          </div>
        ))}
        <div className="k-row">
          <span className="cap-av" style={{ borderRadius: 12, fontSize: 12 }}>CAP</span>
          <span className="t">
            <b>CAP</b>
            <span>{t.aiCofounder}</span>
          </span>
          <span style={{ fontSize: 14, color: "var(--k-muted)" }}>{t.ideas}</span>
        </div>
      </div>

      <div className="dashed">
        <div style={{ fontWeight: 700, fontSize: 16 }}>{full ? t.teamFull(b.maxMembers) : t.inviteMore}</div>
        <div style={{ fontSize: 13, color: "var(--k-muted)", marginTop: 4 }}>{t.capsLine(view.freeCap, view.proMaxCap)}</div>
        {!full && b.invitePath && (
          <button type="button" className="k-btn sm" style={{ margin: "12px auto 0", padding: "0 22px", background: copied ? "var(--k-green-2)" : undefined }} onClick={copy}>
            {copied ? t.copied : t.copyInvite}
          </button>
        )}
        {full && !view.pro && (
          <a href="/plans" className="k-btn sm" style={{ margin: "12px auto 0", padding: "0 22px" }}>
            Pro
          </a>
        )}
        {error && (
          <div className="k-err" style={{ marginTop: 10, overflowWrap: "anywhere" }} role="alert">
            {error}
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: "var(--k-muted)", marginTop: 4 }}>{t.storyCard}</div>
      <div className="note" style={{ borderRadius: 22 }}>
        <Guilloche width={400} height={200} waves={2} style={{ right: -90, top: -10, opacity: 0.3 }} />
        <div className="eyebrow ink" style={{ fontSize: 11, letterSpacing: ".18em" }}>{t.buildingOn}</div>
        <div className="num" style={{ fontSize: 30, marginTop: 6, overflowWrap: "anywhere" }}>
          {b.name} · {b.pct}%
        </div>
        <div style={{ fontSize: 14, marginTop: 4 }}>{t.storyLine(b.typeLabel, monthYear(b.launch, lang).toLowerCase(), view.members.length)}</div>
        <div style={{ fontSize: 12, fontWeight: 700, marginTop: 12 }}>Savings that start businesses</div>
      </div>

      <button type="button" onClick={leave} style={{ background: "none", border: "none", color: "var(--k-dim)", fontSize: 14, padding: "12px 0", alignSelf: "center" }}>
        {t.leave}
      </button>
    </div>
  );
}
