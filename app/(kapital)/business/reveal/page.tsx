import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Guilloche, Seal } from "@/components/kapital/Art";
import { requireUser } from "@/lib/auth/session";
import { dictFor, monthYear, rub } from "@/lib/kapital/i18n";
import { getLang } from "@/lib/kapital/lang";
import { kapitalView } from "@/lib/kapital/service";

export const metadata: Metadata = { title: "Бизнес готов" };

export default async function RevealPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const [user, lang, sp] = await Promise.all([requireUser(), getLang(), searchParams]);
  const v = await kapitalView(user, { simulate: false });
  if (!v) redirect("/new");
  const t = dictFor(lang);
  const secs = Math.min(600, Math.max(1, Number.parseInt(sp.s ?? "", 10) || 0));
  const b = v.biz;
  // The reveal shows the solo pace (the suggested monthly saving), as promised on the card.
  const launch = (() => {
    const left = Math.max(0, b.target - b.capital);
    if (!b.monthly) return null;
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + Math.ceil(left / b.monthly));
    return d.toISOString();
  })();
  return (
    <div className="kp-screen full" style={{ gap: 14 }}>
      <div className="eyebrow" style={{ textAlign: "center", letterSpacing: ".24em", paddingTop: 8 }}>
        {sp.s ? t.createdIn(secs) : b.typeLabel}
      </div>
      <div className="note rise">
        <Guilloche width={420} height={260} style={{ right: -60, top: -30, opacity: 0.35 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="eyebrow ink" style={{ fontSize: 11, letterSpacing: ".18em" }}>
            {b.typeLabel} · № {b.serial}
          </div>
          <Seal size={40} variant="ink" />
        </div>
        <h1 className="num" style={{ fontSize: 46, lineHeight: 1, marginTop: 8, overflowWrap: "anywhere" }}>{b.name}</h1>
        <p style={{ fontSize: 15, marginTop: 8, lineHeight: 1.35, maxWidth: 280 }}>{b.pitch}</p>
        <div className="rule" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 18, paddingTop: 14 }}>
          <div>
            <div className="soft" style={{ fontSize: 12 }}>{t.needLaunch}</div>
            <div className="num" style={{ fontSize: 24 }}>{rub(b.target, lang)}</div>
          </div>
          <div>
            <div className="soft" style={{ fontSize: 12 }}>{t.launchAt(rub(b.monthly, lang))}</div>
            <div className="num" style={{ fontSize: 24 }}>{monthYear(launch, lang)}</div>
          </div>
        </div>
      </div>
      {b.plan.length > 0 && (
        <div className="k-card f2" style={{ borderRadius: 20 }}>
          <div className="eyebrow" style={{ letterSpacing: ".14em" }}>{t.planFromCap}</div>
          <ol style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
            {b.plan.map((s, i) => (
              <li key={i} style={{ display: "flex", gap: 12 }}>
                <span className="serif green" style={{ width: 18, flex: "none" }}>{i + 1}</span>
                <span style={{ fontSize: 14, lineHeight: 1.4 }}>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="k-card f3" style={{ display: "flex", gap: 12, alignItems: "center", borderRadius: 20, padding: "14px 16px" }}>
        <span className="cap-av" style={{ width: 40, height: 40, borderRadius: 12, fontSize: 16 }}>C</span>
        <span style={{ fontSize: 14, lineHeight: 1.4, color: "var(--k-ink-2)" }}>
          {t.revealCap} <b style={{ color: "var(--k-ink)" }}>CAP</b>
        </span>
      </div>
      <Link href="/business/save?first=1" className="k-btn f3" style={{ marginTop: "auto" }}>
        {t.firstDeposit}
      </Link>
    </div>
  );
}
