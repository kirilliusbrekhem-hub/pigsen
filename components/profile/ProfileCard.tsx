import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { emblemIcon, nameCls, ringCls, type Look } from "@/lib/profile/cosmetics";

/** Emblem badge next to a user's name (renders nothing without one). */
export function Emblem({ value, lg = false }: { value?: string; lg?: boolean }) {
  const icon = value ? emblemIcon(value) : "";
  if (!icon) return null;
  return (
    <span className={`emblem${lg ? " lg" : ""}`} title="Эмблема" data-emblem={value}>
      <Icon name={icon} />
    </span>
  );
}

/** Light-touch name line used in feeds, chat and DMs: colored name + emblem. */
export function WhoName({ name, look, children }: { name: string; look?: Look; children?: ReactNode }) {
  return (
    <span className="who">
      <b className={nameCls(look)}>{children ?? name}</b>
      <Emblem value={look?.emblem} />
    </span>
  );
}

const LIGHT_BG = new Set(["", "mint"]);

/** Profile card with the chosen background, frame, name color, emblem, Pro badge and title. */
export function ProfileCard({ name, avatarUrl, look, pro, title, sub, heading = "h1", children }: { name: string; avatarUrl: string | null; look: Look; pro: boolean; title?: string; sub?: ReactNode; heading?: "h1" | "h2"; children?: ReactNode }) {
  const H = heading;
  return (
    <section className={`pcard pbg-${look.bg || "plain"}${LIGHT_BG.has(look.bg) ? "" : " is-dark"}${pro ? " is-pro" : ""}`} data-testid="profile-card">
      <Avatar name={name} src={avatarUrl} className={`xl${ringCls(look)}`} />
      <div className="pc-body">
        <div className="pc-name">
          <H className={nameCls(look)} style={{ font: "inherit", margin: 0, minWidth: 0, overflowWrap: "anywhere" }}>{name}</H>
          <Emblem value={look.emblem} lg />
          {pro && <span className="pro-badge">Pro</span>}
        </div>
        {(title || sub) && (
          <div className="pc-sub">
            {title && <span className="title-chip">{title}</span>}
            {sub}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
