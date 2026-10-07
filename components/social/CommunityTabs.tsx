import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export function CommunityTabs({ active }: { active: "feed" | "chat" }) {
  return (
    <nav className="cm-tabs" aria-label="Разделы комьюнити">
      <Link href="/community" className={`cm-tab ${active === "feed" ? "is-on" : ""}`} aria-current={active === "feed" ? "page" : undefined}>
        <Icon name="sparkle" size="sm" /> Лента успехов
      </Link>
      <Link href="/community/chat" className={`cm-tab ${active === "chat" ? "is-on" : ""}`} aria-current={active === "chat" ? "page" : undefined}>
        <Icon name="users" size="sm" /> Чаты по темам
      </Link>
      <Link href="/messages" className="cm-tab">
        <Icon name="message" size="sm" /> Сообщения
      </Link>
    </nav>
  );
}

export function ModerationNote() {
  return (
    <p className="muted cm-modnote">
      Будьте вежливы: без спама, рекламы и финансовых «сигналов». Нарушения удаляются. <Link href="/rules">Правила</Link>
    </p>
  );
}
