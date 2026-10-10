"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { dictFor, type Lang } from "@/lib/kapital/i18n";
import { Ico } from "./Art";

type PlanKey = "free" | "pro" | "pro10";
export interface Prices {
  pro: { month: number; year: number };
  pro10: { month: number; year: number };
}

/** Kapital tiers: Free, Pro (4 people) and Pro 10, paid in Telegram Stars via /api/billing/checkout. */
export function PlansScreen({ lang, prices, current }: { lang: Lang; prices: Prices; current: "free" | "pro" | "pro7" | "pro10" }) {
  const t = dictFor(lang);
  const router = useRouter();
  const [yearly, setYearly] = useState(false);
  const [sel, setSel] = useState<PlanKey>(current === "free" ? "pro" : current === "pro7" ? "pro10" : current);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = (v: number) => v.toLocaleString(lang === "en" ? "en-US" : "ru-RU");
  const priceOf = (k: PlanKey) => (k === "free" ? "0 ★" : yearly ? `${n(prices[k].year)} ★/${t.perYear}` : `${n(prices[k].month)} ★/${t.perMonth}`);
  const sp = t.plans.find((p) => p.id === sel)!;
  const isCurrent = sel === current || (sel === "free" && current === "free");

  async function pay() {
    if (sel === "free") return;
    setBusy(true);
    setError(null);
    const plan = sel === "pro" ? (yearly ? "year" : "month") : yearly ? "year10" : "month10";
    // Open the window synchronously so popup blockers allow it, then point it at the invoice.
    const win = typeof window !== "undefined" ? window.open("", "_blank") : null;
    try {
      const r = await api<{ url: string; id?: string; telegram?: boolean }>("/api/billing/checkout", { method: "POST", body: { plan } });
      if (win) win.location.href = r.url;
      else window.location.assign(r.url);
      if (r.telegram && r.id) void waitFor(r.id);
    } catch (e) {
      win?.close();
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function waitFor(id: string) {
    setWaiting(true);
    for (let i = 0; i < 150; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const s = await api<{ status: string | null }>(`/api/billing/status?id=${encodeURIComponent(id)}`);
        if (s.status === "succeeded") {
          setPaid(true);
          setWaiting(false);
          router.refresh();
          return;
        }
      } catch {
        /* keep polling */
      }
    }
    setWaiting(false);
  }

  return (
    <div className="kp-screen full" style={{ gap: 0, paddingTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Link href="/business" aria-label={t.close} className="k-round">
          <Ico name="close" />
        </Link>
        <div role="group" aria-label={lang === "en" ? "Period" : "Период"} className="k-seg" style={{ background: "var(--k-s1)" }}>
          <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)} style={{ padding: "0 16px" }}>
            {t.month}
          </button>
          <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)} style={{ padding: "0 16px" }}>
            {t.year}
          </button>
        </div>
      </div>
      <h1 className="serif" style={{ marginTop: 22, fontSize: 34, lineHeight: 1.05 }}>
        {t.proH1}
        <br />
        <em className="green">{t.proH2}</em>
      </h1>
      <p style={{ marginTop: 8, color: "var(--k-muted)", fontSize: 14 }}>{t.proSub}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
        {t.plans.map((p) => (
          <button key={p.id} type="button" className="plan" aria-pressed={sel === p.id} onClick={() => { setSel(p.id as PlanKey); setPaid(false); setError(null); }}>
            <span className="top">
              <span>{p.name}</span>
              <span className="green">{priceOf(p.id as PlanKey)}</span>
            </span>
            <span className="who">
              {p.who}
              {(p.id === current || (p.id === "pro10" && current === "pro7")) && ` · ${t.currentPlan}`}
            </span>
            <span className="feats">{p.feats}</span>
          </button>
        ))}
      </div>
      {error && (
        <div className="k-err" role="alert" style={{ marginTop: 14 }}>
          {error}
        </div>
      )}
      <div style={{ marginTop: "auto", paddingTop: 16 }}>
        {paid ? (
          <div className="fade" style={{ padding: 16, borderRadius: 18, background: "var(--k-green)", color: "var(--k-on-green)", textAlign: "center", fontWeight: 700 }}>{t.paidOk(sp.name)}</div>
        ) : waiting ? (
          <div className="k-ok" style={{ textAlign: "center" }}>{t.waitingPay}</div>
        ) : (
          <button type="button" className="k-btn" onClick={pay} disabled={busy || sel === "free" || isCurrent}>
            {busy ? <span className="k-spin" /> : isCurrent ? t.currentPlan : sel === "free" ? "Free · 0 ★" : t.pay(priceOf(sel))}
          </button>
        )}
      </div>
    </div>
  );
}
