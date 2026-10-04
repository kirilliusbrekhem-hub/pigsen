"use client";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export function ToolsTabs({ tabs, initial }: { tabs: Array<{ id: string; label: string; icon: string; desc: string; node: ReactNode }>; initial?: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.id === initial) ? initial! : tabs[0].id);
  const cur = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="tool-tabs" role="tablist" aria-label="Инструменты">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={t.id === active} className={`tool-tab ${t.id === active ? "is-selected" : ""}`} onClick={() => setActive(t.id)}>
            <span className="ic">
              <Icon name={t.icon} />
            </span>
            <span>
              <b>{t.label}</b>
              <span className="muted">{t.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <div key={cur.id} className="fade-in" role="tabpanel">
        {cur.node}
      </div>
    </div>
  );
}
