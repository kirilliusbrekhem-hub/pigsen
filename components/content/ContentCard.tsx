import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { formatDuration, TYPE_LABELS } from "@/lib/content/mappers";
import type { ContentCardDTO } from "@/types";
import { SaveButton } from "./SaveButton";

export function TypeAvatar({ type }: { type: ContentCardDTO["type"] }) {
  return (
    <span className={`type-av t-${type}`} aria-hidden="true">
      <Icon name={TYPE_LABELS[type].icon} />
    </span>
  );
}

export function ContentCard({ item, reason }: { item: ContentCardDTO; reason?: string }) {
  const t = TYPE_LABELS[item.type];
  return (
    <article className="card clickable c-card">
      <div className={`cover t-${item.type}`}>
        <span className="glyph">
          <Icon name={t.icon} />
        </span>
        <span className="kind">
          {t.one} · {item.category.name}
        </span>
      </div>
      <div className="body">
        <h3>
          <Link href={item.href}>{item.title}</Link>
        </h3>
        <p className="desc">{item.description}</p>
        {reason && (
          <span className="reason">
            <Icon name="sparkle" />
            {reason}
          </span>
        )}
        <div className="meta">
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.author} · {formatDuration(item.type, item.readingTime)}
          </span>
          <SaveButton id={item.id} saved={item.saved} />
        </div>
      </div>
    </article>
  );
}

export function ContentRow({ item, right }: { item: ContentCardDTO; right?: React.ReactNode }) {
  return (
    <div className="c-row" style={{ position: "relative" }}>
      <TypeAvatar type={item.type} />
      <Link href={item.href} style={{ minWidth: 0, color: "inherit" }}>
        <span className="t">{item.title}</span>
        <span className="s">
          {TYPE_LABELS[item.type].one} · {item.category.name} · {item.author}
        </span>
      </Link>
      {right ?? <SaveButton id={item.id} saved={item.saved} />}
    </div>
  );
}
