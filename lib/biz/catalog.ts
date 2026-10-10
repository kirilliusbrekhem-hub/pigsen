// Kapital catalog: business types and their upgrade items. Pure data, safe to import on the client (BizScene maps
// sprites by item id). Item ids are stable lowercase-kebab; the original coffee ids (chairs, sign, …) are kept as is.
// Prices are in rubles of business capital, and capital only ever comes from real savings.

export type BizKind = "coffee" | "bakery" | "barber" | "shop" | "webstudio" | "app" | "saas";
export type Template = "offline" | "online" | "it";
export type ItemCategory = "furniture" | "equipment" | "staff" | "marketing" | "tech" | "infra" | "product" | "premium" | "decor";
/** Where the scene renderer should put the sprite. */
export type SlotHint = "floor" | "wall" | "counter" | "window" | "outside" | "street" | "staff" | "desk" | "server" | "screen" | "cloud" | "annex";

export interface Effect {
  /** Guests / users / clients per day. */
  guests?: number;
  /** Average check / ARPU. */
  check?: number;
  rating?: number;
  /** IT only: change of daily churn share (negative = fewer users leave). */
  churn?: number;
  /** IT only: change of open bugs (negative = fewer). */
  bugs?: number;
}

export interface UpgradeDef {
  id: string;
  title: string;
  blurb: string;
  category: ItemCategory;
  slot: SlotHint;
  price: number;
  effect: Effect;
  requires?: string[];
  minLevel?: number;
  /** Pro-only item / skin. */
  premium?: boolean;
  /** Unlocked only by a won investor deal. */
  exclusive?: boolean;
  /** Unique reward of an admin-approved challenge; never sold for capital. */
  challenge?: { source: "biz" | "social"; id: string };
  /** Plausible CAP hint text ("гости жалуются на вкус"). */
  hint: string;
}

export interface MetricLabels {
  guests: string;
  guestsShort: string;
  check: string;
  revenue: string;
  /** "гостей", "пользователей"… for sentences. */
  noun: string;
}

export interface KindDef {
  kind: BizKind;
  title: string;
  template: Template;
  emoji: string;
  available: boolean;
  blurb: string;
  levels: string[];
  base: { guests: number; check: number; churn: number; bugs: number };
  labels: MetricLabels;
  /** Items needed for level 2 and level 3. */
  levelRules: string[][];
  catalog: UpgradeDef[];
}

type Opt = Partial<Pick<UpgradeDef, "requires" | "minLevel" | "premium" | "exclusive">>;
const u = (id: string, title: string, category: ItemCategory, slot: SlotHint, price: number, effect: Effect, blurb: string, hint: string, o: Opt = {}): UpgradeDef => ({
  id,
  title,
  blurb,
  category,
  slot,
  price,
  effect,
  hint,
  ...o,
});

const OFFLINE_LABELS: MetricLabels = { guests: "Гостей в день", guestsShort: "гостей", check: "Средний чек", revenue: "Выручка дня", noun: "гостей" };

// ── Кофейня (original ids kept) ──
const COFFEE: UpgradeDef[] = [
  u("chairs", "Стулья", "furniture", "floor", 1500, { guests: 6 }, "Гостям есть где присесть", "люди берут кофе и уходят — им негде сесть"),
  u("sign", "Вывеска", "marketing", "wall", 2000, { guests: 10 }, "Вас замечают с улицы", "прохожие нас просто не видят"),
  u("tables", "Столы", "furniture", "floor", 2500, { guests: 8, rating: 0.1 }, "Можно задержаться с ноутбуком", "стулья есть, а чашку ставить некуда", { requires: ["chairs"] }),
  u("machine", "Кофемашина", "equipment", "counter", 6000, { check: 60, rating: 0.3 }, "Настоящий эспрессо вместо растворимого", "растворимый кофе — это позор, нужна кофемашина"),
  u("grinder", "Кофемолка", "equipment", "counter", 2500, { rating: 0.4, check: 10 }, "Свежий помол — другой вкус", "гости жалуются на вкус — нужна кофемолка", { requires: ["machine"] }),
  u("showcase", "Витрина с десертами", "equipment", "counter", 4000, { check: 80 }, "Круассан к кофе поднимает чек", "к кофе часто спрашивают что-то сладкое"),
  u("barista", "Нанять бариста", "staff", "staff", 8000, { guests: 12, rating: 0.3 }, "Быстрее очередь, вкуснее капучино", "очередь до двери, ты один не справляешься", { requires: ["machine"] }),
  u("menu", "Новое меню", "marketing", "wall", 3000, { check: 40, rating: 0.1 }, "Раф, матча и сезонные напитки", "все спрашивают раф, а у нас его нет", { requires: ["machine"] }),
  u("renovation", "Ремонт", "furniture", "wall", 12000, { rating: 0.5, guests: 6 }, "Светлый зал, свет и растения", "обои отклеиваются, гостям неуютно", { minLevel: 2 }),
  u("terrace", "Терраса", "furniture", "outside", 15000, { guests: 20 }, "Летние столики на улице", "на улице солнце — терраса будет забита", { minLevel: 2, requires: ["tables"] }),
  u("delivery", "Доставка", "staff", "street", 10000, { guests: 15, check: 20 }, "Кофе в офисы по соседству", "соседние офисы просят доставку", { minLevel: 2, requires: ["barista"] }),
  u("hall2", "Второй зал", "furniture", "annex", 40000, { guests: 40, rating: 0.1 }, "Вдвое больше мест — путь к сети", "по выходным люди стоят на улице, нужен второй зал", { minLevel: 2, requires: ["renovation"] }),
  u("loyalty-card", "Карта лояльности", "marketing", "counter", 2000, { guests: 5, rating: 0.1 }, "Каждый шестой кофе — в подарок", "постоянные гости спрашивают про бонусы"),
  u("cold-brew", "Колд брю", "product", "counter", 3500, { check: 30, guests: 4 }, "Холодный кофе на лето", "в жару горячий кофе никто не берёт", { requires: ["grinder"] }),
  u("smm", "SMM и соцсети", "marketing", "screen", 5000, { guests: 14 }, "Красивые фото и сторис каждый день", "о нас никто не знает в интернете", { requires: ["sign"] }),
  u("roastery", "Своя обжарка", "equipment", "annex", 20000, { check: 70, rating: 0.4 }, "Эксклюзив от инвестора: зерно своей обжарки", "свое зерно — и мы как настоящие спешелти", { requires: ["machine"], exclusive: true }),
  u("latte", "Латте-арт мастер", "premium", "staff", 5000, { rating: 0.4, guests: 4 }, "Рисунки на пенке, фото в соцсетях", "гости фотографируют кофе — пора делать латте-арт", { requires: ["barista"], premium: true }),
  u("neon", "Неоновая вывеска", "premium", "wall", 3000, { guests: 12 }, "Светится зелёным по вечерам", "вечером нас не видно, нужен неон", { requires: ["sign"], premium: true }),
  u("vinyl", "Винил-проигрыватель", "premium", "floor", 4000, { rating: 0.3 }, "Атмосфера, ради которой возвращаются", "в зале тишина, нужна музыка", { premium: true }),
];

