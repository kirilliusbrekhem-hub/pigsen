"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { TABS } from "./data";

/** Tabbed tour of the product with real screenshots. */
export function Showcase() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const tab = TABS[active];

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (active + delta + TABS.length) % TABS.length;
    setActive(next);
    refs.current[next]?.focus();
  }

  return (
    <div className="lp-show">
      <div className="lp-tabs" role="tablist" aria-label="Возможности PIGSEN" onKeyDown={onKey}>
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`lp-tab-${t.id}`}
            aria-selected={i === active}
            aria-controls={`lp-panel-${t.id}`}
            tabIndex={i === active ? 0 : -1}
            className={`lp-tab ${i === active ? "is-active" : ""}`}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="lp-panel" role="tabpanel" id={`lp-panel-${tab.id}`} aria-labelledby={`lp-tab-${tab.id}`} key={tab.id}>
        <div className="lp-panel-copy">
          <h3>{tab.title}</h3>
          <p>{tab.text}</p>
          <ul>
            {tab.points.map((p) => (
              <li key={p}>
                <Icon name="check" size="sm" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <figure className="lp-browser">
          <div className="lp-browser-bar" aria-hidden="true">
            <i />
            <i />
            <i />
            <span>pigsen.app</span>
          </div>
          <Image src={tab.img} alt={`Экран PIGSEN: ${tab.label}`} width={1200} height={750} unoptimized sizes="(max-width: 900px) 100vw, 640px" />
        </figure>
      </div>
    </div>
  );
}
