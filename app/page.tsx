import type { Metadata } from "next";
import Link from "next/link";
import { Pig, Wordmark } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";
import { Orb } from "@/components/ui/Orb";
import { Reveal } from "@/components/landing/Reveal";
import { Showcase } from "@/components/landing/Showcase";
import { ADVANTAGES, COMPARE, FAQ, STATS, STEPS, type Cell } from "@/components/landing/data";
import { LIMITS, PLANS } from "@/lib/billing/plan";

export const metadata: Metadata = {
  title: { absolute: "PIGSEN — Make your money Smarter." },
  description: "AI-наставник $PIG, короткие курсы с квизами, копилка, челленджи и комьюнити. Разберитесь в деньгах, бизнесе и технологиях — бесплатно.",
  openGraph: { title: "PIGSEN — Make your money Smarter.", description: "Учитесь финансам и бизнесу с AI-наставником $PIG. Бесплатный старт.", locale: "ru_RU", type: "website" },
};

// Logged-in visitors are redirected to /dashboard by proxy.ts.

const NAV = [
  { href: "#features", label: "Возможности" },
  { href: "#how", label: "Как работает" },
  { href: "#compare", label: "Сравнение" },
  { href: "#pricing", label: "Pro" },
  { href: "#faq", label: "FAQ" },
];

