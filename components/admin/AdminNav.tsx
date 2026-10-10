import Link from "next/link";

const TABS = [
  { href: "/admin", label: "Статистика" },
  { href: "/admin/metrics", label: "Метрики" },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/payments", label: "Платежи" },
  { href: "/admin/content", label: "Материалы" },
  { href: "/admin/reviews", label: "Отзывы" },
  { href: "/admin/proofs", label: "Взносы" },
  { href: "/admin/challenges", label: "Челленджи" },
  { href: "/admin/marketing", label: "Маркетинг" },
];

export function AdminNav({ active, title }: { active: string; title: string }) {
  return (
    <section className="stack" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <span className="label">Админка</span>
          <h1>{title}</h1>
        </div>
      </div>
      <nav className="chips-row" aria-label="Разделы админки">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={`chip ${t.href === active ? "is-selected" : ""}`} aria-current={t.href === active ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
