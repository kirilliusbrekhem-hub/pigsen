import type { Metadata } from "next";
import Link from "next/link";
import { Pig, Wordmark } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";
import { Orb } from "@/components/ui/Orb";
import { HeroVideo } from "@/components/landing/HeroVideo";
import { ADVANTAGES, COMPARE, FAQ, PROOF, type Cell } from "@/components/landing/data";
import { LIMITS, PLANS } from "@/lib/billing/plan";

export const metadata: Metadata = {
  title: { absolute: "PIGSEN — Make your money Smarter." },
  description: "AI-наставник $PIG, короткие курсы с квизами, копилка, челленджи и комьюнити. Разберитесь в деньгах, бизнесе и технологиях — бесплатно.",
  openGraph: { title: "PIGSEN — Make your money Smarter.", description: "Учитесь финансам и бизнесу с AI-наставником $PIG. Бесплатный старт.", locale: "ru_RU", type: "website" },
};

// Logged-in visitors are redirected to /dashboard by proxy.ts.

const NAV = [
  { href: "#features", label: "Возможности" },
  { href: "#compare", label: "Сравнение" },
  { href: "#pricing", label: "Pro" },
  { href: "#faq", label: "FAQ" },
];

const free = LIMITS.free;
const FREE_FEATURES = [
  "Все бесплатные курсы, уроки и библиотека",
  `${free.chat} вопросов $PIG и ${free.quiz} квизов в день`,
  `${free.goals} цели в копилке, ${free.coach} совет коуча в день`,
  "3 офлайн-челленджа, комьюнити, PigCoin$",
];
const PRO_FEATURES = [
  "Эксклюзивные курсы: финплан, инвестиции, запуск бизнеса",
  "Безлимитный $PIG, коуч и разбор бизнес-идей",
  `До ${LIMITS.pro.quiz} квизов в день и сколько угодно целей`,
  "x2 PigCoin$, защита серии, все челленджи",
  "Закрытое комьюнити и скидка 50% в магазине",
];

const CELL: Record<Cell, { icon: string; text: string }> = {
  yes: { icon: "check", text: "Есть" },
  part: { icon: "dots", text: "Частично" },
  no: { icon: "close", text: "Нет" },
};

function Mark({ v }: { v: Cell }) {
  return (
    <span className={`lp-mark is-${v}`} title={CELL[v].text}>
      <Icon name={CELL[v].icon} size="sm" />
      <span className="visually-hidden">{CELL[v].text}</span>
    </span>
  );
}