const free = LIMITS.free;
const FREE_FEATURES = [
  "Все бесплатные курсы, уроки и библиотека",
  `${free.chat} вопросов $PIG в день`,
  `${free.quiz} квизов по урокам в день`,
  `${free.goals} цели в копилке`,
  `${free.coach} совет коуча и ${free.idea} разбор идеи в день`,
  "3 офлайн-челленджа, комьюнити, PigCoin$",
];
const PRO_FEATURES = [
  "Эксклюзивные курсы: финплан, инвестиции, запуск бизнеса",
  "Безлимитный $PIG, коуч и разбор идей",
  `До ${LIMITS.pro.quiz} квизов в день и сколько угодно целей`,
  "x2 PigCoin$ за всё и защита серии",
  "Все офлайн-челленджи и закрытое комьюнити",
  "Скидка 50% в магазине и золотой значок Pro",
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
    <div className="lp-head rv">
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
        {/* Hero */}
        <section className="lp-hero">
          <div className="lp-glow" aria-hidden="true" />
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy rv">
              <span className="lp-pill">
                <Orb /> AI-наставник $PIG внутри
              </span>
              <h1>
                Разберитесь в деньгах и бизнесе. <span>С AI, который всегда рядом.</span>
              </h1>
              <p className="lp-slogan">
                Make your money <em>Smarter.</em>
              </p>
              <p className="lp-lead">Короткие уроки с квизами, копилка для целей, офлайн-челленджи и комьюнити — всё в одном месте. Учитесь по 10 минут в день и получайте PigCoin$ за каждый шаг.</p>
              <div className="lp-cta-row">
                <Link className="btn btn-accent btn-lg" href="/register">
                  Создать аккаунт бесплатно <Icon name="arrow" size="sm" />
                </Link>
                <a className="btn btn-secondary btn-lg" href="#features">
                  <Icon name="play" size="sm" /> Посмотреть, как это работает
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
                  <Icon name="check" size="sm" /> На любом устройстве
                </li>
              </ul>
            </div>
            <div className="lp-device rv" id="demo">
              <div className="lp-device-bar" aria-hidden="true">
                <i />
                <i />
                <i />
                <span>pigsen.app/dashboard</span>
              </div>
              <video className="lp-video" autoPlay muted loop playsInline preload="metadata" poster="/landing/demo-poster.jpg" aria-label="Демо: как выглядит PIGSEN изнутри" width={1280} height={800}>
                <source src="/landing/demo.webm" type="video/webm" />
                <source src="/landing/demo.mp4" type="video/mp4" />
              </video>
              <div className="lp-float lp-float-a" aria-hidden="true">
                <Icon name="coin" size="sm" /> +15 PigCoin$
              </div>
              <div className="lp-float lp-float-b" aria-hidden="true">
                <Icon name="piggy" size="sm" /> Цель: 25% пройдено
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="lp-stats" aria-label="PIGSEN в цифрах">
          <div className="lp-wrap lp-stats-grid">
            {STATS.map((s) => (
              <div key={s.label} className="lp-stat rv">
                <b>{s.value}</b>
                <span>{s.label}</span>
                <small>{s.hint}</small>
              </div>
            ))}
          </div>
        </section>

        {/* Advantages */}
        <section className="lp-sec" id="features">
          <div className="lp-wrap">
            <SectionHead label="Возможности" title={<>Всё, чтобы деньги стали понятнее</>} text="Не ещё один курс, который бросаешь на третьем уроке. PIGSEN соединяет знания, практику и мотивацию." />
            <div className="lp-adv">
              {ADVANTAGES.map((a) => (
                <div key={a.title} className="lp-adv-card rv">
                  <span className="lp-ic">{a.icon === "sparkle" ? <Orb /> : <Icon name={a.icon} />}</span>
                  <b>{a.title}</b>
                  <p>{a.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Showcase */}
        <section className="lp-sec lp-sec-alt" aria-labelledby="tour-title">
          <div className="lp-wrap">
            <div className="lp-head rv">
              <span className="label">Внутри PIGSEN</span>
              <h2 id="tour-title">Посмотрите на реальный интерфейс</h2>
              <p>Это не макеты — скриншоты настоящего приложения.</p>
            </div>
            <div className="rv">
              <Showcase />
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="lp-sec" id="compare">
          <div className="lp-wrap">
            <SectionHead label="Сравнение" title="Почему PIGSEN, а не…" text="Каждый вариант по-своему хорош. Мы собрали в одном месте то, что обычно разбросано." />
            <div className="lp-table-wrap rv" tabIndex={0} role="region" aria-label="Таблица сравнения">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="visually-hidden">Возможность</span>
                    </th>
                    <th scope="col" className="is-us">
                      PIGSEN
                    </th>
                    <th scope="col">Обычные курсы</th>
                    <th scope="col">YouTube</th>
                    <th scope="col">Банковские приложения</th>
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

        {/* How it works */}
        <section className="lp-sec lp-dark" id="how">
          <div className="lp-wrap">
            <SectionHead label="Как работает" title="Три шага до первых результатов" />
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rv">
                  <span className="lp-step-n">0{i + 1}</span>
                  <span className="lp-ic">
                    <Icon name={s.icon} />
                  </span>
                  <b>{s.title}</b>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section className="lp-sec" id="pricing">
          <div className="lp-wrap">
            <SectionHead label="Тарифы" title="Начните бесплатно. Растите с Pro." text="Free хватает, чтобы учиться каждый день. Pro — когда хочется без ограничений." />
            <div className="lp-plans">
              <div className="lp-plan rv">
                <span className="label">Free</span>
                <div className="lp-price">
                  <b>0 ⭐</b>
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
              <div className="lp-plan is-pro rv">
                <div className="lp-plan-top">
                  <span className="label">Pro</span>
                  <span className="lp-badge">Выгоднее на год</span>
                </div>
                <div className="lp-price">
                  <b>{PLANS.month.stars}⭐</b>
                  <span>в месяц</span>
                </div>
                <p className="lp-price-alt">
                  или <b>{PLANS.year.stars}⭐</b> в год — оплата через Telegram Stars
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

        {/* FAQ */}
        <section className="lp-sec lp-sec-alt" id="faq">
          <div className="lp-wrap lp-faq-wrap">
            <SectionHead label="FAQ" title="Частые вопросы" />
            <div className="lp-faq">
              {FAQ.map((f) => (
                <details key={f.q} className="rv">
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

        {/* Final CTA */}
        <section className="lp-sec">
          <div className="lp-wrap">
            <div className="lp-final rv">
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
            <nav aria-label="Продукт">
              <b>Продукт</b>
              <a href="#features">Возможности</a>
              <a href="#how">Как работает</a>
              <a href="#pricing">Pro</a>
              <a href="#faq">FAQ</a>
            </nav>
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
      <Reveal />
    </div>
  );
}