// ── Пекарня ──
const BAKERY: UpgradeDef[] = [
  u("oven", "Печь", "equipment", "counter", 7000, { check: 50, rating: 0.3 }, "Своя выпечка вместо заморозки", "мы греем заморозку — гости чувствуют"),
  u("mixer", "Тестомес", "equipment", "counter", 4000, { guests: 6, rating: 0.1 }, "Тесто без ручного труда", "тесто замешиваем руками — ничего не успеваем", { requires: ["oven"] }),
  u("bakery-showcase", "Витрина", "equipment", "window", 3500, { guests: 8, check: 20 }, "Хлеб и булочки видно с улицы", "прохожие не видят, что у нас есть"),
  u("bakery-sign", "Вывеска «Свежий хлеб»", "marketing", "wall", 2000, { guests: 8 }, "Запах и вывеска делают своё дело", "нас путают с аптекой — нужна вывеска"),
  u("shelves", "Хлебные полки", "furniture", "wall", 1500, { check: 20 }, "Батоны, багеты и чиабатта рядами", "хлеб лежит в коробках, это некрасиво"),
  u("cashbox", "Касса и терминал", "equipment", "counter", 2500, { guests: 6 }, "Оплата картой и телефоном", "люди уходят: картой платить нельзя"),
  u("baker", "Нанять пекаря", "staff", "staff", 9000, { guests: 10, rating: 0.3 }, "Ночная смена — к утру всё горячее", "к открытию ничего не готово, нужен пекарь", { requires: ["oven"] }),
  u("croissants", "Круассаны", "product", "counter", 3000, { check: 40 }, "Слоёное тесто и сливочное масло", "все спрашивают круассаны", { requires: ["oven"] }),
  u("cakes", "Торты на заказ", "product", "counter", 6000, { check: 90, rating: 0.1 }, "Дни рождения и свадьбы", "нам звонят насчёт тортов, а мы отказываем", { requires: ["baker"] }),
  u("coffee-corner", "Кофе-уголок", "equipment", "counter", 5000, { check: 50, guests: 4 }, "Капучино к булочке", "булочку берут, а запить нечем"),
  u("bakery-tables", "Столики у окна", "furniture", "floor", 2500, { guests: 6, rating: 0.1 }, "Можно позавтракать на месте", "людям негде съесть круассан"),
  u("bakery-loyalty", "Карта постоянного гостя", "marketing", "counter", 2000, { guests: 5, rating: 0.1 }, "Каждый десятый батон — даром", "соседи ходят каждый день, а бонусов нет"),
  u("bakery-renovation", "Ремонт в стиле лофт", "furniture", "wall", 12000, { rating: 0.5, guests: 6 }, "Тёплый свет, дерево, мука на стенах", "у нас уныло, как в столовой", { minLevel: 2 }),
  u("bakery-delivery", "Доставка утренней выпечки", "staff", "street", 10000, { guests: 14, check: 20 }, "Свежий хлеб к завтраку соседей", "соседи просят привозить хлеб утром", { minLevel: 2, requires: ["baker"] }),
  u("bakery-kiosk", "Островок в ТЦ", "furniture", "annex", 35000, { guests: 35, rating: 0.1 }, "Второй филиал — шаг к сети", "в ТЦ напротив нет нормальной пекарни", { minLevel: 2, requires: ["bakery-renovation"] }),
  u("stone-oven", "Каменная печь", "equipment", "counter", 22000, { check: 70, rating: 0.4 }, "Эксклюзив от инвестора: хлеб на камне", "на камне хлеб в разы вкуснее", { requires: ["oven"], exclusive: true }),
  u("sourdough", "Хлеб на закваске", "premium", "counter", 4000, { rating: 0.4, check: 20 }, "Закваске пять лет — гордость пекарни", "хлебные гурманы ищут закваску", { requires: ["oven"], premium: true }),
  u("bakery-neon", "Неон «Хлеб»", "premium", "wall", 3000, { guests: 10 }, "Светится зелёным с утра", "утром темно, нас не видно", { requires: ["bakery-sign"], premium: true }),
];

