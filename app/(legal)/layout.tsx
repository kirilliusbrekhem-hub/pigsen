// Шаблон юридического документа. Подлежит проверке юристом перед публикацией в окончательной редакции.
import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, transparent)", color: "inherit" }}>
      <main className="legal">
        <Link href="/" style={{ fontWeight: 800, fontSize: 18, textDecoration: "none", color: "inherit" }}>
          Kapital
        </Link>
        <nav className="legal-nav" aria-label="Юридические документы">
          <Link href="/terms">Условия использования</Link>
          <Link href="/privacy">Конфиденциальность</Link>
          <Link href="/offer">Pro, оплата и возвраты</Link>
          <Link href="/rules">Правила</Link>
        </nav>
        {children}
      </main>
    </div>
  );
}
