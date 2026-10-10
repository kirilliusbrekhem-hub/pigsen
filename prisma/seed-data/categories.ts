export interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  icon: string;
}

export const categories: SeedCategory[] = [
  { slug: "business", name: "Бизнес", description: "Как устроены компании, модели и стратегии.", icon: "briefcase" },
  { slug: "startups", name: "Стартапы", description: "Запуск, рост и путь от идеи до продукта.", icon: "rocket" },
  { slug: "ai", name: "ИИ", description: "Искусственный интеллект и его влияние на бизнес.", icon: "sparkle" },
  { slug: "finance", name: "Финансы", description: "Деньги, капитал и финансирование компаний.", icon: "coin" },
  { slug: "investing", name: "Инвестиции", description: "Инвестиции, риск и долгосрочное мышление.", icon: "trendUp" },
  { slug: "technology", name: "Технологии", description: "Технологии, которые меняют рынки.", icon: "cpu" },
  { slug: "leadership", name: "Лидерство", description: "Управление людьми, командами и решениями.", icon: "users" },
  { slug: "marketing", name: "Маркетинг", description: "Клиенты, бренд, рост и каналы.", icon: "megaphone" },
  { slug: "crypto", name: "Крипта", description: "Криптовалюты, блокчейн и их риски.", icon: "coin" },
  { slug: "productivity", name: "Продуктивность", description: "Фокус, привычки и качество мышления.", icon: "target" },
];
