"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { dictFor, monthYear, rub, type Lang } from "@/lib/kapital/i18n";
import type { KapView } from "@/lib/kapital/service";
import { Brand, Guilloche, Ico } from "./Art";
import { CapChat } from "./CapChat";

const AMOUNTS = [1000, 2500, 5000, 10000];

function hoursLeftToday() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 3_600_000));
}

export function BusinessScreen({ lang, view, greeting }: { lang: Lang; view: KapView; greeting: string }) {
  const t = dictFor(lang);
  const router = useRouter();
  const [capital, setCapital] = useState(view.biz.capital);
  const [amt, setAmt] = useState(5000);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const b = view.biz;
  const pct = Math.max(0, Math.min(100, Math.floor((capital / b.target) * 100)));
  const hours = hoursLeftToday();
  const eventTitle = b.crisis ? b.crisis.title : b.event;
  const capLine = view.capLine || greeting;
  const youInitial = view.members.find((m) => m.you)?.initial ?? "K";
  const others = view.members.filter((m) => !m.you);

  async function quickSave() {
    setBusy(true);
    setToast(null);
    try {
      const r = await api<{ capital: number; pct: number }>("/api/kapital/deposit", { method: "POST", body: { amount: amt } });
      setCapital(r.capital);
      setToast({ ok: true, text: t.saveToast(rub(amt, lang), r.pct) });
      router.refresh();
    } catch (e) {
      setToast({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
      window.setTimeout(() => setToast(null), 3200);
    }
  }

  const eventCard = (
    <Link href="/business/event" className="k-card strong" style={{ borderRadius: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span className="eyebrow" style={{ fontSize: 11 }}>{t.eventDay}</span>
        <span style={{ fontSize: 12, color: "var(--k-dim)" }}>{t.hoursLeft(hours)}</span>
      </div>
      <div className="serif" style={{ marginTop: 8, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>{eventTitle}</div>
      <div style={{ marginTop: 4, color: "var(--k-muted)", fontSize: 14 }}>{t.eventOpen}</div>
    </Link>
  );

  const capCard = (
    <Link href="/cap" className="k-card" style={{ display: "flex", gap: 12 }}>
      <span className="cap-av">CAP</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{t.capCofounder}</span>
        <span style={{ display: "block", color: "var(--k-ink-2)", fontSize: 14, lineHeight: 1.4, marginTop: 2 }}>{capLine}</span>
      </span>
    </Link>
  );

  const teamTile = (
    <Link href="/team" className="k-card" style={{ padding: 14, borderRadius: 20 }}>
      <div className="avs">
        <span>{youInitial}</span>
        {others.slice(0, 3).map((m, i) => (
          <span key={i}>{m.initial}</span>
        ))}
        {view.members.length < b.maxMembers && <span className="plus">+</span>}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, marginTop: 10 }}>{t.team}</div>
      <div style={{ fontSize: 12, color: "var(--k-muted)", marginTop: 2 }}>{view.members.length > 1 ? `${view.members.length} · ${t.weekGoal.toLowerCase()} ${Math.min(100, Math.round((view.week.saved / view.week.target) * 100))}%` : t.inviteCofounder}</div>
    </Link>
  );

  const investorsTile = (
    <Link href={view.pro ? "/biz" : "/plans"} className="k-card" style={{ padding: 14, borderRadius: 20 }}>
      <div className="serif green" style={{ fontSize: 22 }}>{b.investors}</div>
      <div style={{ fontWeight: 700, fontSize: 14, marginTop: 6 }}>{t.investorsWait(b.investors)}</div>
      <div style={{ fontSize: 12, color: "var(--k-muted)", marginTop: 2 }}>{view.pro ? t.inPro : t.openInPro}</div>
    </Link>
  );

  return (
    <div className="kp-bizpage">
      <div className="center">
        {/* phone header */}
        <div className="kp-top kp-mob-only">
          <Brand href="/business" />
          <span className="kp-pill">
            <span className="lamp glow" />
            {t.days(view.streak)}
          </span>
        </div>

        {/* banknote hero */}
        <div className="note hero" style={{ padding: 18 }}>
          <Guilloche width={700} height={300} waves={3} style={{ right: -80, top: -30, opacity: 0.32 }} />
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div className="eyebrow ink" style={{ fontSize: 11, letterSpacing: ".18em" }}>
                  {b.typeLabel} · {t.level} {b.level}
                </div>
                <h1 className="num" style={{ fontSize: 38, lineHeight: 1, marginTop: 6, overflowWrap: "anywhere" }}>{b.name}</h1>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                <div className="soft" style={{ fontSize: 11 }}>{t.health}</div>
                <div className="num" style={{ fontSize: 26 }}>{b.grade}</div>
              </div>
            </div>
            <div className="kp-desk-only" style={{ fontSize: 16, marginTop: 8 }}>{b.pitch}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <span className="num" style={{ fontSize: 30 }}>{rub(capital, lang)}</span>
              <span style={{ fontSize: 14 }}>
                {t.of} {rub(b.target, lang)}
              </span>
            </div>
            <div className="bar" style={{ marginTop: 8 }}>
              <i style={{ width: `${Math.max(pct, capital > 0 ? 1 : 0)}%` }} />
            </div>
            <div style={{ marginTop: 10, fontSize: 13 }}>
              {t.realLaunch}: <b>{monthYear(b.launch, lang)}</b>
              {b.launchWithFriend && (
                <>
                  . {t.fasterFriend}: <b>{monthYear(b.launchWithFriend, lang)}</b>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="row2">
          <div className="main k-card kp-desk-only" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--k-muted)", gap: 10 }}>
              <span>{t.leftTo(rub(Math.max(0, b.target - capital), lang))}</span>
              <span className="green" style={{ fontWeight: 700 }}>{t.progressOf(pct)}</span>
            </div>
            <div>
              <div className="amounts inline" style={{ marginTop: 14 }}>
                {AMOUNTS.map((a) => (
                  <button key={a} type="button" aria-pressed={amt === a} onClick={() => setAmt(a)}>
                    {rub(a, lang)}
                  </button>
                ))}
                <button type="button" className="k-btn" style={{ flex: 1, minWidth: 200, height: 50, borderRadius: 14, fontSize: 16 }} onClick={quickSave} disabled={busy}>
                  {busy ? <span className="k-spin" /> : t.saveAmt(rub(amt, lang))}
                </button>
              </div>
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <Link href="/business/save">{t.proofLink} →</Link>
              </div>
              {toast && (
                <div className={`fade ${toast.ok ? "k-ok" : "k-err"}`} style={{ marginTop: 12 }} role="status">
                  {toast.text}
                </div>
              )}
            </div>
          </div>
          <div className="aside">
            {eventCard}
            <div className="kp-mob-only">{capCard}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              {teamTile}
              {investorsTile}
            </div>
          </div>
        </div>
        <div className="kp-biz-pad kp-mob-only" />
      </div>

      <aside className="side" aria-label="CAP">
        <CapChat lang={lang} bizName={b.name} greeting={greeting} compact />
      </aside>

      <Link href="/business/save" className="k-btn kp-fab kp-mob-only">
        <Ico name="plus" color="#06120B" />
        {t.save}
      </Link>
    </div>
  );
}
