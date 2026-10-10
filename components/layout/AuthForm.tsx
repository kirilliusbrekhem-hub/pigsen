"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LangToggle } from "@/components/kapital/LangToggle";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { dictFor, isLang, LANG_COOKIE, type Lang } from "@/lib/kapital/i18n";

type Mode = "login" | "register";

function safeNext(raw: string | null, fallback: string): string {
  // Same-origin paths only: "//host" and "/\\host" would leave the site.
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : fallback;
}

/** Email + password sign-up and log-in (Kapital design). Validation is repeated on the server. */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [lang, setLang] = useState<Lang>("ru");
  const t = dictFor(lang);
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accept, setAccept] = useState(false);
  const rawRef = mode === "register" ? params.get("ref") : null;
  const ref = rawRef && /^[a-z0-9]{10,40}$/i.test(rawRef) ? rawRef : null;

  useEffect(() => {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]+)`));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prerendered in RU; switch after mount
    if (m && isLang(m[1]) && m[1] !== "ru") setLang(m[1]);
  }, []);

  // Remember the inviter for 30 days, so the bonus survives leaving and coming back later.
  useEffect(() => {
    if (ref) document.cookie = `pigsen_ref=${encodeURIComponent(ref)}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax`;
  }, [ref]);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    const ru = lang === "ru";
    if (mode === "register" && values.name.trim().length < 2) e.name = ru ? "Минимум 2 символа" : "At least 2 characters";
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) e.email = ru ? "Некорректный email" : "Invalid email";
    if (mode === "register" && !accept) e.accept = ru ? "Подтвердите возраст и согласие с правилами" : "Confirm your age and consent";
    if (mode === "register" ? values.password.length < 8 : !values.password) e.password = mode === "register" ? (ru ? "Минимум 8 символов" : "At least 8 characters") : ru ? "Введите пароль" : "Enter your password";
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      await api(`/api/auth/${mode}`, { method: "POST", body: mode === "register" ? { ...values, accept, ...(ref ? { ref } : {}) } : { email: values.email, password: values.password } });
      router.replace(safeNext(params.get("next"), mode === "register" ? "/new" : "/business"));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.details) setErrors(err.details);
      setFormError(errorMessage(err));
      setLoading(false);
    }
  }

  const field = (key: keyof typeof values, label: string, type: string, autoComplete: string, hint?: string) => (
    <div className={`field ${errors[key] ? "err" : ""}`}>
      <label htmlFor={`f-${key}`}>{label}</label>
      <input
        id={`f-${key}`}
        type={type}
        autoComplete={autoComplete}
        value={values[key]}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={`h-${key}`}
      />
      {(errors[key] || hint) && (
        <span className="hint" id={`h-${key}`}>
          {errors[key] ?? hint}
        </span>
      )}
    </div>
  );

  return (
    <>
      <form className="card fade" onSubmit={onSubmit} noValidate>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span className="eyebrow">{mode === "register" ? (lang === "ru" ? "Регистрация" : "Sign up") : lang === "ru" ? "Вход" : "Log in"}</span>
          <LangToggle lang={lang} small label={t.lang} onChange={setLang} />
        </div>
        <div>
          <h1>{mode === "register" ? t.regTitle : t.loginTitle}</h1>
          <p className="lead" style={{ marginTop: 8 }}>{mode === "register" ? t.regSub : t.loginSub}</p>
        </div>
        {ref && <p className="k-ok">{lang === "ru" ? "Тебя пригласил друг: после регистрации получишь 200 PigCoin$." : "A friend invited you: you get 200 PigCoin$ after sign-up."}</p>}
        {formError && (
          <div className="k-err" role="alert">
            {formError}
          </div>
        )}
        {mode === "register" && field("name", t.name, "text", "name")}
        {field("email", t.email, "email", "email")}
        {field("password", t.password, "password", mode === "register" ? "new-password" : "current-password", mode === "register" ? t.pwHint : undefined)}
        {mode === "register" && (
          <div className="field">
            <label className="consent" style={{ fontWeight: 400, color: "var(--k-muted)" }}>
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} aria-invalid={Boolean(errors.accept)} />
              <span>
                {lang === "ru" ? (
                  <>
                    Мне есть 18 лет, я принимаю <Link href="/terms" target="_blank">Условия</Link> и <Link href="/privacy" target="_blank">Политику конфиденциальности</Link> и даю согласие на обработку персональных данных.
                  </>
                ) : (
                  <>
                    I am 18 or older, I accept the <Link href="/terms" target="_blank">Terms</Link> and the <Link href="/privacy" target="_blank">Privacy Policy</Link> and consent to the processing of my personal data.
                  </>
                )}
              </span>
            </label>
            {errors.accept && <span className="hint" style={{ color: "#F2A99A" }}>{errors.accept}</span>}
          </div>
        )}
        <button className="k-btn" type="submit" disabled={loading} aria-busy={loading}>
          {loading ? <span className="k-spin" /> : mode === "register" ? t.register : t.login}
        </button>
        <p className="switch">
          {mode === "register" ? (
            <>
              {t.haveAccount} <Link href={`/login${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}>{t.login}</Link>
            </>
          ) : (
            <>
              {t.noAccount} <Link href={`/register${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}>{t.createAccount}</Link>
            </>
          )}
        </p>
      </form>
      <nav className="legal" aria-label="Документы">
        <Link href="/terms">{t.legal.terms}</Link>
        <Link href="/privacy">{t.legal.privacy}</Link>
        <Link href="/offer">{t.legal.offer}</Link>
        <Link href="/rules">{t.legal.rules}</Link>
      </nav>
    </>
  );
}