// ── Барбершоп ──
const BARBER: UpgradeDef[] = [
  u("barber-chair", "Барбер-кресло", "furniture", "floor", 6000, { guests: 2, rating: 0.2 }, "Гидравлика, кожа, поворот на 360°", "клиенты стригутся на табуретке — несолидно"),
  u("mirror", "Зеркала с подсветкой", "furniture", "wall", 3000, { rating: 0.2, check: 50 }, "Видно каждую линию фейда", "клиенты не видят, что получилось"),
  u("clippers", "Профессиональные машинки", "equipment", "counter", 4000, { rating: 0.3, check: 80 }, "Ровный фейд с первого раза", "машинка тянет волосы, клиенты морщатся"),
  u("barber-sign", "Вывеска с шестом", "marketing", "wall", 2500, { guests: 2 }, "Красно-белый шест крутится у двери", "нас не находят даже с картой"),
  u("sofa", "Диван для ожидания", "furniture", "floor", 3500, { guests: 1, rating: 0.2 }, "Клиенты ждут с комфортом", "клиенты ждут стоя и уходят"),
  u("booking", "Онлайн-запись", "tech", "screen", 3000, { guests: 2, rating: 0.1 }, "Запись в два клика", "клиенты не дозваниваются и уходят к конкурентам"),
  u("barber", "Нанять барбера", "staff", "staff", 9000, { guests: 3, rating: 0.2 }, "Второй мастер — вдвое больше записей", "запись забита на неделю вперёд", { requires: ["barber-chair"] }),
  u("cosmetics", "Полка с косметикой", "product", "wall", 4000, { check: 150 }, "Воск, масло для бороды, шампуни", "клиенты спрашивают, чем укладывать дома"),
  u("beard", "Уход за бородой", "product", "counter", 3500, { check: 120, rating: 0.1 }, "Горячее полотенце и бритьё опасной бритвой", "бородачи уходят без моделирования", { requires: ["clippers"] }),
  u("barber-music", "Акустика и плейлист", "equipment", "wall", 2500, { rating: 0.2 }, "Хип-хоп и джаз в правильной громкости", "в зале тишина, неловко"),
  u("coffee-bar", "Кофе для клиентов", "equipment", "counter", 3000, { rating: 0.2, guests: 1 }, "Эспрессо, пока ждёшь", "в ожидании нечем заняться"),
  u("barber-insta", "Портфолио в соцсетях", "marketing", "screen", 4000, { guests: 3 }, "До/после — лучшая реклама", "о наших фейдах никто не знает"),
  u("barber-renovation", "Ремонт в стиле индастриал", "furniture", "wall", 14000, { rating: 0.5, guests: 2 }, "Кирпич, металл и тёплый свет", "у нас как в парикмахерской 90-х", { minLevel: 2 }),
  u("kids-chair", "Детское кресло-машинка", "furniture", "floor", 5000, { guests: 2, check: 50 }, "Папы приходят с сыновьями", "папы спрашивают, стрижём ли мы детей", { minLevel: 2 }),
  u("barber-academy", "Обучение мастеров", "staff", "staff", 12000, { rating: 0.4, check: 100 }, "Мастер-классы и повышение квалификации", "мастера стригут по-старому", { minLevel: 2, requires: ["barber"] }),
  u("barber-branch", "Второй барбершоп", "furniture", "annex", 45000, { guests: 8, rating: 0.1 }, "Новая точка в соседнем районе", "к нам едут через весь город — пора открыть вторую точку", { minLevel: 2, requires: ["barber-renovation"] }),
  u("vip-room", "VIP-кабинет", "furniture", "annex", 20000, { check: 300, rating: 0.3 }, "Эксклюзив от инвестора: отдельный зал с виски-баром", "солидные клиенты хотят приватности", { requires: ["barber-chair"], exclusive: true }),
  u("gold-chair", "Золотое кресло", "premium", "floor", 6000, { rating: 0.4, check: 100 }, "Винтажное кресло, которое фотографируют", "нам не хватает фишки для фото", { requires: ["barber-chair"], premium: true }),
  u("barber-neon", "Неон «Fade»", "premium", "wall", 3000, { guests: 2 }, "Зелёный неон в витрине", "вечером витрина тёмная", { requires: ["barber-sign"], premium: true }),
];

