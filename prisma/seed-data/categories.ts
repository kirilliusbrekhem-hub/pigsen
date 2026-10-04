export interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  icon: string;
}

export const categories: SeedCategory[] = [
  { slug: "business", name: "Business", description: "Как устроены компании, модели и стратегии.", icon: "briefcase" },
  { slug: "startups", name: "Startups", description: "Запуск, рост и путь от идеи до продукта.", icon: "rocket" },
  { slug: "ai", name: "AI", description: "Искусственный интеллект и его влияние на бизнес.", icon: "sparkle" },
  { slug: "finance", name: "Finance", description: "Деньги, капитал и финансирование компаний.", icon: "coin" },
  { slug: "investing", name: "Investing", description: "Инвестиции, риск и долгосрочное мышление.", icon: "trendUp" },
  { slug: "technology", name: "Technology", description: "Технологии, которые меняют рынки.", icon: "cpu" },
  { slug: "leadership", name: "Leadership", description: "Управление людьми, командами и решениями.", icon: "users" },
  { slug: "marketing", name: "Marketing", description: "Клиенты, бренд, рост и каналы.", icon: "megaphone" },
  { slug: "productivity", name: "Productivity", description: "Фокус, привычки и качество мышления.", icon: "target" },
];
