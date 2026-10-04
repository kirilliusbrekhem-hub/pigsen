"use client";
import { Icon } from "@/components/ui/Icon";

export interface InterestOption {
  slug: string;
  name: string;
  description: string;
  icon: string;
}

export function InterestsPicker({ options, value, onChange }: { options: InterestOption[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (slug: string) => onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);
  return (
    <div className="interest-grid" role="group" aria-label="Интересы">
      {options.map((o) => {
        const on = value.includes(o.slug);
        return (
          <button key={o.slug} type="button" className={`interest ${on ? "is-selected" : ""}`} aria-pressed={on} onClick={() => toggle(o.slug)}>
            <Icon name={o.icon} className="ic" />
            <b>{o.name}</b>
            <small>{o.description}</small>
            <Icon name="check" size="sm" className="ck" />
          </button>
        );
      })}
    </div>
  );
}