// ── Онлайн-магазин ──
const SHOP: UpgradeDef[] = [
  u("site", "Сайт магазина", "tech", "screen", 3000, { guests: 6 }, "Своя витрина в интернете", "без сайта нас никто не найдёт"),
  u("photos", "Фото товаров", "marketing", "screen", 2500, { guests: 4, rating: 0.2 }, "Студийные фото на белом фоне", "товары сняты на телефон — выглядит дёшево"),
  u("payment", "Онлайн-оплата", "tech", "screen", 2000, { guests: 4, check: 80 }, "Карта, СБП, рассрочка", "покупатели уходят на шаге оплаты", { requires: ["site"] }),
  u("stock", "Закупка ассортимента", "product", "floor", 6000, { check: 200, guests: 3 }, "Больше товаров — больше чек", "ассортимент маленький, покупать нечего"),
  u("packaging", "Фирменная упаковка", "product", "floor", 2500, { rating: 0.3 }, "Коробка, которую не стыдно подарить", "товар приходит в мятом пакете"),
  u("shop-courier", "Курьерская доставка", "staff", "street", 4000, { guests: 5, rating: 0.2 }, "Доставка в день заказа", "доставка идёт неделю — покупатели злятся"),
  u("support-chat", "Чат поддержки", "tech", "screen", 2500, { rating: 0.3 }, "Отвечаем за пять минут", "на вопросы никто не отвечает"),
  u("manager", "Менеджер по заказам", "staff", "staff", 8000, { guests: 6, rating: 0.2 }, "Заказы собираются вовремя", "мы путаем заказы", { requires: ["stock"] }),
  u("shop-ads", "Таргетированная реклама", "marketing", "screen", 5000, { guests: 12 }, "Реклама там, где ваши покупатели", "трафика почти нет"),
  u("shop-seo", "SEO", "marketing", "screen", 4500, { guests: 9 }, "Первые строчки поиска", "в поиске мы на десятой странице", { requires: ["site"] }),
  u("reviews", "Сбор отзывов", "marketing", "screen", 2000, { rating: 0.4 }, "Отзывы с фото после покупки", "без отзывов нам не доверяют"),
  u("warehouse", "Мини-склад", "infra", "annex", 12000, { check: 150, guests: 6 }, "Свои полки вместо коридора", "товар лежит дома в коридоре", { minLevel: 2, requires: ["stock"] }),
  u("mobile-site", "Мобильная версия", "tech", "screen", 4000, { guests: 8 }, "Удобно покупать с телефона", "70% заходят с телефона, а сайт кривой", { requires: ["site"] }),
  u("marketplace", "Выход на маркетплейс", "marketing", "cloud", 15000, { guests: 25 }, "Карточки на крупной площадке", "все ищут товары на маркетплейсах", { minLevel: 2, requires: ["photos"] }),
  u("crm", "CRM и рассылки", "tech", "screen", 6000, { guests: 6, rating: 0.2 }, "Возвращаем покупателей письмами", "покупатели покупают один раз и пропадают", { minLevel: 2 }),
  u("pickup-point", "Свой пункт выдачи", "infra", "annex", 35000, { guests: 20, rating: 0.2 }, "Второй филиал: офлайн-точка", "покупатели хотят забрать сами", { minLevel: 2, requires: ["warehouse"] }),
  u("own-brand", "Собственный бренд", "product", "floor", 22000, { check: 300, rating: 0.3 }, "Эксклюзив от инвестора: своя линейка товаров", "свой бренд — и маржа другая", { requires: ["stock"], exclusive: true }),
  u("shop-premium-theme", "Премиум-тема витрины", "premium", "screen", 4000, { rating: 0.3, guests: 4 }, "Анимации, тёмная тема, видеообложки", "витрина выглядит как у всех", { requires: ["site"], premium: true }),
  u("gift-box", "Подарочные боксы", "premium", "floor", 5000, { check: 250 }, "Наборы к праздникам", "перед праздниками спрашивают подарки", { premium: true }),
];

const IT_LABELS = (guests: string, guestsShort: string, check: string, noun: string): MetricLabels => ({ guests, guestsShort, check, revenue: "Выручка дня (MRR/30)", noun });

