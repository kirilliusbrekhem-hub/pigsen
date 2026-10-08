/** Static copy for the marketing landing. */

/** Hero video slot. Swap `src`/`poster` to replace the demo; keep the poster small (<60KB). */
export const HERO_VIDEO = {
  src: "/landing/hero.mp4",
  type: "video/mp4",
  poster: "/landing/hero-poster.webp",
  width: 960,
  height: 600,
} as const;

export const PROOF = [
  { value: "11", label: "курсов" },
  { value: "45", label: "уроков по 5–10 мин" },
  { value: "12", label: "офлайн-челленджей" },
];

export const ADVANTAGES: { icon: string; title: string; text: string }[] = [
  { icon: "sparkle", title: "$PIG — AI-наставник 24/7", text: "Спросите про бюджет, первую выручку или ETF обычными словами — и получите понятный разбор, а не сухую справку." },
  { icon: "cap", title: "Уроки по 5–10 минут", text: "Короткие шаги вместо часовых лекций. Учиться можно в метро." },
  { icon: "check", title: "Квиз после каждого урока", text: "Закрепляете знания сразу, а $PIG объясняет ошибки." },
  { icon: "piggy", title: "Копилка с целями", text: "Цель, срок, темп — видно, сколько осталось до мечты." },
  { icon: "target", title: "Практика в реальной жизни", text: "Челленджи: записать траты, найти экономию, опросить клиентов." },
  { icon: "coin", title: "PigCoin$ и серии", text: "Награды за каждый шаг помогают не бросить на третьем уроке." },
];

export type Cell = "yes" | "no" | "part";
export const COMPARE: { label: string; pigsen: Cell; courses: Cell; youtube: Cell; bank: Cell }[] = [
  { label: "Персональный AI-наставник", pigsen: "yes", courses: "no", youtube: "no", bank: "part" },
  { label: "Короткие уроки с квизами", pigsen: "yes", courses: "part", youtube: "no", bank: "no" },
  { label: "Задания в реальной жизни", pigsen: "yes", courses: "part", youtube: "no", bank: "no" },
  { label: "Награды и серии, чтобы не бросить", pigsen: "yes", courses: "no", youtube: "no", bank: "part" },
  { label: "Без навязывания финпродуктов", pigsen: "yes", courses: "part", youtube: "part", bank: "no" },
  { label: "Бесплатный старт", pigsen: "yes", courses: "no", youtube: "yes", bank: "yes" },
];

export const FAQ = [
  { q: "PIGSEN — это бесплатно?", a: "Да. Курсы, уроки, квизы, копилка, челленджи и комьюнити доступны бесплатно с дневными лимитами. Pro снимает лимиты и открывает эксклюзивные материалы." },
  { q: "Я совсем новичок. Подойдёт?", a: "Да, PIGSEN сделан для старта с нуля: без сложных терминов, короткими шагами. Если что-то непонятно — спросите $PIG. Сервис для пользователей 18+." },
  { q: "Вы даёте инвестиционные советы?", a: "Нет. PIGSEN — образовательная платформа. Мы учим разбираться в деньгах и бизнесе, но не даём индивидуальных рекомендаций и не продаём финансовые продукты. $PIG может ошибаться." },
  { q: "Что такое PigCoin$?", a: "Внутренняя игровая валюта: начисляется за уроки, квизы, взносы в копилку и ежедневный вход. PigCoin$ нельзя вывести или обменять на деньги — их тратят в магазине PIGSEN." },
  { q: "Как оплатить Pro?", a: "Через Telegram Stars: 250★ в месяц или 2000★ в год. Условия — в разделе «Оплата и возвраты»." },
];
