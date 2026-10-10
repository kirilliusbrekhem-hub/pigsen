"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { dictFor, IDEA_KEY, rub, type Lang } from "@/lib/kapital/i18n";
import { Brand, Ico } from "./Art";
import { LangToggle } from "./LangToggle";

interface Draft {
  name: string;
  typeLabel: string;
  niche: string;
  target: number;
  monthly: number;
}


/** Home («Опиши свой бизнес») → Generating. On success the business exists and «Открыть» leads to the reveal. */
export function DescribeFlow({ lang: initialLang, initial }: { lang: Lang; initial: string }) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = dictFor(lang);
  const [idea, setIdea] = useState("");
  const [stage, setStage] = useState<"describe" | "gen">("describe");
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(IDEA_KEY);
      if (saved) {
        sessionStorage.removeItem(IDEA_KEY);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate of the idea typed on the landing
        setIdea(saved.slice(0, 300));
      }
    } catch {}
  }, []);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const v = idea.trim();
    if (v.replace(/[^\p{L}\p{N}]/gu, "").length < 3) {
      setHint(t.ideaShort);
      inputRef.current?.focus();
      return;
    }
    setHint(null);
    setStage("gen");
  }

  if (stage === "gen") return <Generating lang={lang} idea={idea.trim()} onBack={() => setStage("describe")} onDone={(s) => router.push(`/business/reveal?s=${s}`)} />;

  return (
    <div className="kp-home">
      <div className="bar">
        <Brand href="/new" pill />
        <Link href="/me" aria-label={t.profile} className="k-round" style={{ background: "var(--k-s2)" }}>
          {initial}
        </Link>
      </div>
      <div className="body">
        <div className="bizcol">
          <button type="button" className="add" aria-label={t.newBiz} onClick={() => inputRef.current?.focus()}>+</button>
        </div>
        <div className="ttl">
          <h1>
            {t.h1}
            <br />
            <em>{t.h2}</em>
          </h1>
          <p>{t.sub}</p>
          <svg className="bob" width="30" height="36" viewBox="0 0 34 40" aria-hidden="true" style={{ marginTop: 16 }}>
            <path d="M7 6l10 10 10-10M7 17l10 10 10-10M7 28l10 10 10-10" stroke="#85BB65" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <form className="composer" onSubmit={submit} noValidate>
        <div className="k-chips" aria-label={t.examples}>
          {t.chips.map((c) => (
            <button key={c} type="button" className="k-chip" onClick={() => { setIdea(c); setHint(null); inputRef.current?.focus(); }}>
              {c}
            </button>
          ))}
        </div>
        <label className="input">
          <span className="sr">{t.ideaLabel}</span>
          <input ref={inputRef} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder={t.ph} maxLength={300} autoComplete="off" aria-invalid={!!hint} aria-describedby={hint ? "idea-hint" : undefined} />
          <button type="submit" className="k-send" aria-label={t.send}>
            <Ico name="up" color="#06120B" />
          </button>
        </label>
        {hint && (
          <div id="idea-hint" className="k-err" role="alert">
            {hint}
          </div>
        )}
      </form>
      <div className="foot">
        <Link href="/plans" className="pro">Pro</Link>
        <LangToggle lang={lang} label={t.lang} onChange={(l) => { setLang(l); router.refresh(); }} />
      </div>
    </div>
  );
}

function Generating({ lang, idea, onBack, onDone }: { lang: Lang; idea: string; onBack: () => void; onDone: (secs: number) => void }) {
  const t = dictFor(lang);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const started = useRef(0);
  const sent = useRef(false);

  useEffect(() => {
    started.current = Date.now();
    const tick = window.setInterval(() => setSecs(Math.floor((Date.now() - started.current) / 1000)), 250);
    const stepper = window.setInterval(() => setStep((s) => Math.min(4, s + 1)), 800);
    if (!sent.current) {
      sent.current = true;
      api<{ draft: Draft }>("/api/kapital/generate", { method: "POST", body: { idea, lang } })
        .then((r) => setDraft(r.draft))
        .catch((e) => setError(errorMessage(e)));
    }
    return () => {
      window.clearInterval(tick);
      window.clearInterval(stepper);
    };
  }, [idea, lang]);

  const ready = !!draft && step >= 4;
  const shown = ready ? 5 : step;
  const frozen = useRef<number | null>(null);
  if (ready && frozen.current === null) frozen.current = Math.max(1, secs);
  const elapsed = frozen.current ?? Math.max(1, secs);
  const values = draft ? [draft.typeLabel, draft.niche, rub(draft.target, lang), t.steps3, `«${draft.name}»`] : [];

  return (
    <div className="kp-screen full kp-gen" style={{ gap: 0 }}>
      <button type="button" className="k-round" aria-label={t.back} onClick={onBack}>
        <Ico name="back" />
      </button>
      <div className="ring">
        <svg className={ready ? "" : "spin-6"} width="150" height="150" viewBox="0 0 100 100" aria-hidden="true">
          <g fill="none" stroke="#85BB65">
            <circle cx="50" cy="50" r="46" strokeWidth=".6" strokeDasharray="2 3" />
            <circle cx="50" cy="50" r="38" strokeWidth="1.2" strokeDasharray={ready ? "240 0" : "60 180"} />
            <path d="M50 8C64 26 76 38 92 50C76 62 64 74 50 92C36 74 24 62 8 50C24 38 36 26 50 8z" strokeWidth=".5" opacity=".6" />
          </g>
        </svg>
        <div className="sec" aria-live="polite">
          {elapsed}
          <span>{t.sec}</span>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 14 }}>
        <div style={{ fontSize: 13, color: "var(--k-muted)" }}>{t.yourIdea}</div>
        <div style={{ marginTop: 4, fontSize: 18, fontWeight: 600, overflowWrap: "anywhere" }}>«{idea}»</div>
      </div>
      <ol style={{ listStyle: "none", padding: 0, margin: "22px 0 0", display: "flex", flexDirection: "column", gap: 8 }} aria-live="polite">
        {t.genSteps.map((label, i) => {
          const done = shown > i && (!!draft || i < 4) && !error;
          const active = !done && shown === i && !error;
          return (
            <li key={label} className="step fade">
              <span className={`mk ${done ? "done" : active ? "active" : "wait"}`}>{done && <Ico name="check" size={12} color="#06120B" />}</span>
              <span className="lbl">{label}</span>
              <span className="val">{done ? (values[i] ?? "") : ""}</span>
            </li>
          );
        })}
      </ol>
      <div style={{ marginTop: "auto", paddingTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        {error ? (
          <>
            <div className="k-err" role="alert">{error}</div>
            <button type="button" className="k-btn ghost" onClick={onBack}>{t.tryAgain}</button>
          </>
        ) : ready ? (
          <button type="button" className="k-btn fade" onClick={() => onDone(elapsed)}>
            {t.openBiz}
          </button>
        ) : (
          <div style={{ textAlign: "center", color: "var(--k-dim)", fontSize: 14 }}>{t.capThinking}</div>
        )}
      </div>
    </div>
  );
}
