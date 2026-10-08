// Interactive blocks shown under a lesson's text. Pure data, keyed by "courseSlug/lessonSlug";
// rendered by components/learning/interactive. Adding a block to another lesson is a data change here.

export type InteractiveBlock =
  | { type: "flip"; title: string; cards: { front: string; back: string }[] }
  | { type: "order"; title: string; hint: string; items: string[] /* in the correct order */ }
  | { type: "check"; question: string; options: string[]; answer: number; explain: string }
  | { type: "calc"; title: string; formula: "compound" | "unit" };

export const LESSON_BLOCKS: Record<string, InteractiveBlock[]> = {
  "investicii-pervyj-shag/slozhnyj-procent": [
    { type: "calc", title: "Покрутите: как растут вложения", formula: "compound" },
    {
      type: "check",
      question: "Вы вкладываете 10 000 ₽ под 10% годовых с реинвестированием. Сколько примерно будет через 2 года?",
      options: ["12 000 ₽", "12 100 ₽", "11 000 ₽", "20 000 ₽"],
      answer: 1,
      explain: "Во второй год проценты начисляются и на прошлые проценты: 10 000 × 1,1 × 1,1 = 12 100 ₽.",
    },
  ],
  "osnovy-predprinimatelstva/yunit-ekonomika": [
    {
      type: "flip",
      title: "Карточки: термины юнит-экономики",
      cards: [
        { front: "CAC", back: "Стоимость привлечения одного клиента: расходы на маркетинг ÷ число новых клиентов." },
        { front: "LTV", back: "Сколько прибыли клиент приносит за всё время: средний чек × маржа × число покупок." },
        { front: "LTV / CAC", back: "Здоровый бизнес обычно держит отношение 3 и выше." },
        { front: "Окупаемость", back: "За сколько месяцев маржа с клиента возвращает CAC." },
      ],
    },
    { type: "calc", title: "Калькулятор: окупается ли клиент", formula: "unit" },
  ],
  "osnovy-predprinimatelstva/mvp-i-eksperimenty": [
    {
      type: "order",
      title: "Расставьте шаги эксперимента по порядку",
      hint: "Перетащите карточки или используйте стрелки",
      items: ["Сформулировать гипотезу", "Собрать минимальный MVP", "Показать MVP клиентам", "Измерить результат", "Решить: развивать или менять"],
    },
  ],
  "venchurnoe-finansirovanie/raundy": [
    {
      type: "order",
      title: "Расставьте раунды инвестиций от раннего к позднему",
      hint: "Перетащите карточки или используйте стрелки",
      items: ["Pre-seed", "Seed", "Раунд A", "Раунд B", "IPO"],
    },
  ],
};

export const lessonBlocks = (courseSlug: string, lessonSlug: string): InteractiveBlock[] => LESSON_BLOCKS[`${courseSlug}/${lessonSlug}`] ?? [];
