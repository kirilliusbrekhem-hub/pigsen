/** Offline challenges: real-world tasks that cement what a course teaches. Pure data, safe for client and server. */
export type Difficulty = "easy" | "medium" | "hard";

export interface Challenge {
  id: string;
  title: string;
  /** Course slug the challenge belongs to (prisma/seed-data/courses*.ts). */
  course: string;
  topic: string;
  steps: string[];
  proof: string;
  reward: number;
  difficulty: Difficulty;
  /** Available on the Free plan. */
  free?: boolean;
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Легко", medium: "Средне", hard: "Сложно" };

export const CHALLENGES: Challenge[] = [
  {
    id: "spend-notebook",
    title: "Неделю записывай все траты в блокнот",
    course: "lichnye-finansy-start",
    topic: "Личные финансы",
    steps: ["Заведи бумажный блокнот или заметку", "Записывай каждую покупку сразу: сумма и категория", "В конце недели посчитай итог по категориям"],
    proof: "Какая категория оказалась самой большой и что удивило?",
    reward: 80,
    difficulty: "medium",
    free: true,
  },
  {
    id: "no-delivery-week",
    title: "Неделя без доставки еды: запиши сэкономленное",
    course: "lichnye-finansy-start",
    topic: "Личные финансы",
    steps: ["Посмотри, сколько ушло на доставку за прошлую неделю", "7 дней готовь сам или бери еду с собой", "Посчитай разницу и отложи её в копилку"],
    proof: "Сколько рублей удалось сэкономить и куда ты их отложил?",
    reward: 100,
    difficulty: "medium",
    free: true,
  },
  {
    id: "interview-five",
    title: "Опроси 5 знакомых о проблеме для своей идеи",
    course: "osnovy-predprinimatelstva",
    topic: "Предпринимательство",
    steps: ["Сформулируй проблему одним предложением", "Поговори с 5 людьми: как они решают её сейчас и сколько платят", "Не продавай идею, слушай и записывай"],
    proof: "Что сказали люди? Подтвердилась ли проблема?",
    reward: 120,
    difficulty: "medium",
    free: true,
  },
  {
    id: "compare-deposits",
    title: "Сравни ставки по вкладам в 3 банках",
    course: "lichnye-finansy-start",
    topic: "Подушка безопасности",
    steps: ["Выбери 3 банка", "Сравни ставку, срок, условия пополнения и снятия", "Запиши, какой вариант подошёл бы для подушки. Открывать вклад не обязательно"],
    proof: "Какие ставки нашёл и какой вариант выбрал бы и почему?",
    reward: 90,
    difficulty: "easy",
  },
  {
    id: "sell-avito",
    title: "Продай ненужную вещь на Авито",
    course: "zapusk-onlajn-biznesa-za-30-dnej",
    topic: "Продажи",
    steps: ["Найди дома вещь, которой не пользовался полгода", "Сделай 3 хороших фото и честное описание", "Поставь цену по аналогам и доведи сделку до конца"],
    proof: "Что продал, за сколько и что помогло продать?",
    reward: 120,
    difficulty: "medium",
  },
  {
    id: "budget-50-30-20",
    title: "Разложи зарплату по правилу 50/30/20",
    course: "lichnyj-finansovyj-plan-na-god",
    topic: "Финплан",
    steps: ["Возьми доход за месяц", "Распредели: 50% нужды, 30% желания, 20% накопления", "Сравни с тем, как тратишь на самом деле"],
    proof: "Какие доли получились у тебя на самом деле?",
    reward: 70,
    difficulty: "easy",
  },
  {
    id: "debt-list",
    title: "Выпиши все долги и выбери стратегию погашения",
    course: "lichnyj-finansovyj-plan-na-god",
    topic: "Долги",
    steps: ["Выпиши все кредиты, рассрочки и долги друзьям", "Укажи сумму, ставку и платёж", "Выбери «лавину» или «снежный ком» и составь график платежей"],
    proof: "Какую стратегию выбрал и какой долг гасишь первым?",
    reward: 100,
    difficulty: "medium",
  },
  {
    id: "first-bond",
    title: "Изучи 3 облигации ОФЗ и сравни их",
    course: "investicii-do-pervogo-portfelya",
    topic: "Инвестиции",
    steps: ["Открой приложение брокера или сайт Мосбиржи", "Сравни 3 выпуска ОФЗ: доходность, срок, купон", "Запиши, какой выпуск выбрал бы и почему. Покупать ничего не нужно"],
    proof: "Какой выпуск выбрал и почему?",
    reward: 110,
    difficulty: "medium",
  },
  {
    id: "ask-raise",
    title: "Подготовь разговор о повышении",
    course: "peregovory-i-prodazhi-prosit-bolshe",
    topic: "Переговоры",
    steps: ["Собери 3 факта о своих результатах", "Узнай рыночную вилку для своей роли", "Назови конкретную цифру-якорь на встрече или отрепетируй с другом"],
    proof: "Какую цифру назвал и чем закончился разговор?",
    reward: 150,
    difficulty: "hard",
  },
  {
    id: "landing-day",
    title: "Сделай одностраничный лендинг идеи за вечер",
    course: "zapusk-onlajn-biznesa-za-30-dnej",
    topic: "Запуск",
    steps: ["Напиши оффер в одно предложение", "Собери страницу в конструкторе с кнопкой «Оставить заявку»", "Покажи её 10 людям и посчитай заявки"],
    proof: "Сколько человек увидели страницу и сколько оставили заявку?",
    reward: 150,
    difficulty: "hard",
  },
  {
    id: "ai-routine",
    title: "Автоматизируй одну рутину с помощью ИИ",
    course: "ai-dlya-biznesa",
    topic: "ИИ",
    steps: ["Выбери задачу, которую делаешь каждую неделю", "Составь хороший запрос с контекстом и примером", "Сравни время до и после"],
    proof: "Какую задачу автоматизировал и сколько времени сэкономил?",
    reward: 80,
    difficulty: "easy",
  },
  {
    id: "unit-economics-shop",
    title: "Посчитай юнит-экономику соседнего кафе",
    course: "osnovy-predprinimatelstva",
    topic: "Юнит-экономика",
    steps: ["Зайди в кафе и прикинь средний чек и поток гостей за час", "Оцени себестоимость, аренду и зарплаты", "Посчитай, сколько кафе зарабатывает с одного гостя"],
    proof: "Какой получился средний чек и маржа на гостя?",
    reward: 100,
    difficulty: "hard",
  },
  {
    id: "crypto-safety",
    title: "Проверь безопасность своих финансовых аккаунтов",
    course: "kripto-osnovy-i-riski",
    topic: "Безопасность",
    steps: ["Включи двухфакторную защиту в банке и на бирже", "Смени повторяющиеся пароли", "Расскажи близкому о 3 частых схемах мошенников"],
    proof: "Что включил и о каких схемах рассказал?",
    reward: 50,
    difficulty: "easy",
  },
];

export const FREE_CHALLENGES = CHALLENGES.filter((c) => c.free).length;

export const challengeById = (id: string) => CHALLENGES.find((c) => c.id === id);
export const challengeForCourse = (slug: string) => CHALLENGES.find((c) => c.course === slug);
