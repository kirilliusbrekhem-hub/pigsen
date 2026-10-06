import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

const PITCH = {
  dashboard: { title: "$PIG без ограничений за 10 ₽ в день", text: "Безлимитный чат и коуч, x2 PigCoin$ за всё и +30 монет каждый день. Дешевле чашки кофе в неделю." },
  savings: { title: "Копите в 2 раза быстрее с Pro", text: "Сколько угодно целей, безлимитный коуч и разбор каждой траты. Те, кто проверяют покупки, реже тратят импульсно." },
  chat: { title: "Вопросы закончатся, а мысли нет", text: "В Pro $PIG отвечает без лимитов, сколько угодно раз в день." },
  tools: { title: "Разбирайте все идеи, а не одну в день", text: "Pro снимает лимиты с разбора идей, коуча и чата $PIG." },
  community: { title: "Закрытое комьюнити PIGSEN Pro", text: "Делитесь успехами, задавайте вопросы и находите партнёров среди тех, кто серьёзно растёт в деньгах и бизнесе." },
  leaderboard: { title: "Участвуйте в недельной гонке с Pro", text: "Топ-3 недели получают до 30 дней Pro, до 2000 PigCoin$ и титул «Чемпион недели». Места 4–10 получают по 200 монет." },
  challenges: { title: "Все офлайн-челленджи в Pro", text: "Инвестиции, переговоры, запуск бизнеса: применяйте знания в жизни и получайте до 150 PigCoin$ за каждый челлендж." },
  learn: { title: "Эксклюзивные курсы ждут вас в Pro", text: "Личный финплан, инвестиции с нуля, запуск онлайн-бизнеса и переговоры. Плюс x2 PigCoin$ за каждый урок." },
} as const;

/** Upsell banner for users without Pro. `note` adds a line such as today's remaining allowance. */
export function ProPromo({ place, note }: { place: keyof typeof PITCH; note?: string }) {
  const p = PITCH[place];
  return (
    <Link href="/pro" className="card pro-promo" data-testid="pro-promo">
      <span className="pro-promo-ic">
        <Icon name="sparkle" />
      </span>
      <span className="pro-promo-body">
        <b>{p.title}</b>
        <span>{p.text}</span>
        {note && <span className="pro-promo-note">{note}</span>}
      </span>
      <span className="btn btn-accent btn-sm pro-promo-cta">Попробовать Pro</span>
    </Link>
  );
}
