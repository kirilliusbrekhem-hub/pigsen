// Deterministic spending categories. Pure: shared by server and the parser tests.
import type { Tx } from "./parse";

export const CATEGORIES = [
  { id: "delivery", label: "Доставка еды" },
  { id: "subs", label: "Подписки" },
  { id: "marketplaces", label: "Маркетплейсы" },
  { id: "taxi", label: "Такси" },
  { id: "cafe", label: "Кафе и рестораны" },
  { id: "groceries", label: "Продукты" },
  { id: "transport", label: "Транспорт" },
  { id: "utilities", label: "ЖКХ и связь" },
  { id: "health", label: "Здоровье" },
  { id: "clothes", label: "Одежда и обувь" },
  { id: "fun", label: "Развлечения" },
  { id: "cash", label: "Наличные" },
  { id: "transfers", label: "Переводы" },
  { id: "other", label: "Прочее" },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? "Прочее";

// Order matters: the first match wins (delivery before groceries, so «Самокат» is delivery).
const RULES: { id: CategoryId; re: RegExp; mcc?: RegExp }[] = [
  { id: "delivery", re: /яндекс\s?еда|yandex\s?eda|eda\.yandex|delivery\s?club|самокат|samokat|купер|kuper|сбермаркет|sbermarket|доставк|delivery|лавка|lavka/i },
  { id: "subs", re: /подписк|subscription|яндекс\s?плюс|yandex\s?plus|плюс\s?мульти|кинопоиск|kinopoisk|\bivi\b|okko|netflix|spotify|apple\.com|itunes|google\s?play|youtube|vk\s?(музык|combo)|boom|литрес|litres|start\.ru|premier|wink|chatgpt|openai|телеграм\s?премиум|telegram\s?premium|цифров/i, mcc: /^(5815|5816|5817|5818|4899)$/ },
  { id: "marketplaces", re: /wildberries|вайлдберри|\bwb\b|ozon|озон|яндекс\s?маркет|market\.yandex|aliexpress|алиэкспресс|lamoda|ламода|мегамаркет|megamarket|маркетплейс/i },
  { id: "taxi", re: /такси|taxi|uber|яндекс\s?go|yandex\s?go|yandex\.go|ситимобил|citymobil|максим/i, mcc: /^4121$/ },
  { id: "cafe", re: /кафе|cafe|ресторан|restaurant|кофе|coffee|cofix|шоколадниц|макдон|вкусно\s?(и|—|-)\s?точка|\bkfc\b|ростикс|rostic|бургер|burger|starbucks|додо|пицц|pizza|суши|sushi|шаурм|столов|\bбар\b|\bbar\b|фастфуд|fast\s?food|кофейн/i, mcc: /^(5812|5813|5814)$/ },
  { id: "groceries", re: /пят[её]рочк|pyaterochka|магнит|magnit|перекр[её]ст|perekrestok|ашан|auchan|лента|lenta|вкусвилл|vkusvill|дикси|dixy|азбука\s?вкуса|\bmetro\b|окей|o'key|spar|супермаркет|продукт|гипермаркет|светофор|fix\s?price|фикс\s?прайс/i, mcc: /^(5411|5422|5441|5451|5462|5499)$/ },
  { id: "transport", re: /метро|metro\s?moscow|тройка|мосметро|ржд|аэрофлот|aeroflot|автобус|транспорт|бензин|азс|лукойл|lukoil|газпромнефть|роснефть|shell|парковк|каршеринг|делимобиль|ситидрайв/i, mcc: /^(4111|4112|4131|5541|5542|7523)$/ },
  { id: "utilities", re: /жкх|коммунал|мосэнерго|электроэнерг|водоканал|\bмтс\b|\bmts\b|билайн|beeline|мегафон|megafon|теле2|tele2|ростелеком|интернет|связь|квартплат/i, mcc: /^(4814|4900)$/ },
  { id: "health", re: /аптек|apteka|клиник|стоматол|медицин|здоров|ригла|горздрав|36[.,]6|анализ/i, mcc: /^(5912|8011|8021|8062|8071|8099)$/ },
  { id: "clothes", re: /zara|h&m|uniqlo|спортмастер|sportmaster|одежд|обув|gloria\s?jeans|befree|\blime\b|ostin|остин/i, mcc: /^(5651|5661|5691|5699)$/ },
  { id: "fun", re: /кино|cinema|театр|концерт|steam|playstation|xbox|боулинг|развлеч|билет|игр/i, mcc: /^(7832|7922|7994|7996)$/ },
  { id: "cash", re: /снятие|банкомат|\batm\b|наличн/i, mcc: /^6011$/ },
  { id: "transfers", re: /перевод|transfer|\bсбп\b|card2card|с карты на карту/i },
];

export function categorize(tx: Pick<Tx, "description" | "bankCategory" | "mcc">): CategoryId {
  for (const r of RULES) if (r.re.test(tx.description)) return r.id;
  if (tx.mcc) for (const r of RULES) if (r.mcc?.test(tx.mcc)) return r.id;
  if (tx.bankCategory) for (const r of RULES) if (r.re.test(tx.bankCategory)) return r.id;
  return "other";
}

/** Merchant key for grouping: lowercased, digits and noise removed. */
export function merchantKey(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[0-9*#№]+/g, " ")
    .replace(/\b(ооо|ип|ао|пао|g|rus|moscow|москва|спб)\b/g, " ")
    .replace(/[^a-zа-яё& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}