// ── Веб-студия ──
const WEB: UpgradeDef[] = [
  u("laptops", "Ноутбуки", "equipment", "desk", 6000, { guests: 1, rating: 0.2, bugs: -1 }, "Мощные ноутбуки вместо старого ПК", "сборка проекта идёт полчаса"),
  u("web-portfolio", "Сайт-портфолио", "marketing", "screen", 3000, { guests: 1, rating: 0.2 }, "Кейсы, которыми не стыдно хвастаться", "клиенты просят показать работы"),
  u("designer", "Дизайнер", "staff", "staff", 9000, { check: 1500, rating: 0.3 }, "Красивые макеты продают сами", "наши макеты выглядят как 2010 год", { requires: ["laptops"] }),
  u("frontend-dev", "Фронтенд-разработчик", "staff", "staff", 10000, { guests: 1, check: 1000, bugs: 1 }, "Вёрстка и анимации", "мы не успеваем верстать", { requires: ["laptops"] }),
  u("backend-dev", "Бэкенд-разработчик", "staff", "staff", 11000, { check: 1800, bugs: 1 }, "Сложные проекты с личным кабинетом", "клиенты хотят личный кабинет, а мы не умеем", { requires: ["laptops"] }),
  u("qa", "Тестировщик (QA)", "staff", "staff", 8000, { bugs: -4, rating: 0.3 }, "Баги ловим до клиента", "клиенты присылают скриншоты багов"),
  u("project-manager", "Проджект-менеджер", "staff", "staff", 9000, { guests: 1, rating: 0.3, churn: -0.02 }, "Сроки и созвоны под контролем", "мы срываем дедлайны"),
  u("social-ads", "Реклама в соцсетях", "marketing", "screen", 4000, { guests: 2 }, "Заявки от малого бизнеса", "заявок мало, о нас не знают"),
  u("seo", "SEO", "marketing", "screen", 4500, { guests: 1, churn: -0.01 }, "Студию находят в поиске", "в поиске нас нет"),
  u("crm", "CRM", "tech", "screen", 4000, { churn: -0.02, rating: 0.1 }, "Ни одна заявка не теряется", "заявки теряются в мессенджерах"),
  u("figma-pro", "Подписки на инструменты", "tech", "desk", 2500, { check: 500, bugs: -1 }, "Figma, хостинг, мониторинг", "работаем на бесплатных тарифах"),
  u("test-server", "Тестовый сервер", "infra", "server", 5000, { bugs: -2 }, "Показываем клиенту до релиза", "правим прямо на живом сайте"),
  u("office", "Офис", "furniture", "floor", 15000, { guests: 1, rating: 0.4 }, "Встречи с клиентами не в кафе", "клиентов стыдно звать на созвон из кухни", { minLevel: 2 }),
  u("web-awards", "Участие в конкурсах", "marketing", "wall", 6000, { guests: 2, check: 1000 }, "Награды поднимают цену часа", "крупные клиенты нас не воспринимают", { minLevel: 2, requires: ["designer"] }),
  u("support-plan", "Тарифы поддержки", "product", "cloud", 7000, { churn: -0.03, check: 800 }, "Клиенты остаются на абонементе", "после сдачи проекта клиенты пропадают", { minLevel: 2, requires: ["backend-dev"] }),
  u("web-branch", "Второй офис", "furniture", "annex", 40000, { guests: 3, check: 1500 }, "Филиал в другом городе", "нам пишут из Казани и Новосибирска", { minLevel: 2, requires: ["office"] }),
  u("awards-case", "Кейс года", "marketing", "wall", 20000, { check: 2500, rating: 0.3 }, "Эксклюзив от инвестора: громкий кейс для крупного бренда", "большой бренд — и мы в топе рейтингов", { requires: ["designer"], exclusive: true }),
  u("motion-designer", "Моушн-дизайнер", "premium", "staff", 7000, { check: 1200, rating: 0.3 }, "Анимации, от которых клиенты в восторге", "сайты без анимаций — скучно", { requires: ["designer"], premium: true }),
  u("dark-office", "Офис в стиле «зелёный неон»", "premium", "wall", 5000, { rating: 0.4 }, "Фирменный интерьер для сторис", "нам нужен вайб", { premium: true }),
];

// ── Мобильное приложение ──
const APP: UpgradeDef[] = [
  u("app-laptops", "Ноутбуки для команды", "equipment", "desk", 6000, { bugs: -2, rating: 0.1 }, "Сборка за минуту, а не за десять", "эмулятор тормозит, мы теряем время"),
  u("app-designer", "UI/UX-дизайнер", "staff", "staff", 9000, { guests: 8, rating: 0.3, churn: -0.02 }, "Понятный интерфейс — меньше удалений", "пользователи не находят кнопку «далее»"),
  u("ios-dev", "iOS-разработчик", "staff", "staff", 11000, { guests: 12, check: 4, bugs: 1 }, "Нативное приложение для iPhone", "половина рынка — айфоны, а нас там нет", { requires: ["app-laptops"] }),
  u("android-dev", "Android-разработчик", "staff", "staff", 10000, { guests: 14, bugs: 1 }, "Приложение для Android", "андроид-пользователи пишут «когда?»", { requires: ["app-laptops"] }),
  u("app-backend", "Бэкенд-разработчик", "staff", "staff", 11000, { check: 3, churn: -0.02, bugs: 1 }, "Синхронизация, аккаунты, пуши", "данные теряются при переустановке"),
  u("app-qa", "QA-инженер", "staff", "staff", 8000, { bugs: -5, rating: 0.3 }, "Краши ловим до релиза", "в отзывах «вылетает при запуске»"),
  u("app-server", "Сервер API", "infra", "server", 6000, { churn: -0.02, bugs: -1 }, "Свой сервер вместо бесплатного тарифа", "API отваливается к вечеру"),
  u("analytics", "Аналитика", "tech", "screen", 3000, { churn: -0.02, rating: 0.1 }, "Видим, где пользователи уходят", "не понимаем, почему удаляют приложение"),
  u("push", "Пуш-уведомления", "tech", "screen", 2500, { churn: -0.03 }, "Напоминаем о себе вовремя", "пользователи забывают про приложение", { requires: ["app-backend"] }),
  u("app-social-ads", "Реклама в соцсетях", "marketing", "screen", 5000, { guests: 18 }, "Установки из сторис и клипов", "установок почти нет"),
  u("aso", "ASO (оптимизация в сторах)", "marketing", "screen", 3500, { guests: 10 }, "Ключевые слова и скриншоты", "нас не находят в поиске сторов"),
  u("appstore-launch", "Запуск в App Store", "marketing", "cloud", 8000, { guests: 25, rating: 0.2 }, "Публикация и фичеринг", "мы до сих пор в тестфлайте", { requires: ["ios-dev"] }),
  u("subscriptions", "Подписка Premium", "product", "cloud", 6000, { check: 8, churn: 0.01 }, "Платные функции раз в месяц", "все функции бесплатные — денег ноль", { minLevel: 2 }),
  u("app-office", "Офис", "furniture", "floor", 15000, { rating: 0.3, bugs: -1 }, "Команда в одной комнате", "созвоны вместо разговоров — всё медленнее", { minLevel: 2 }),
  u("app-support", "Поддержка в приложении", "staff", "staff", 6000, { churn: -0.03, rating: 0.2 }, "Отвечаем прямо в чате", "в сторе одни гневные отзывы", { minLevel: 2 }),
  u("app-v2", "Версия 2.0", "product", "annex", 40000, { guests: 40, check: 4, rating: 0.2 }, "Большое обновление — как второй продукт", "конкуренты выкатили редизайн — нам нужен 2.0", { minLevel: 2, requires: ["app-office"] }),
  u("ai-feature", "ИИ-функция", "tech", "cloud", 22000, { guests: 20, check: 5, rating: 0.3 }, "Эксклюзив от инвестора: умная функция на нейросети", "все пишут про ИИ — нам нужна своя фишка", { requires: ["app-backend"], exclusive: true }),
  u("app-icon-pack", "Набор иконок приложения", "premium", "screen", 3000, { guests: 6, rating: 0.2 }, "Альтернативные иконки на выбор", "пользователи любят кастомизацию", { premium: true }),
  u("dark-theme", "Тёмная тема", "premium", "screen", 4000, { rating: 0.4, churn: -0.01 }, "Глаза скажут спасибо", "в отзывах просят тёмную тему", { premium: true }),
];