function SectionHead({ label, title, text }: { label: string; title: React.ReactNode; text?: string }) {
  return (
    <div className="lp-head">
      <span className="label">{label}</span>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="lp">
      <a className="lp-skip" href="#main">
        К содержанию
      </a>
      <header className="lp-header">
        <div className="lp-wrap lp-header-in">
          <Link href="/" className="brand" aria-label="PIGSEN — на главную">
            <Pig />
            <Wordmark />
          </Link>
          <nav className="lp-nav" aria-label="Разделы">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="lp-header-cta">
            <Link className="btn btn-ghost" href="/login">
              Войти
            </Link>
            <Link className="btn btn-primary" href="/register">
              Начать
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="lp-hero">
          <div className="lp-glow" aria-hidden="true" />
          <div className="lp-grid-bg" aria-hidden="true" />
          <div className="lp-wrap lp-hero-in">
            <div className="lp-hero-copy">
              <span className="lp-pill">
                <Orb /> AI-наставник $PIG внутри
              </span>
              <h1>
                Деньги и бизнес — <span className="lp-hl">понятно</span> с первого урока
              </h1>
              <p className="lp-lead">Короткие уроки с квизами, AI-наставник $PIG, копилка для целей и задания в реальной жизни. 10 минут в день — и вы уверенно разбираетесь в финансах.</p>
              <div className="lp-cta-row">
                <Link className="btn btn-accent btn-lg" href="/register">
                  Создать аккаунт бесплатно <Icon name="arrow" size="sm" />
                </Link>
                <a className="btn btn-secondary btn-lg" href="#demo">
                  <Icon name="play" size="sm" /> Смотреть демо
                </a>
              </div>
              <ul className="lp-ticks">
                <li>
                  <Icon name="check" size="sm" /> Бесплатный старт
                </li>
                <li>
                  <Icon name="check" size="sm" /> Без карты
                </li>
                <li>
                  <Icon name="check" size="sm" /> С нуля, без терминов
                </li>
              </ul>
            </div>

            <div className="lp-stage" id="demo">
              <div className="lp-device">
                <div className="lp-device-bar" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <span>pigsen.app</span>
                </div>
                <HeroVideo />
              </div>
              <div className="lp-float lp-float-a" aria-hidden="true">
                <Icon name="coin" size="sm" /> +15 PigCoin$
              </div>
              <div className="lp-float lp-float-b" aria-hidden="true">
                <Orb /> «Начни с подушки: 3 расхода в месяц»
              </div>
            </div>

            <dl className="lp-proof">
              {PROOF.map((p) => (
                <div key={p.label}>
                  <dt>{p.label}</dt>
                  <dd>{p.value}</dd>
                </div>
              ))}
              <div>
                <dt>чтобы начать</dt>
                <dd>0 ₽</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="lp-sec" id="features">
          <div className="lp-wrap">
            <SectionHead label="Возможности" title="Знания, практика и мотивация — в одном месте" text="Не ещё один курс, который бросаешь на третьем уроке." />
            <div className="lp-bento">
              {ADVANTAGES.map((a, i) => (
                <div key={a.title} className={`lp-card${i === 0 ? " is-main" : ""}`}>
                  <span className="lp-ic">{a.icon === "sparkle" ? <Orb /> : <Icon name={a.icon} />}</span>
                  <b>{a.title}</b>
                  <p>{a.text}</p>
                  {i === 0 && (
                    <div className="lp-chat" aria-hidden="true">
                      <span className="lp-msg is-me">С чего начать, если зарплата 60 000?</span>
                      <span className="lp-msg">Сначала подушка: отложите 10% — 6 000 ₽ в месяц. Через полгода у вас будет запас на 3 месяца трат.</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-sec lp-sec-alt" id="compare">
          <div className="lp-wrap">
            <SectionHead label="Сравнение" title="Почему PIGSEN, а не…" text="Мы собрали в одном месте то, что обычно разбросано по курсам, роликам и приложениям." />
            <div className="lp-table-wrap" tabIndex={0} role="region" aria-label="Таблица сравнения">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="visually-hidden">Возможность</span>
                    </th>
                    <th scope="col" className="is-us">
                      PIGSEN
                    </th>
                    <th scope="col">Курсы</th>
                    <th scope="col">YouTube</th>
                    <th scope="col">Банки</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((r) => (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      <td className="is-us">
                        <Mark v={r.pigsen} />
                      </td>
                      <td>
                        <Mark v={r.courses} />
                      </td>
                      <td>
                        <Mark v={r.youtube} />
                      </td>
                      <td>
                        <Mark v={r.bank} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="lp-sec" id="pricing">
          <div className="lp-wrap">
            <SectionHead label="Тарифы" title="Начните бесплатно. Растите с Pro." text="Free хватает, чтобы учиться каждый день. Pro — когда хочется без ограничений." />
            <div className="lp-plans">
              <div className="lp-plan">
                <span className="label">Free</span>
                <div className="lp-price">
                  <b>0 ★</b>
                  <span>навсегда</span>
                </div>
                <ul>
                  {FREE_FEATURES.map((f) => (
                    <li key={f}>
                      <Icon name="check" size="sm" /> {f}
                    </li>
                  ))}
                </ul>
                <Link className="btn btn-secondary btn-lg btn-block" href="/register">
                  Попробовать бесплатно
                </Link>
              </div>
              <div className="lp-plan is-pro">
                <div className="lp-plan-top">
                  <span className="label">Pro</span>
                  <span className="lp-badge">Выгоднее на год</span>
                </div>
                <div className="lp-price">
                  <b>{PLANS.month.stars}★</b>
                  <span>в месяц</span>
                </div>
                <p className="lp-price-alt">
                  или <b>{PLANS.year.stars}★</b> в год — оплата через Telegram Stars
                </p>
                <ul>
                  {PRO_FEATURES.map((f) => (
                    <li key={f}>
                      <Icon name="check" size="sm" /> {f}
                    </li>
                  ))}
                </ul>
                <Link className="btn btn-accent btn-lg btn-block" href="/register">
                  Оформить Pro <Icon name="arrow" size="sm" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-sec lp-sec-alt" id="faq">
          <div className="lp-wrap lp-faq-wrap">
            <SectionHead label="FAQ" title="Частые вопросы" />
            <div className="lp-faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>
                    {f.q}
                    <Icon name="plus" size="sm" />
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-sec">
          <div className="lp-wrap">
            <div className="lp-final">
              <Pig />
              <h2>
                Make your money <em>Smarter.</em>
              </h2>
              <p>Первый урок займёт меньше 10 минут. $PIG уже ждёт ваш вопрос.</p>
              <div className="lp-cta-row">
                <Link className="btn btn-accent btn-lg" href="/register">
                  Создать аккаунт бесплатно <Icon name="arrow" size="sm" />
                </Link>
                <Link className="btn btn-lg lp-btn-ghost-dark" href="/login">
                  У меня есть аккаунт
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-footer-grid">
            <div className="lp-footer-brand">
              <div className="brand">
                <Pig />
                <Wordmark />
              </div>
              <p>AI + Business Education + Personalization. Make your money Smarter.</p>
            </div>
            <nav aria-label="Аккаунт">
              <b>Аккаунт</b>
              <Link href="/register">Регистрация</Link>
              <Link href="/login">Вход</Link>
            </nav>
            <nav aria-label="Документы">
              <b>Документы</b>
              <Link href="/terms">Условия использования</Link>
              <Link href="/privacy">Политика конфиденциальности</Link>
              <Link href="/offer">Оплата и возвраты</Link>
              <Link href="/rules">Правила</Link>
            </nav>
          </div>
          <div className="lp-disclaimer" role="note">
            <Icon name="alert" size="sm" />
            <p>
              PIGSEN — образовательная платформа. Материалы и ответы $PIG не являются индивидуальной инвестиционной, финансовой, налоговой или юридической рекомендацией. Инвестиции связаны с риском потери денег. $PIG — ИИ-помощник: он может ошибаться, проверяйте важные цифры. PigCoin$ — игровая валюта без денежной стоимости. Сервис для пользователей 18+.
            </p>
          </div>
          <p className="lp-copy">© {new Date().getFullYear()} PIGSEN</p>
        </div>
      </footer>
    </div>
  );
}
