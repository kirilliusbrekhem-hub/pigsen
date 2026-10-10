export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export interface NavGroup {
  id: string;
  label: string;
  icon: string;
  /** Every link of the group, flat (derived from `sections` when present). */
  items: NavItem[];
  /** Optional sub-headings inside the group. */
  sections?: NavSection[];
  /** Open by default when the user has no stored preference. */
  defaultOpen?: boolean;
}

export type NavEntry = NavItem | NavGroup;

export function isGroup(e: NavEntry): e is NavGroup {
  return "items" in e;
}

/**
 * Kapital navigation: the four prototype tabs. Legacy sections (dashboard, piggy bank, courses, duels…) stay
 * reachable by URL but are no longer in the menu.
 */
export const NAV_TREE: NavEntry[] = [
  { href: "/business", label: "Бизнес", icon: "store" },
  { href: "/cap", label: "CAP", icon: "ai" },
  { href: "/team", label: "Команда", icon: "users" },
  { href: "/me", label: "Профиль", icon: "user" },
];

export const ADMIN_ITEM: NavItem = { href: "/admin", label: "Админка", icon: "shield" };

/** Flat list of every sidebar link (kept for compatibility). */
export const NAV: NavItem[] = NAV_TREE.flatMap((e) => (isGroup(e) ? e.items : [e]));

export const TABS: NavItem[] = NAV_TREE.filter((e): e is NavItem => !isGroup(e));

export const SECTION_TITLES: Record<string, string> = {
  dashboard: "Главная",
  biz: "Мой бизнес",
  ai: "CAP",
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
  biz: ["Что улучшить в кофейне первым?"],
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
