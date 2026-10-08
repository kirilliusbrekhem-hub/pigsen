export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
  /** Open by default when the user has no stored preference. */
  defaultOpen?: boolean;
}

export type NavEntry = NavItem | NavGroup;

export function isGroup(e: NavEntry): e is NavGroup {
  return "items" in e;
}

/** Sidebar structure: top-level links and collapsible groups. */
export const NAV_TREE: NavEntry[] = [
  { href: "/dashboard", label: "Главная", icon: "home" },
  { href: "/ai", label: "$PIG", icon: "ai" },
  {
    id: "learn",
    label: "Обучение",
    icon: "cap",
    defaultOpen: true,
    items: [
      { href: "/learn", label: "Курсы", icon: "cap" },
      { href: "/library", label: "Библиотека", icon: "book" },
      { href: "/sim", label: "Бизнес-симулятор", icon: "bolt" },
      { href: "/duels", label: "Дуэли", icon: "trophy" },
      { href: "/challenges", label: "Челленджи", icon: "target" },
      { href: "/saved", label: "Сохранённое", icon: "bookmark" },
    ],
  },
  {
    id: "money",
    label: "Деньги",
    icon: "piggy",
    items: [
      { href: "/savings", label: "Копилка", icon: "piggy" },
      { href: "/analyze", label: "Разбор трат", icon: "chart" },
      { href: "/plan", label: "Бизнес-план", icon: "book" },
      { href: "/tools", label: "Инструменты", icon: "sliders" },
    ],
  },
  {
    id: "community",
    label: "Сообщество",
    icon: "users",
    items: [
      { href: "/community", label: "Лента", icon: "users" },
      { href: "/messages", label: "Сообщения", icon: "message" },
      { href: "/leaderboard", label: "Лидерборд", icon: "chart" },
      { href: "/invite", label: "Пригласить друга", icon: "link" },
    ],
  },
  { href: "/pro", label: "Pro и PigCoin$", icon: "sparkle" },
];

export const ADMIN_ITEM: NavItem = { href: "/admin", label: "Админка", icon: "shield" };

/** Flat list of every sidebar link (kept for compatibility). */
export const NAV: NavItem[] = NAV_TREE.flatMap((e) => (isGroup(e) ? e.items : [e]));

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
  sim: "Бизнес-симулятор",
  duels: "Дуэли",
  analyze: "Разбор трат",
  plan: "Бизнес-план",
  u: "Профиль",
  savings: "Копилка",
  pro: "Pro",
  admin: "Админка",
  leaderboard: "Лидерборд",
  community: "Комьюнити",
  messages: "Сообщения",
  challenges: "Челленджи",
  invite: "Пригласить",
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
  leaderboard: [],
  community: ["Как найти партнёра для бизнеса?"],
  messages: [],
  challenges: ["Помоги выбрать челлендж под мои цели"],
  invite: [],
};

export function sectionOf(pathname: string): string {
  return pathname.split("/")[1] || "dashboard";
}