// ── SaaS-стартап ──
const SAAS: UpgradeDef[] = [
  u("saas-laptops", "Ноутбуки", "equipment", "desk", 6000, { bugs: -1, rating: 0.1 }, "Рабочие машины для команды", "старый ноутбук перегревается"),
  u("cloud-servers", "Облачные серверы", "infra", "server", 7000, { guests: 2, churn: -0.02, bugs: -1 }, "Автомасштабирование и бэкапы", "сервис падает при наплыве клиентов"),
  u("saas-backend", "Бэкенд-разработчик", "staff", "staff", 11000, { check: 60, bugs: 1 }, "Новые функции каждую неделю", "клиенты ждут функции месяцами", { requires: ["saas-laptops"] }),
  u("saas-frontend", "Фронтенд-разработчик", "staff", "staff", 10000, { guests: 2, rating: 0.2, bugs: 1 }, "Удобный интерфейс дашборда", "интерфейс запутанный", { requires: ["saas-laptops"] }),
  u("saas-designer", "Продуктовый дизайнер", "staff", "staff", 9000, { rating: 0.3, churn: -0.02 }, "Онбординг, который понимают с первого раза", "клиенты бросают на онбординге"),
  u("saas-qa", "QA-инженер", "staff", "staff", 8000, { bugs: -4, rating: 0.3 }, "Автотесты и регресс", "каждый релиз что-то ломает"),
  u("landing", "Лендинг", "marketing", "screen", 3000, { guests: 2 }, "Понятно, что продаём", "люди не понимают, что мы делаем"),
  u("saas-seo", "SEO и блог", "marketing", "screen", 4500, { guests: 2, churn: -0.01 }, "Статьи, которые приводят клиентов", "в поиске по нашей теме одни конкуренты", { requires: ["landing"] }),
  u("saas-social-ads", "Реклама в соцсетях", "marketing", "screen", 5000, { guests: 3 }, "Триалы из рекламы", "триалов мало"),
  u("saas-crm", "CRM", "tech", "screen", 4000, { churn: -0.02, check: 20 }, "Воронка продаж под контролем", "лиды теряются, никто им не перезванивает"),
  u("trial", "Бесплатный пробный период", "product", "cloud", 3000, { guests: 3, churn: 0.01 }, "14 дней бесплатно", "платить сразу никто не хочет"),
  u("billing", "Автоматический биллинг", "tech", "cloud", 4000, { check: 40, churn: -0.01 }, "Подписки списываются сами", "мы выставляем счета вручную"),
  u("integrations", "Интеграции", "tech", "cloud", 8000, { guests: 2, check: 50 }, "Подключение к 1С, почте и мессенджерам", "клиенты спрашивают интеграцию"),
  u("sales-manager", "Менеджер по продажам", "staff", "staff", 9000, { guests: 3, check: 40 }, "Демо и закрытие сделок", "демо проводит CTO, а надо кодить", { minLevel: 2 }),
  u("customer-success", "Customer Success", "staff", "staff", 8000, { churn: -0.03, rating: 0.2 }, "Помогаем клиентам добиться результата", "клиенты уходят через месяц", { minLevel: 2 }),
  u("saas-office", "Офис", "furniture", "floor", 15000, { rating: 0.3, bugs: -1 }, "Место для команды и встреч", "мы работаем из кофеен", { minLevel: 2 }),
  u("saas-region", "Выход на новый рынок", "marketing", "annex", 40000, { guests: 8, check: 60 }, "Второй регион — второй рост", "к нам приходят из Казахстана и Беларуси", { minLevel: 2, requires: ["integrations"] }),
  u("enterprise-plan", "Enterprise-тариф", "product", "cloud", 22000, { check: 150, churn: -0.02 }, "Эксклюзив от инвестора: крупные клиенты", "крупные компании хотят SLA", { requires: ["saas-backend"], exclusive: true }),
  u("saas-status-page", "Статус-страница", "premium", "screen", 3000, { rating: 0.3, churn: -0.01 }, "Прозрачный аптайм", "при сбое клиенты не знают, что происходит", { premium: true }),
  u("saas-ai-assistant", "ИИ-ассистент", "premium", "cloud", 6000, { check: 50, rating: 0.2 }, "Подсказки внутри продукта", "клиенты просят умного помощника", { premium: true }),
];

