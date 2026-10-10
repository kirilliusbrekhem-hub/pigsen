"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { dictFor, rub, type Lang } from "@/lib/kapital/i18n";
import { Ico } from "./Art";

const AMOUNTS = [1000, 2500, 5000, 10000];
const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

interface Result {
  capital: number;
  pct: number;
  streak: number;
  proof: { status: string; label: string } | null;
  proofError: string | null;
}

export function SaveScreen({ lang, bizName, capital, target, streak }: { lang: Lang; bizName: string; capital: number; target: number; streak: number }) {
  const t = dictFor(lang);
  const router = useRouter();
  const [amt, setAmt] = useState(5000);
  const [custom, setCustom] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const customN = Number.parseInt(custom.replace(/\D/g, ""), 10);
  const amount = custom && customN > 0 ? Math.min(customN, 100_000_000) : amt;
  const before = Math.max(0, Math.min(100, Math.floor((capital / target) * 100)));
  const after = Math.max(0, Math.min(100, Math.floor(((capital + amount) / target) * 100)));
  const short = (a: number) => (lang === "en" ? `${a / 1000}k` : `${(a / 1000).toLocaleString("ru-RU")} тыс`);

  function pickFile(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!TYPES.includes(f.type)) return setError(t.fileType);
    if (f.size > MAX_BYTES) return setError(t.fileTooBig);
    const reader = new FileReader();
    reader.onload = () => setProof(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setError(t.fileType);
    reader.readAsDataURL(f);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<Result>("/api/kapital/deposit", { method: "POST", body: { amount, proof } });
      setDone(r);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const got = Math.max(0, done.pct - before);
    return (
      <div className="kp-screen full" style={{ gap: 0 }}>
        <Header t={t} bizName={bizName} />
        <div className="fade" style={{ textAlign: "center", marginTop: 30 }}>
          <div className="eyebrow" style={{ letterSpacing: ".2em" }}>{t.grew}</div>
          <div className="serif" style={{ fontSize: 44, marginTop: 8 }}>+{rub(amount, lang)}</div>
          <div style={{ fontSize: 15, color: "var(--k-muted)", marginTop: 6 }}>{t.savedOf(rub(done.capital, lang), rub(target, lang))}</div>
        </div>
        <div className="k-card" style={{ marginTop: 22, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--k-muted)", marginBottom: 10 }}>
            <span>{t.progressOf(done.pct)}</span>
            <span className="green" style={{ fontWeight: 700 }}>+{got}%</span>
          </div>
          <div className="k-progress"><i style={{ width: `${Math.max(done.pct, 1)}%`, transition: "width .8s ease" }} /></div>
        </div>
        {(done.proof || done.proofError) && (
          <div className={done.proofError ? "k-err" : "k-ok"} style={{ marginTop: 12 }} role="status">
            {done.proofError ?? `${t.proofPending}: ${done.proof?.label}`}
          </div>
        )}
        <div className="fade" style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", borderRadius: 18, background: "var(--k-s2)" }}>
          <span className="serif green" style={{ fontSize: 22 }}>{Math.max(1, done.streak)}</span>
          <span style={{ fontSize: 14, lineHeight: 1.4 }}>{t.streakLine(Math.max(1, done.streak))}</span>
        </div>
        <Link href="/business" className="k-btn" style={{ marginTop: "auto" }}>
          {t.toBiz}
        </Link>
      </div>
    );
  }

  return (
    <div className="kp-screen full" style={{ gap: 0 }}>
      <Header t={t} bizName={bizName} />
      <div style={{ textAlign: "center", marginTop: 36 }}>
        <div style={{ fontSize: 13, color: "var(--k-muted)" }}>{t.howMuch}</div>
        <div className="serif green" style={{ fontSize: amount >= 1_000_000 ? 44 : 64, marginTop: 6, lineHeight: 1.15 }} aria-live="polite">{rub(amount, lang)}</div>
        <div style={{ fontSize: 14, color: "var(--k-muted)", marginTop: 2 }}>{t.plusPct(after)}</div>
      </div>
      <div className="amounts" style={{ marginTop: 28 }}>
        {AMOUNTS.map((a) => (
          <button key={a} type="button" aria-pressed={!custom && amt === a} onClick={() => { setAmt(a); setCustom(""); }}>
            {short(a)}
          </button>
        ))}
      </div>
      <label className="amt-input" style={{ marginTop: 8 }}>
        <span className="sr">{t.otherAmount}</span>
        <input inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d\s]/g, "").slice(0, 11))} placeholder={t.otherAmount} />
      </label>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr" tabIndex={-1} aria-hidden="true" onChange={(e) => pickFile(e.target.files?.[0])} />
      <button type="button" className={`proof-btn ${proof ? "on" : ""}`} style={{ marginTop: 14 }} onClick={() => (proof ? setProof(null) : fileRef.current?.click())}>
        <span className="ic">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the user's own file */}
          {proof ? <img src={proof} alt="" /> : <Ico name="photo" color="#85BB65" />}
        </span>
        <span>
          <b>{proof ? t.proofAdded : t.proofAdd}</b>
          <span>{proof ? t.proofSubOk : t.proofSub}</span>
        </span>
      </button>
      <div style={{ marginTop: 12, fontSize: 12, color: "var(--k-dim)", textAlign: "center", lineHeight: 1.5 }}>{t.proofNote}</div>
      {error && (
        <div className="k-err" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
      <button type="button" className="k-btn" style={{ marginTop: "auto" }} onClick={save} disabled={busy || amount < 1}>
        {busy ? <span className="k-spin" /> : t.saveAmt(rub(amount, lang))}
      </button>
    </div>
  );
}

function Header({ t, bizName }: { t: ReturnType<typeof dictFor>; bizName: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Link href="/business" aria-label={t.back} className="k-round">
        <Ico name="back" />
      </Link>
      <div style={{ fontWeight: 700, fontSize: 16, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.depositTo(bizName)}</div>
    </div>
  );
}
