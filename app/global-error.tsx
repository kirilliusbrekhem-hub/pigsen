"use client";
import { useEffect } from "react";

/** Last-resort boundary: replaces the root layout, so it carries its own html/body and inline styles. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="ru">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16, background: "#0C1114", color: "#ECEFEC", fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
        <main style={{ maxWidth: 420, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Pìg<b style={{ color: "#4CE0A2" }}>Biz</b>
          </div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Что-то пошло не так</h1>
          <p style={{ margin: 0, color: "#A3ADA9", lineHeight: 1.5 }}>Мы уже записали ошибку и разберёмся. Попробуйте обновить страницу.</p>
          {error.digest && <code style={{ fontSize: 12, color: "#6D7773" }}>код: {error.digest}</code>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button onClick={reset} style={{ border: 0, borderRadius: 12, padding: "12px 20px", background: "#12A06B", color: "#fff", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>Повторить</button>
            <a href="/" style={{ borderRadius: 12, padding: "12px 20px", color: "#ECEFEC", textDecoration: "none", boxShadow: "inset 0 0 0 1px #2A3337", fontSize: 15 }}>На главную</a>
          </div>
        </main>
      </body>
    </html>
  );
}
