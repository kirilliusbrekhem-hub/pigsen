export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Главная", icon: "home" },
  { href: "/ai", label: "$PIG", icon: "ai" },
  { href: "/learn", label: "Обучение", icon: "cap" },
  { href: "/library", label: "Библиотека", icon: "book" },
  { href: "/savings", label: "Копилка", icon: "piggy" },
  { href: "/tools", label: "Инструменты", icon: "sliders" },
  { href: "/saved", label: "Сохранённое", icon: "bookmark" },
  { href: "/search", label: "Поиск", icon: "search" },
  { href: "/pro", label: "Pro и PigCoin$", icon: "sparkle" },
];

export const TABS: NavItem[] = [
  { href: "/dashboard", label: "Главная", icon: "home" },
  { href: "/learn", label: "Обучение", icon: "cap" },
  { href: "/ai", label: "$PIG", icon: "ai" },
  { href: "/savings", label: "Копилка", icon: "piggy" },
];

export const SECTION_TITLES: Record<string, string> = {
  dashboard: "Главная",
  ai: "$PIG",
  learn: "Обучение",
  library: "Библиотека",
  saved: "Сохранённое",
  search: "Поиск",
  profile: "Профиль",
  tools: "Инструменты",
  savings: "Копилка",
  pro: "Pro",
  admin: "Админка",
};

export const DOCK_HINTS: Record<string, string[]> = {
  dashboard: ["Объясни, как работает венчурное финансирование"],
  learn: ["Составь мне план обучения на месяц"],
  library: ["Что почитать про стартапы?"],
  saved: ["Кратко перескажи мои сохранённые темы"],
  search: [],
  profile: [],
  tools: ["Как проверить бизнес-идею за неделю?"],
  savings: ["Как накопить быстрее, если доход небольшой?"],
  pro: [],
  admin: [],
};

export function sectionOf(pathname: string): string {
  return pathname.split("/")[1] || "dashboard";
}
