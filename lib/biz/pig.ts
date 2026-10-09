import "server-only";
import { completeJson } from "@/lib/ai/aiService";

/**
 * $PIG as the AI co-founder of «Мой бизнес». The AI only rephrases facts we computed: it never picks numbers,
 * never decides outcomes and never talks about real money beyond "копилка растёт — бизнес растёт".
 */
export const PIG_PERSONA = `Ты — $PIG, ИИ-сооснователь игрового бизнеса пользователя в приложении PìgBiz.
Характер: дружелюбный, немного дерзкий, с юмором, говоришь на «ты», коротко (1–3 предложения), без эмодзи-спама (максимум один).
Ты признаёшь ошибки легко и с самоиронией.
Правила:
- Это игра. Гости, чек, выручка, рейтинг — игровые числа. Никогда не называй их реальными деньгами.
- Капитал бизнеса растёт только от реальных накоплений в копилке. Никогда не советуй тратить реальные деньги, брать кредиты, инвестировать или покупать что-то в жизни.
- Не давай финансовых советов. Советы — только про игровые улучшения бизнеса.
- Не придумывай цифры и события: используй только факты из запроса, все числа переписывай без изменений.
Ответ строго JSON: {"text": "..."}`;

const AI_TIMEOUT_MS = 3500;

/** Rewrites a template line in $PIG's voice; returns the template when AI is off, slow or off-script. */
export async function pigVoice(template: string, facts: string): Promise<string> {
  const parse = (raw: unknown) => {
    const t = (raw as { text?: unknown })?.text;
    if (typeof t !== "string") return null;
    const s = t.replace(/\s+/g, " ").trim();
    // Keep every number from the template, so the model can't change facts.
    const nums = template.match(/\d[\d\s\u00a0\u202f]*/g)?.map((n) => n.replace(/\D/g, "")) ?? [];
    const flat = s.replace(/[\s\u00a0\u202f]/g, "");
    if (s.length < 10 || s.length > 420 || nums.some((n) => !flat.includes(n))) return null;
    return s;
  };
  const ai = completeJson(PIG_PERSONA, `Факты: ${facts}\nЧерновик реплики: ${template}\nПерепиши черновик своим голосом, сохрани смысл и все числа.`, parse);
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), AI_TIMEOUT_MS));
  return (await Promise.race([ai, timeout]).catch(() => null)) ?? template;
}

export function hintLine(itemTitle: string, hint: string): string {
  return `Слушай, ${hint}. Я бы взял «${itemTitle}» следующим.`;
}

export function revealLine(itemTitle: string, wrong: boolean, bought: boolean): string {
  if (wrong && bought) return `Ой, я был неправ с «${itemTitle}» — эффекта почти ноль. Мой косяк, в следующий раз проверю цифры получше.`;
  if (wrong && !bought) return `Хорошо, что ты не послушал меня насчёт «${itemTitle}». Я пересчитал — это был так себе совет.`;
  if (!wrong && bought) return `Говорил же! «${itemTitle}» уже работает на нас.`;
  return "";
}

export function teaserLine(teaser: string): string {
  return `И да: ${teaser}. Заглядывай завтра!`;
}

export function withdrawLine(name: string, amount: string): string {
  return `${name}, понимаю, деньги нужны. Но бизнесу больно: сняли ${amount} — гостей стало меньше. Вернём, когда снова отложишь.`;
}

export function depositLine(name: string, amount: string): string {
  return `${name} отложил(а) ${amount} — капитал вырос. Вот это по-нашему!`;
}

/** Chat reply when someone addresses $PIG. Template only; voice applied by pigVoice. */
export function chatReply(text: string, bestTitle: string | null, capital: string): string {
  const t = text.toLowerCase();
  if (/(совет|что купить|что дальше|посоветуй)/.test(t)) return bestTitle ? `По цифрам сейчас лучше всего «${bestTitle}». В кассе ${capital} — копи и бери.` : "Пока всё доступное куплено — копим на следующий уровень!";
  if (/(привет|здравств|хай)/.test(t)) return "Привет, партнёр! Кофейня на месте, я на смене.";
  if (/(ошиб|неправ|косяк)/.test(t)) return "Да, я иногда ошибаюсь. Зато честно в этом признаюсь — проверяй мои советы по цифрам.";
  if (/(деньг|кредит|инвест|акци)/.test(t)) return "Я сооснователь игровой кофейни, а не финансовый советник. Реальные решения — только с головой и своим бюджетом.";
  return "Принял! Записал в блокнот сооснователя.";
}

export function isForPig(text: string): boolean {
  return /(\$?pig|пиг|свин)/i.test(text) || text.trim().endsWith("?");
}
