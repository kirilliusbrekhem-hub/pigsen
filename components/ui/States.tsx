import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function EmptyState({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="em-ic">
        <Icon name={icon} size="lg" />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function ErrorBox({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="err-box" role="alert">
      <Icon name="alert" />
      <div style={{ flex: 1 }}>{message}</div>
      {action}
    </div>
  );
}

export function Skeleton({ h = 12, w = "100%", r = 8, style }: { h?: number; w?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="skel" style={{ height: h, width: w, borderRadius: r, ...style }} aria-hidden="true" />;
}
