import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

const TEXT = {
  invest:
    "Образовательный материал, не индивидуальная инвестиционная рекомендация. Инвестиции и криптовалюты связаны с риском: вы можете потерять часть или все вложенные деньги, доходность в прошлом не гарантирует её в будущем. Решения вы принимаете самостоятельно и на свой риск.",
  ai: "$PIG — ИИ-помощник. Он может ошибаться и не является финансовым, юридическим или налоговым консультантом. Проверяйте важные цифры и принимайте решения самостоятельно.",
  challenge:
    "Челленджи — образовательные задания. Ничего не покупайте и не открывайте ради награды: можно выполнить задание «на бумаге». Любые реальные финансовые действия вы совершаете сами и на свой риск, PìgBiz за их результат не отвечает.",
  general: "Материалы PìgBiz носят образовательный характер и не являются индивидуальной финансовой, инвестиционной, налоговой или юридической консультацией.",
} as const;

export type DisclaimerKind = keyof typeof TEXT;

/** Risk notice shown next to money-related content. */
export function Disclaimer({ kind = "general", compact = false }: { kind?: DisclaimerKind; compact?: boolean }) {
  return (
    <aside className={`disclaimer ${compact ? "is-compact" : ""}`} role="note" data-testid={`disclaimer-${kind}`}>
      <Icon name="alert" size="sm" />
      <span>
        {TEXT[kind]} <Link href="/terms">Подробнее</Link>
      </span>
    </aside>
  );
}

/** Categories whose materials get the investment risk notice. */
export const RISKY_CATEGORIES = new Set(["investing", "crypto", "finance"]);
