import type { Metadata } from "next";
import Link from "next/link";
import { Pig, Wordmark } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";
import { Orb } from "@/components/ui/Orb";
import { HeroVideo } from "@/components/landing/HeroVideo";
import { CafeArt } from "@/components/landing/CafeArt";
import { FAQ, STEPS } from "@/components/landing/data";
import { LIMITS, PLANS, PRO_TIER_NAMES, TEAM_CAPS } from "@/lib/billing/plan";

export const metadata: Metadata = {
  title: { absolute: "PìgBiz — Make your money Smarter." },
  description: "Копи по-настоящему — строй свой бизнес. Реальные накопления в копилке превращаются в виртуальную кофейню, которую ты растишь сам или с друзьями вместе с AI-партнёром $PIG.",
  openGraph: { title: "PìgBiz — Make your money Smarter.", description: "Копи по-настоящему — строй свой бизнес вместе с AI-партнёром $PIG. Бесплатный старт.", locale: "ru_RU", type: "website" },
};

// Logged-in visitors are redirected to /dashboard by proxy.ts.

const NAV = [
  { href: "#how", label: "Как это работает" },
  { href: "#together", label: "С друзьями" },
  { href: "#pricing", label: "Pro" },
  { href: "#faq", label: "FAQ" },
];

const free = LIMITS.free;
const FREE_PEOPLE = free.team;
const PRO_TIERS = [
  { tier: "pro", month: PLANS.month, year: PLANS.year },
  { tier: "pro7", month: PLANS.month7, year: PLANS.year7 },
  { tier: "pro10", month: PLANS.month10, year: PLANS.year10 },
].map((t) => ({ name: PRO_TIER_NAMES[t.tier as keyof typeof TEAM_CAPS], people: TEAM_CAPS[t.tier as keyof typeof TEAM_CAPS], month: t.month.stars, year: t.year.stars }));
const FREE_FEATURES = [
  `Своя виртуальная кофейня — вдвоём с другом (${FREE_PEOPLE} человека)`,
  `${free.goals} цели в копилке, базовые улучшения бизнеса`,
  `${free.chat} вопросов $PIG и ${free.coach} совет коуча в день`,
  "Лидерборд бизнесов и челленджи на накопления",
];
const PRO_FEATURES = [
  "Больше со-основателей в одном бизнесе",
  "Премиальные улучшения: интерьер, меню, команда",
  "Безлимитный $PIG-партнёр и коуч по накоплениям",
  "Сколько угодно целей в копилке, x2 PigCoin$",
];

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
          <Link href="/" className="brand" aria-label="PìgBiz — на главную">
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
                <Orb /> AI-партнёр $PIG внутри
              </span>
              <h1>
                Копи по-настоящему — <span className="lp-hl">строй свой бизнес</span>
              </h1>
              <p className="lp-lead">Реальные накопления в копилке превращаются в виртуальную кофейню. Ставишь кофемашину, стулья, нанимаешь бариста — один или с друзьями-кофаундерами. А $PIG помогает, как живой партнёр.</p>
              <div className="lp-cta-row">
                <Link className="btn btn-accent btn-lg" href="/register">
                  Открыть свою кофейню <Icon name="arrow" size="sm" />
                </Link>
                <a className="btn btn-secondary btn-lg" href="#how">
                  Как это работает
                </a>
              </div>
              <ul className="lp-ticks">
                <li>
                  <Icon name="check" size="sm" /> Бесплатный старт
                </li>
                <li>
                  <Icon name="check" size="sm" /> Деньги остаются у тебя
                </li>
                <li>
                  <Icon name="check" size="sm" /> Бизнес виртуальный
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
                <Icon name="piggy" size="sm" /> +2 000 ₽ → новая кофемашина
              </div>
              <div className="lp-float lp-float-b" aria-hidden="true">
                <Orb /> «Давай сначала стулья — гостям негде сесть»
              </div>
            </div>
          </div>
        </section>

        <section className="lp-sec" id="how">
          <div className="lp-wrap">
            <SectionHead label="Как это работает" title="Три шага от копилки к своей кофейне" text="Чем больше откладываешь, тем больше растёт бизнес. Снял деньги — бизнес просел." />
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className="lp-step">
                  <CafeArt stage={s.stage} />
                  <span className="lp-step-n">{String(i + 1).padStart(2, "0")}</span>
                  <b>{s.title}</b>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-sec lp-sec-alt" id="together">
          <div className="lp-wrap">
            <SectionHead label="Не в одиночку" title="Друзья-кофаундеры и партнёр $PIG" />
            <div className="lp-duo">
              <div className="lp-card">
                <span className="lp-ic">
                  <Icon name="users" />
                </span>
                <b>Вместе с друзьями</b>
                <p>Позови друзей кофаундерами: каждый копит в своей копилке, а кофейня растёт от общего капитала. Видно, кто сколько вложил — и никому не хочется подвести команду.</p>
                <ul className="lp-mini">
                  <li>
                    <Icon name="check" size="sm" /> Общий бизнес, личные накопления
                  </li>
                  <li>
                    <Icon name="check" size="sm" /> Бесплатно вдвоём, в Pro — до 10 со-основателей
                  </li>
                  <li>
                    <Icon name="check" size="sm" /> Лидерборд бизнесов и челленджи на накопления
                  </li>
                </ul>
              </div>
              <div className="lp-card is-main">
                <span className="lp-ic">
                  <Orb />
                </span>
                <b>$PIG — партнёр, а не справочник</b>
                <p>Советует, что улучшить, радуется твоим взносам и иногда ошибается — как живой партнёр. Поэтому к нему хочется возвращаться, а важные решения остаются за тобой.</p>
                <div className="lp-chat" aria-hidden="true">
                  <span className="lp-msg is-me">Отложил 1 500 ₽. Что купим?</span>
                  <span className="lp-msg">Отлично! Давай второй столик — по вечерам у нас очередь. Хотя… может, сначала бариста? Решай, партнёр.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-sec" id="pricing">
          <div className="lp-wrap">
            <SectionHead label="Тарифы" title="Начни бесплатно. Расти с Pro." text="Free хватает, чтобы копить и развивать кофейню. Pro — когда команда больше двух: до 4, 7 или 10 человек." />
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
                  <b>от {PRO_TIERS[0].month}★</b>
                  <span>в месяц</span>
                </div>
                <ul className="lp-tiers" aria-label="Тарифы Pro по размеру команды">
                  {PRO_TIERS.map((t) => (
                    <li key={t.name}>
                      <b>{t.name}</b>
                      <span>до {t.people} человек</span>
                      <span className="lp-tier-price">
                        {t.month}★/мес · {t.year}★/год
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="lp-price-alt">Оплата через Telegram Stars</p>
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
              <p>Первый взнос в копилку — и у твоей кофейни уже есть капитал. $PIG ждёт партнёра.</p>
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
              <p>Копи по-настоящему — строй свой бизнес. Make your money Smarter.</p>
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
              PìgBiz — образовательная игра о накоплениях и бизнесе. Бизнес в сервисе виртуальный: мы не принимаем и не храним ваши деньги, накопления остаются у вас. Материалы и ответы $PIG не являются индивидуальной инвестиционной, финансовой, налоговой или юридической рекомендацией. Инвестиции связаны с риском потери денег. $PIG — ИИ-помощник: он может ошибаться, проверяйте важные цифры. PigCoin$ — игровая валюта без денежной стоимости. Сервис для пользователей 18+.
            </p>
          </div>
          <p className="lp-copy">© {new Date().getFullYear()} PìgBiz</p>
        </div>
      </footer>
    </div>
  );
}
