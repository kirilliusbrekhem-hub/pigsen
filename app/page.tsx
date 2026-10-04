import Link from "next/link";
import { Pig, Wordmark } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";
import { Orb } from "@/components/ui/Orb";

const PILLARS = [
  { icon: "sparkle", title: "$PIG — ваш AI-наставник", text: "Задавайте вопросы обычным языком: от венчура до юнит-экономики. Ответы структурированы и ведут к материалам." },
  { icon: "cap", title: "Обучение с прогрессом", text: "Короткие курсы и уроки по предпринимательству, финансам, инвестициям и AI. Отмечайте пройденное и видьте рост." },
  { icon: "compass", title: "Персональная библиотека", text: "Статьи, книги, видео и подкасты, подобранные под ваши интересы. Сохраняйте лучшее в один клик." },
];

export default function Landing() {
  return (
    <div className="landing">
      <header>
        <div className="brand">
          <Pig />
          <Wordmark />
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn btn-ghost" href="/login">
            Войти
          </Link>
          <Link className="btn btn-primary" href="/register">
            Начать
          </Link>
        </div>
      </header>
      <section className="hero fade-in">
        <Pig />
        <span className="label">AI + Business Education + Personalization</span>
        <h1>
          Make your money <em>Smarter.</em>
        </h1>
        <p>PIGSEN помогает разобраться в бизнесе, предпринимательстве, рынках и технологиях. Учитесь с AI, собирайте свою библиотеку знаний и формируйте финансовое мышление.</p>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link className="btn btn-primary btn-lg" href="/register">
            Создать аккаунт <Icon name="arrow" size="sm" />
          </Link>
          <Link className="btn btn-secondary btn-lg" href="/login">
            У меня есть аккаунт
          </Link>
        </div>
      </section>
      <section className="pillars">
        {PILLARS.map((p) => (
          <div key={p.title} className="card">
            <span className="opp-icon">{p.icon === "sparkle" ? <Orb /> : <Icon name={p.icon} />}</span>
            <b style={{ fontWeight: 560, fontSize: 15.5 }}>{p.title}</b>
            <p className="muted" style={{ fontSize: 13.5 }}>
              {p.text}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
