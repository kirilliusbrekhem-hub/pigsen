import Link from "next/link";
import { Pig, Wordmark } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <aside className="auth-art">
        <div className="brand">
          <Pig />
          <Wordmark />
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <h2>
            Make your money <em>Smarter.</em>
          </h2>
          <p>Бизнес, предпринимательство, финансы и технологии. С AI-наставником $PIG, который объясняет сложное простыми словами.</p>
        </div>
        <div className="ticks">
          <span><Icon name="check" />Вопросы к $PIG обычным языком</span>
          <span><Icon name="check" />Курсы с прогрессом и сохранениями</span>
          <span><Icon name="check" />Рекомендации под ваши интересы</span>
        </div>
      </aside>
      <main className="auth-form">
        {children}
        <nav className="site-legal" aria-label="Документы" style={{ justifyContent: "center", marginTop: 16 }}>
          <Link href="/terms">Условия</Link>
          <Link href="/privacy">Конфиденциальность</Link>
          <Link href="/offer">Оплата и возвраты</Link>
          <Link href="/rules">Правила</Link>
        </nav>
      </main>
    </div>
  );
}
