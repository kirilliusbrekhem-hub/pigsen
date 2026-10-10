import { z } from "zod";

// Shared by the wizard (client) and the API (server). Every list and string is bounded so a saved plan stays small.
const text = (max: number) => z.string().trim().max(max, `До ${max} символов`);
const money = z.coerce.number().finite().min(0, "Не может быть меньше нуля").max(1_000_000_000, "Слишком большое число");
const item = z.object({ name: text(80).min(1, "Укажите название"), amount: money });

export const PlanInputSchema = z.object({
  title: text(80).min(2, "Назовите проект"),
  idea: text(1500).min(20, "Опишите идею хотя бы в паре предложений"),
  audience: text(800).min(5, "Опишите, кто клиент"),
  competitors: z.array(z.object({ name: text(80).min(1, "Укажите конкурента"), price: money, note: text(200) })).max(6),
  price: money.refine((n) => n > 0, "Цена должна быть больше нуля"),
  unitCost: money,
  startup: z.array(item).max(20),
  monthly: z.array(item).max(20),
  sales: z.object({
    firstMonth: z.coerce.number().int().min(0).max(10_000_000),
    growthPct: z.coerce.number().min(-50).max(200),
    capacity: z.coerce.number().int().min(1).max(10_000_000),
  }),
  channels: z.array(item).max(10),
  team: z.array(z.object({ name: text(80).min(1, "Укажите роль"), amount: money })).max(15),
  risks: z.array(text(200).min(2)).max(8),
  taxPct: z.coerce.number().min(0).max(50),
});

export type PlanInput = z.infer<typeof PlanInputSchema>;

export const STEPS = [
  { id: "idea", title: "Идея", hint: "Одна фраза: какую проблему вы решаете и почему сейчас. Инвестор и банк читают это первым." },
  { id: "audience", title: "Клиенты", hint: "Чем уже сегмент, тем дешевле реклама. «Мамы в декрете в Казани» лучше, чем «все женщины»." },
  { id: "competitors", title: "Конкуренты", hint: "Конкуренты есть всегда: даже «ничего не делать» или Excel. Укажите их цену, это ориентир для вашей." },
  { id: "pricing", title: "Цена", hint: "Себестоимость — всё, что вы тратите на одну продажу: сырьё, упаковка, комиссия, доставка. Наценка ниже 30% редко выживает." },
  { id: "startup", title: "Запуск", hint: "Разовые траты до первой продажи. Заложите 15–20% на непредвиденное, они почти всегда случаются." },
  { id: "monthly", title: "Расходы", hint: "Постоянные траты каждый месяц, даже если продаж нет: аренда, сервисы, бухгалтер." },
  { id: "sales", title: "Продажи", hint: "Будьте скромнее, чем хочется: первые месяцы обычно продают в 2–3 раза меньше плана." },
  { id: "channels", title: "Каналы", hint: "Где клиенты уже проводят время? Начните с 1–2 каналов и бюджета, который не жалко потерять на тесты." },
  { id: "team", title: "Команда", hint: "Учитывайте и свою зарплату: бизнес, который живёт только на вашем бесплатном труде, не окупается." },
  { id: "risks", title: "Риски", hint: "Что может пойти не так? CAP добавит к каждому риску способ его снизить." },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

/** Smart defaults: a small coffee-to-go point. Users overwrite everything; numbers are plausible, not advice. */
export const DEFAULT_INPUT: PlanInput = {
  title: "",
  idea: "",
  audience: "",
  competitors: [{ name: "", price: 0, note: "" }],
  price: 1500,
  unitCost: 600,
  startup: [
    { name: "Оборудование", amount: 150000 },
    { name: "Сайт и дизайн", amount: 40000 },
    { name: "Регистрация и юрист", amount: 10000 },
    { name: "Резерв на непредвиденное", amount: 30000 },
  ],
  monthly: [
    { name: "Аренда", amount: 30000 },
    { name: "Сервисы и связь", amount: 5000 },
    { name: "Бухгалтерия", amount: 4000 },
  ],
  sales: { firstMonth: 40, growthPct: 15, capacity: 300 },
  channels: [
    { name: "Таргетированная реклама", amount: 15000 },
    { name: "Соцсети и контент", amount: 5000 },
  ],
  team: [{ name: "Основатель", amount: 40000 }],
  risks: ["Продажи растут медленнее плана"],
  taxPct: 6,
};
