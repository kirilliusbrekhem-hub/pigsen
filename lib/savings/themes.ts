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
  { id: "piggy", label: "Копилка", icon: "piggy", from: "#4CC795", to: "#0E7A52" },
  { id: "umbrella", label: "Подушка", icon: "umbrella", from: "#3FBD88", to: "#0B4D35" },
  { id: "plane", label: "Путешествие", icon: "plane", from: "#5FA884", to: "#1C5640" },
  { id: "house", label: "Жильё", icon: "house", from: "#2E8A63", to: "#0C1114" },
  { id: "laptop", label: "Техника", icon: "laptop", from: "#A9D2BC", to: "#2E8A63" },
  { id: "car", label: "Машина", icon: "car", from: "#0E7A52", to: "#0C1114", premium: true },
  { id: "rocket", label: "Свой бизнес", icon: "rocket", from: "#4CC795", to: "#0C1114", premium: true },
  { id: "heart", label: "Для близких", icon: "heart", from: "#55CC99", to: "#0B6745", premium: true },
  { id: "cap", label: "Учёба", icon: "cap", from: "#1C5640", to: "#0C1114", premium: true },
  { id: "gold", label: "Изумрудная", icon: "gem", from: "#4CE0A2", to: "#0E3B2A", premium: true },
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