export const KINDS: Record<BizKind, KindDef> = {
  coffee: {
    kind: "coffee", title: "Кофейня", template: "offline", emoji: "☕", available: true, blurb: "От ларька с термосом до сети кофеен",
    levels: ["Ларёк", "Кофейня", "Сеть"], base: { guests: 15, check: 150, churn: 0, bugs: 0 }, labels: OFFLINE_LABELS,
    levelRules: [["chairs", "tables", "machine", "sign"], ["hall2", "delivery"]], catalog: COFFEE,
  },
  bakery: {
    kind: "bakery", title: "Пекарня", template: "offline", emoji: "🥐", available: true, blurb: "От печки у дома до сети пекарен",
    levels: ["Пекарня у дома", "Пекарня", "Сеть пекарен"], base: { guests: 12, check: 180, churn: 0, bugs: 0 }, labels: OFFLINE_LABELS,
    levelRules: [["oven", "bakery-showcase", "bakery-sign", "cashbox"], ["bakery-kiosk", "bakery-delivery"]], catalog: BAKERY,
  },
  barber: {
    kind: "barber", title: "Барбершоп", template: "offline", emoji: "💈", available: true, blurb: "Кресло, машинка и очередь из постоянных",
    levels: ["Кресло", "Барбершоп", "Сеть"], base: { guests: 4, check: 900, churn: 0, bugs: 0 }, labels: { ...OFFLINE_LABELS, guests: "Клиентов в день", guestsShort: "клиентов", noun: "клиентов" },
    levelRules: [["barber-chair", "mirror", "clippers", "barber-sign"], ["barber-branch", "barber-academy"]], catalog: BARBER,
  },
  shop: {
    kind: "shop", title: "Онлайн-магазин", template: "online", emoji: "🛍️", available: true, blurb: "От пары товаров до своего склада",
    levels: ["Витрина", "Магазин", "Маркетплейс"], base: { guests: 10, check: 1200, churn: 0, bugs: 0 },
    labels: { guests: "Покупателей в день", guestsShort: "покупателей", check: "Средний чек", revenue: "Выручка дня", noun: "покупателей" },
    levelRules: [["site", "photos", "payment", "stock"], ["marketplace", "pickup-point"]], catalog: SHOP,
  },
  webstudio: {
    kind: "webstudio", title: "Веб-студия", template: "it", emoji: "💻", available: true, blurb: "От фрилансера до студии с офисом",
    levels: ["Фриланс", "Студия", "Агентство"], base: { guests: 2, check: 6000, churn: 0.08, bugs: 6 }, labels: IT_LABELS("Заявок клиентов в день", "клиентов", "Средний чек проекта", "клиентов"),
    levelRules: [["laptops", "web-portfolio", "designer", "qa"], ["web-branch", "support-plan"]], catalog: WEB,
  },
  app: {
    kind: "app", title: "Мобильное приложение", template: "it", emoji: "📱", available: true, blurb: "От прототипа до приложения в топе стора",
    levels: ["Прототип", "Приложение", "Топ стора"], base: { guests: 40, check: 12, churn: 0.15, bugs: 10 }, labels: IT_LABELS("Активных пользователей", "пользователей", "ARPU", "пользователей"),
    levelRules: [["app-laptops", "app-designer", "ios-dev", "app-qa"], ["app-v2", "appstore-launch"]], catalog: APP,
  },
  saas: {
    kind: "saas", title: "SaaS-стартап", template: "it", emoji: "☁️", available: true, blurb: "От MVP до сервиса с подписками",
    levels: ["MVP", "Стартап", "Скейл-ап"], base: { guests: 6, check: 300, churn: 0.1, bugs: 8 }, labels: IT_LABELS("Активных клиентов", "клиентов", "ARPU", "клиентов"),
    levelRules: [["saas-laptops", "cloud-servers", "saas-backend", "landing"], ["saas-region", "customer-success"]], catalog: SAAS,
  },
};

