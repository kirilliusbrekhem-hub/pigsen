"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { dictFor, rub, type Lang } from "@/lib/kapital/i18n";
import type { KapView } from "@/lib/kapital/service";
import { Ico } from "./Art";

type Crisis = NonNullable<KapView["biz"]["crisis"]>;

/**
 * «Событие дня». When the business has an open crisis (lib/biz/game.ts) it is the event with real choices,
 * resolved server-side. Otherwise today's simulated event is shown and the daily decision is a labelled placeholder.
 */
export function EventScreen({ lang, today, crisis }: { lang: Lang; today: string; crisis: Crisis | null }) {
  const t = dictFor(lang);
  const router = useRouter();
  const [chosen, setChosen] = useState<{ label: string; good: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = new Date().toLocaleDateString(lang === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "long" });
  const advised = crisis ? [...crisis.options].filter((o) => o.affordable).sort((a, b) => b.chance - a.chance)[0] : null;

  async function pick(optionId: string, label: string) {
    if (!crisis) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ outcome: { good: boolean; text: string } }>("/api/biz/crisis", { method: "POST", body: { crisisId: crisis.id, optionId } });
      setChosen({ label, good: r.outcome.good, text: r.outcome.text });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kp-screen full" style={{ gap: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Link href="/business" aria-label={t.back} className="k-round">
          <Ico name="back" />
        </Link>
        <span className="eyebrow" style={{ textAlign: "center" }}>{t.eventOf(date)}</span>
        <span style={{ width: 44 }} />
      </div>
      <div style={{ marginTop: 20, height: 230, borderRadius: 24, background: "var(--k-s1)", border: "1px solid var(--k-line)", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="400" height="230" viewBox="0 0 400 230" aria-hidden="true" style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)" }}>
          <g fill="none" stroke="#1C2F25" strokeWidth="1">
            <circle cx="200" cy="115" r="40" />
            <circle cx="200" cy="115" r="70" />
            <circle cx="200" cy="115" r="100" />
            <circle cx="200" cy="115" r="130" />
          </g>
        </svg>
        <div style={{ position: "relative", textAlign: "center" }}>
          <div className="serif green" style={{ fontSize: 56 }}>{crisis ? "!" : "?"}</div>
          <div style={{ fontSize: 13, color: "var(--k-muted)" }}>{crisis ? t.eventDay : t.eventIllustration}</div>
        </div>
      </div>
      <h1 className="serif" style={{ marginTop: 18, fontSize: 28, lineHeight: 1.1 }}>{crisis ? crisis.title : t.eventPlaceholderTitle}</h1>
      <p style={{ marginTop: 10, color: "var(--k-muted)", fontSize: 15, lineHeight: 1.5 }}>{crisis ? `${crisis.text} ${crisis.pig}` : t.eventPlaceholderText}</p>
      {!crisis && (
        <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5 }}>
          <span className="green" style={{ fontWeight: 700 }}>{t.eventToday}:</span> {today}
        </p>
      )}
      {error && (
        <div className="k-err" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
      {chosen ? (
        <div className="fade" style={{ marginTop: "auto", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ padding: 16, borderRadius: 18, background: "var(--k-green)", color: "var(--k-on-green)" }}>
            <div className="eyebrow ink" style={{ letterSpacing: ".14em" }}>{t.youChose(chosen.label)}</div>
            <div className="serif" style={{ fontSize: 22, marginTop: 6 }}>{chosen.good ? t.goodOutcome : t.badOutcome}</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>{chosen.text}</div>
          </div>
          <Link href="/business" className="k-btn ghost" style={{ height: 56, fontSize: 16, fontWeight: 700, borderColor: "var(--k-line2)" }}>
            {t.backToBiz}
          </Link>
        </div>
      ) : crisis ? (
        <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {crisis.options.map((o) => (
            <button key={o.id} type="button" className="plan" style={{ borderColor: "var(--k-line2)" }} disabled={busy || !o.affordable} onClick={() => pick(o.id, o.label)}>
              <span style={{ display: "block", fontWeight: 700, fontSize: 15 }}>{o.label}</span>
              <span style={{ display: "block", fontSize: 13, color: "var(--k-muted)", marginTop: 4 }}>
                {t.chance(o.chance)} · {o.cost ? t.costs(rub(o.cost, lang)) : t.free}
              </span>
            </button>
          ))}
          {advised && <div style={{ fontSize: 13, color: "var(--k-dim)", textAlign: "center" }}>{t.capAdvises(advised.label)}</div>}
        </div>
      ) : (
        <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {[t.decisionA, t.decisionB].map((d) => (
            <button key={d} type="button" className="plan" style={{ borderColor: "var(--k-line2)" }} disabled>
              <span style={{ display: "block", fontWeight: 700, fontSize: 15 }}>{d}</span>
              <span style={{ display: "block", fontSize: 13, color: "var(--k-muted)", marginTop: 4 }}>{t.riskGain}</span>
            </button>
          ))}
          <div style={{ fontSize: 13, color: "var(--k-dim)", textAlign: "center" }}>{t.soonDecisions}</div>
        </div>
      )}
    </div>
  );
}
