// Goal cover themes. Free ones are available to everyone; premium ones need Pro or a shop purchase.
export interface GoalTheme {
  id: string;
  label: string;
  icon: string;
  from: string;
  to: string;
  premium?: boolean;
}

export const THEMES: GoalTheme[] = [
  { id: "piggy", label: "Копилка", icon: "piggy", from: "#ff9a8b", to: "#ff6a88" },
  { id: "umbrella", label: "Подушка", icon: "umbrella", from: "#5ee7df", to: "#3b82f6" },
  { id: "plane", label: "Путешествие", icon: "plane", from: "#4facfe", to: "#00c6fb" },
  { id: "house", label: "Жильё", icon: "house", from: "#a18cd1", to: "#7c3aed" },
  { id: "laptop", label: "Техника", icon: "laptop", from: "#84fab0", to: "#10b981" },
  { id: "car", label: "Машина", icon: "car", from: "#f6d365", to: "#fd8a3e", premium: true },
  { id: "rocket", label: "Свой бизнес", icon: "rocket", from: "#667eea", to: "#e040fb", premium: true },
  { id: "heart", label: "Для близких", icon: "heart", from: "#ff758c", to: "#e11d48", premium: true },
  { id: "cap", label: "Учёба", icon: "cap", from: "#43e97b", to: "#0ea5e9", premium: true },
  { id: "gold", label: "Золотая", icon: "coin", from: "#f7d774", to: "#b8860b", premium: true },
];

export const themeOf = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export const MOTIVATION = [
  "Каждый взнос — голос за будущего себя.",
  "Не важно, сколько. Важно, что регулярно.",
  "Богатство — это то, что вы не потратили.",
  "Маленькие шаги каждый день дают большой результат за год.",
  "Вы платите себе первым. Это и есть финансовая свобода.",
  "Цель без плана — желание. У вас есть план.",
  "Сегодняшний отказ от импульсной покупки — завтрашняя мечта.",
];

/** Quote of the day (UTC), stable for the whole day. */
export function quoteOfTheDay(date = new Date()): string {
  return MOTIVATION[Math.floor(date.getTime() / 86_400_000) % MOTIVATION.length];
}
