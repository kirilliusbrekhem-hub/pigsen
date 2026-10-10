"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { dictFor, isLang, LANG_COOKIE, type Lang } from "@/lib/kapital/i18n";
import { Brand, Guilloche, Ico, Rosette, Seal } from "./Art";
import { IDEA_KEY } from "@/lib/kapital/i18n";
import { LangToggle } from "./LangToggle";

function cookieLang(): Lang {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]+)`));
  return m && isLang(m[1]) ? m[1] : "ru";
}

/** Public landing: phone = the welcome screen, desktop = describe-your-business hero. Prerendered; language from cookie. */
export function Landing({ prices }: { prices: { pro: number; pro10: number } }) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("ru");
  const [idea, setIdea] = useState("");
  const t = dictFor(lang);
  useEffect(() => {
    const l = cookieLang();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the page is prerendered in RU; switch after mount
    if (l !== "ru") setLang(l);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function start(e?: React.FormEvent) {
    e?.preventDefault();
    const v = idea.trim();
    try {
      if (v) sessionStorage.setItem(IDEA_KEY, v.slice(0, 300));
    } catch {}
    router.push("/register?next=/new");
  }

  const toggle = <LangToggle lang={lang} small label={t.lang} onChange={setLang} />;

  return (
    <div className="kp kp-land">
      {/* phone: welcome */}
      <section className="welcome" aria-label="Kapital">
        <Rosette size={620} style={{ top: -120, left: -115 }} />
        <div className="lang">{toggle}</div>
        <div className="center">
          <Seal size={104} variant="hero" className="f1" />
          <h1 className="word f2">Kapital</h1>
          <div className="slogan f2">{t.slogan}</div>
          <p className="f3">{t.welcome}</p>
        </div>
        <div className="actions f3">
          <Link href="/register" className="k-btn">{t.startFree}</Link>
          <Link href="/login" className="k-btn ghost">{t.loginEmail}</Link>
          <div className="note-s">{t.moneyStays}</div>
        </div>
      </section>

      {/* desktop: hero */}
      <div className="desk" style={{ position: "relative", overflow: "hidden" }}>
        <Rosette size={900} stroke="#1F3D29" opacity={0.45} style={{ top: -300, right: -260 }} />
        <div className="wrap">
          <header className="nav">
            <Brand href="/" size={40} />
            <div className="links">
              <a href="#how">{t.navHow}</a>
              <a href="#plans">{t.navPlans}</a>
              {toggle}
              <Link href="/login" className="k-btn ghost sm" style={{ height: 44, borderRadius: 999, borderColor: "var(--k-line2)" }}>{t.login}</Link>
            </div>
          </header>
          <section className="hero">
            <div className="l">
              <div className="eyebrow" style={{ fontSize: 13, letterSpacing: ".24em" }}>{t.slogan}</div>
              <h1>
                {t.h1} <em className="green">{t.h2}</em>
              </h1>
              <p className="lead">{t.subLong}</p>
              <form className="kp-describe" onSubmit={start}>
                <label htmlFor="land-idea" className="sr">{t.ideaLabel}</label>
                <input id="land-idea" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder={t.ph} maxLength={300} autoComplete="off" />
                <button type="submit" className="go" aria-label={t.send}>
                  <Ico name="right" size={20} color="#06120B" />
                </button>
              </form>
              <div className="k-chips" style={{ marginTop: 14 }} aria-label={t.examples}>
                {t.chips.map((c) => (
                  <button key={c} type="button" className="k-chip" style={{ fontSize: 14, minHeight: 38, padding: "6px 16px" }} onClick={() => setIdea(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="r" aria-hidden="true">
              <div className="note">
                <Guilloche width={520} height={300} waves={4} style={{ right: -80, top: -30, opacity: 0.32 }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="eyebrow ink" style={{ letterSpacing: ".18em" }}>IT · № 000 417</span>
                  <span className="num" style={{ fontSize: 22 }}>A−</span>
                </div>
                <div className="num" style={{ fontSize: 58, lineHeight: 1, marginTop: 14 }}>{lang === "en" ? "Pulse" : "Пульс"}</div>
                <div style={{ fontSize: 16, marginTop: 8 }}>{lang === "en" ? "A Telegram bot for booking beauty pros" : "Telegram-бот для записи к мастерам"}</div>
                <div style={{ marginTop: 22 }}>
                  <div className="bar"><i style={{ width: "14%" }} /></div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 14, gap: 10, flexWrap: "wrap" }}>
                  <span>
                    <b className="num" style={{ fontSize: 22 }}>35 000 ₽</b> {t.of} 250 000
                  </span>
                  <span>{lang === "en" ? "Launch · July 2027" : "Запуск · июль 2027"}</span>
                </div>
              </div>
              <div className="capq">
                <b className="green">CAP:</b> {t.capQuote}
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="wrap">
        <section id="how" className="feats" aria-label={t.navHow}>
          {t.feats.map(([n, title, d]) => (
            <div key={n} className="feat">
              <div className="n">{n}</div>
              <b>{title}</b>
              <p>{d}</p>
            </div>
          ))}
        </section>
        <section id="plans" className="plans" aria-label={t.navPlans}>
          <div>
            <h2 className="serif" style={{ fontSize: 28 }}>{t.plansTitle}</h2>
            <div className="muted" style={{ marginTop: 4 }}>{t.plansSub}</div>
          </div>
          <div className="row">
            <div>
              <div className="muted" style={{ fontSize: 13 }}>Free</div>
              <div className="serif">0 ★</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 13 }}>Pro · 4</div>
              <div className="serif green">{prices.pro} ★</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 13 }}>Pro · 10</div>
              <div className="serif green">{prices.pro10} ★</div>
            </div>
          </div>
          <Link href="/register" className="k-btn sm" style={{ height: 52, padding: "0 26px" }}>{t.startFree}</Link>
        </section>
        <nav className="legal" aria-label="Документы">
          <Link href="/terms">{t.legal.terms}</Link>
          <Link href="/privacy">{t.legal.privacy}</Link>
          <Link href="/offer">{t.legal.offer}</Link>
          <Link href="/rules">{t.legal.rules}</Link>
        </nav>
      </div>
    </div>
  );
}
