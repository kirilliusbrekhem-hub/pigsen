"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { dictFor, type Lang } from "@/lib/kapital/i18n";
import { LangToggle } from "./LangToggle";

export interface ProfileData {
  name: string;
  saved: number;
  streak: number;
  rank: number | null;
  bizName: string | null;
  badges: boolean[];
  tier: "free" | "pro" | "pro7" | "pro10";
}

const TIER_NAME = { free: "Free", pro: "Pro", pro7: "Pro 7", pro10: "Pro 10" } as const;

export function ProfileScreen({ lang: initialLang, data }: { lang: Lang; data: ProfileData }) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(initialLang);
  const [out, setOut] = useState(false);
  const t = dictFor(lang);
  const compact = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}${lang === "en" ? "M" : "м"}` : n >= 1000 ? `${Math.round(n / 1000)}${lang === "en" ? "k" : "к"}` : String(n));
  const icons = ["1", "7", "2", "K"];

  async function logout() {
    setOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <div className="kp-screen" style={{ paddingTop: 24, gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="avatar-xl">{(data.name.trim().charAt(0) || "K").toUpperCase()}</span>
        <span style={{ minWidth: 0 }}>
          <h1 className="serif" style={{ fontSize: 24, overflowWrap: "anywhere" }}>{data.name}</h1>
          <span style={{ display: "block", fontSize: 13, color: "var(--k-green)", fontWeight: 600, marginTop: 2 }}>{data.bizName ? t.founderOf(data.bizName) : t.noBizYet}</span>
        </span>
      </div>
      <div className="stat3">
        <div>
          <div className="serif">{compact(data.saved)}</div>
          <span>{t.savedStat}</span>
        </div>
        <div>
          <div className="serif">{data.streak}</div>
          <span>{t.streakStat}</span>
        </div>
        <div>
          <div className="serif">{data.rank ? `№ ${data.rank}` : "—"}</div>
          <span>{t.rankStat}</span>
        </div>
      </div>
      <div className="k-card" style={{ borderRadius: 20 }}>
        <div className="eyebrow" style={{ fontSize: 11 }}>{t.ach}</div>
        <div className="badges">
          {t.badges.map((label, i) => (
            <div key={label}>
              <div className={`b ${data.badges[i] ? "on" : ""}`} aria-hidden="true">{icons[i]}</div>
              <span>
                {label}
                <span className="sr">{data.badges[i] ? " ✓" : ""}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="menu">
        <div>
          <span>{t.lang}</span>
          <LangToggle lang={lang} small label={t.lang} onChange={(l) => { setLang(l); router.refresh(); }} />
        </div>
        <Link href="/plans">
          <span>{t.plan}</span>
          <span className="green" style={{ fontWeight: 700 }}>{TIER_NAME[data.tier]} →</span>
        </Link>
        <div>
          <span>{t.bank}</span>
          <span className="muted">{t.soon}</span>
        </div>
        <button type="button" onClick={logout} disabled={out} style={{ color: "var(--k-muted)" }}>
          {t.logout}
        </button>
      </div>
      <nav aria-label="Документы" style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", fontSize: 12.5, paddingTop: 6 }}>
        <Link href="/terms" style={{ color: "var(--k-dim)" }}>{t.legal.terms}</Link>
        <Link href="/privacy" style={{ color: "var(--k-dim)" }}>{t.legal.privacy}</Link>
        <Link href="/offer" style={{ color: "var(--k-dim)" }}>{t.legal.offer}</Link>
        <Link href="/rules" style={{ color: "var(--k-dim)" }}>{t.legal.rules}</Link>
      </nav>
    </div>
  );
}
