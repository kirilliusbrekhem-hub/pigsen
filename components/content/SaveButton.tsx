"use client";
import { Icon } from "@/components/ui/Icon";
import { useSaveToggle } from "@/hooks/useSaveToggle";

export function SaveButton({ id, saved: initial, variant = "icon" }: { id: string; saved: boolean; variant?: "icon" | "button" }) {
  const { saved, busy, toggle } = useSaveToggle(id, initial);
  if (variant === "button") {
    return (
      <button className={`btn ${saved ? "btn-secondary is-success" : "btn-primary"} save-btn`} onClick={toggle} disabled={busy} aria-pressed={saved}>
        <Icon name="bookmark" size="sm" className={saved ? "" : ""} style={saved ? { fill: "currentColor" } : undefined} />
        {saved ? "Сохранено" : "Сохранить"}
      </button>
    );
  }
  return (
    <button
      className={`icon-btn save-btn ${saved ? "is-saved" : ""}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? "Убрать из сохранённого" : "Сохранить"}
      title={saved ? "Убрать из сохранённого" : "Сохранить"}
    >
      <Icon name="bookmark" />
    </button>
  );
}
