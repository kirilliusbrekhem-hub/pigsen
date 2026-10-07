"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorBox } from "@/components/ui/States";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";

type Mode = "login" | "register";

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accept, setAccept] = useState(false);
  const rawRef = mode === "register" ? params.get("ref") : null;
  const ref = rawRef && /^[a-z0-9]{10,40}$/i.test(rawRef) ? rawRef : null;

  // Remember the inviter for 30 days, so the bonus survives leaving and coming back later.
  useEffect(() => {
    if (ref) document.cookie = `pigsen_ref=${encodeURIComponent(ref)}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax`;
  }, [ref]);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (mode === "register" && values.name.trim().length < 2) e.name = "Минимум 2 символа";
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) e.email = "Некорректный email";
    if (mode === "register" && !accept) e.accept = "Подтвердите возраст и согласие с правилами";
    if (mode === "register" ? values.password.length < 8 : !values.password) e.password = mode === "register" ? "Минимум 8 символов" : "Введите пароль";
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
      router.replace(mode === "register" ? "/onboarding" : safeNext(params.get("next")));
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
        className="input"
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
    <form className="auth-card fade-in" onSubmit={onSubmit} noValidate>
      <div className="stack" style={{ gap: 6 }}>
        <span className="label">{mode === "register" ? "Регистрация" : "Вход"}</span>
        <h1>{mode === "register" ? "Создайте аккаунт PIGSEN" : "С возвращением"}</h1>
      </div>
      {ref && <p className="growth-ref-note">Вас пригласил друг: после регистрации получите 200 PigCoin$.</p>}
      {formError && <ErrorBox message={formError} />}
      {mode === "register" && field("name", "Имя", "text", "name")}
      {field("email", "Email", "email", "email")}
      {field("password", "Пароль", "password", mode === "register" ? "new-password" : "current-password", mode === "register" ? "Не меньше 8 символов." : undefined)}
      {mode === "register" && (
        <div className="field">
          <label className="consent">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} aria-invalid={Boolean(errors.accept)} />
            <span>
              Мне есть 18 лет, я принимаю <Link href="/terms" target="_blank">Условия</Link> и <Link href="/privacy" target="_blank">Политику конфиденциальности</Link> и даю согласие на обработку персональных данных.
            </span>
          </label>
          {errors.accept && <span className="hint">{errors.accept}</span>}
        </div>
      )}
      <Button variant="primary" size="lg" block loading={loading} type="submit">
        {mode === "register" ? "Зарегистрироваться" : "Войти"}
      </Button>
      <p className="switch">
        {mode === "register" ? (
          <>
            Уже есть аккаунт? <Link href="/login">Войти</Link>
          </>
        ) : (
          <>
            Впервые в PIGSEN? <Link href="/register">Создать аккаунт</Link>
          </>
        )}
      </p>
    </form>
  );
}