// ── Unique challenge rewards (ids prefixed "ch-"): work in every business type, can't be bought ──
const ch = (id: string, title: string, slot: SlotHint, effect: Effect, blurb: string, source: "biz" | "social", challengeId: string): UpgradeDef => ({
  id, title, blurb, category: "decor", slot, price: 0, effect, hint: "", challenge: { source, id: challengeId },
});
export const CHALLENGE_ITEMS: UpgradeDef[] = [
  ch("ch-no-delivery", "Кубок «Неделя без доставки»", "wall", { rating: 0.1 }, "Золотой кубок на полке — за неделю без доставки", "biz", "nodelivery"),
  ch("ch-home-coffee", "Термокружка основателя", "counter", { rating: 0.1 }, "Кофе из дома, а сэкономленное — в копилку", "biz", "nocoffee"),
  ch("ch-no-subs", "Табличка «Минус подписка»", "wall", { rating: 0.05, guests: 1 }, "Отменили лишнее — бизнес стал легче", "biz", "nosubs"),
  ch("ch-big-week", "Зелёная копилка-статуя", "floor", { rating: 0.15, guests: 2 }, "Памятник большой неделе накоплений", "biz", "bigweek"),
  ch("ch-spend-notebook", "Блокнот трат в рамке", "wall", { rating: 0.1 }, "Неделя учёта трат — на стене как диплом", "social", "spend-notebook"),
  ch("ch-no-delivery-week", "Домашний ланч-бокс", "counter", { rating: 0.1 }, "Готовим сами — экономим вместе", "social", "no-delivery-week"),
  ch("ch-interview-five", "Доска с интервью", "wall", { rating: 0.1, guests: 1 }, "Пять разговоров с клиентами — и идея крепче", "social", "interview-five"),
  ch("ch-compare-deposits", "Сравнительная таблица ставок", "wall", { rating: 0.05 }, "Подушка выбрана с умом", "social", "compare-deposits"),
  ch("ch-sell-avito", "Коробка «Продано!»", "floor", { guests: 2 }, "Первая продажа — на память", "social", "sell-avito"),
  ch("ch-budget-50-30-20", "Пирог-диаграмма 50/30/20", "wall", { rating: 0.1 }, "Бюджет разложен по полочкам", "social", "budget-50-30-20"),
  ch("ch-debt-list", "Сломанная цепь долгов", "wall", { rating: 0.1 }, "План погашения висит на видном месте", "social", "debt-list"),
  ch("ch-first-bond", "Глобус инвестора", "counter", { rating: 0.1 }, "Изучил ОФЗ — знаешь, как работают деньги", "social", "first-bond"),
  ch("ch-ask-raise", "Галстук переговорщика", "staff", { rating: 0.1, guests: 1 }, "Подготовил разговор о повышении", "social", "ask-raise"),
  ch("ch-landing-day", "Неоновый лендинг в витрине", "window", { guests: 2 }, "Лендинг за вечер — теперь и у бизнеса", "social", "landing-day"),
  ch("ch-ai-routine", "Робот-помощник", "counter", { rating: 0.1 }, "Рутина автоматизирована", "social", "ai-routine"),
  ch("ch-unit-economics-shop", "Калькулятор юнит-экономики", "counter", { rating: 0.1 }, "Считаешь как владелец", "social", "unit-economics-shop"),
  ch("ch-crypto-safety", "Сейф с двумя замками", "floor", { rating: 0.1 }, "Аккаунты под защитой", "social", "crypto-safety"),
];
export const challengeItemFor = (source: "biz" | "social", challengeId: string) => CHALLENGE_ITEMS.find((x) => x.challenge!.source === source && x.challenge!.id === challengeId) ?? null;
export const isChallengeItem = (id: string) => id.startsWith("ch-");

export const BIZ_KIND_IDS = Object.keys(KINDS) as [BizKind, ...BizKind[]];
export const TEMPLATE_TITLES: Record<Template, string> = { offline: "Офлайн", online: "Онлайн", it: "IT" };

export const isKind = (k: string): k is BizKind => k in KINDS;
export const kindOf = (k: string): KindDef => KINDS[isKind(k) ? k : "coffee"];
export const itemOf = (kind: string, id: string) => (isChallengeItem(id) ? CHALLENGE_ITEMS.find((x) => x.id === id) : kindOf(kind).catalog.find((x) => x.id === id)) ?? null;

// ── Pro «Свой бизнес»: skins ──
export const ACCENTS = ["#1b8f60", "#12b76a", "#0b7a4b", "#3fbf7f", "#5fd39a", "#0e5c3c"] as const;
export const LOGOS = ["☕", "🥐", "💈", "🛍️", "💻", "📱", "☁️", "🌱", "🍀", "🐷", "🚀", "🎧", "🍕", "🌮", "🧁", "🎨", "📚", "🏋️", "🌿", "💡"] as const;

/** Clean catalog for the scene renderer and other consumers. */
export interface CatalogEntry {
  id: string;
  name: string;
  category: ItemCategory;
  slot: SlotHint;
  price: number;
  pro?: boolean;
  exclusive?: boolean;
  /** Unique challenge reward: render with the "за челлендж" badge. */
  challenge?: boolean;
}
export interface CatalogType {
  kind: BizKind;
  title: string;
  template: Template;
  emoji: string;
  levels: string[];
  items: CatalogEntry[];
}

const entry = (x: UpgradeDef): CatalogEntry => ({
  id: x.id, name: x.title, category: x.category, slot: x.slot, price: x.price,
  ...(x.premium ? { pro: true } : {}), ...(x.exclusive ? { exclusive: true } : {}), ...(x.challenge ? { challenge: true } : {}),
});

export function catalogFor(kind: string): CatalogType {
  const k = kindOf(kind);
  return {
    kind: k.kind,
    title: k.title,
    template: k.template,
    emoji: k.emoji,
    levels: k.levels,
    items: [...k.catalog, ...CHALLENGE_ITEMS].map(entry),
  };
}

export const CATALOG: CatalogType[] = BIZ_KIND_IDS.map(catalogFor);
