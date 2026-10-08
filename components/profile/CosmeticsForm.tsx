"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Coin } from "@/components/ui/Coin";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import { COSMETICS, type CosmeticOption, type CosmeticSlot, type Look } from "@/lib/profile/cosmetics";
import { Avatar } from "@/components/ui/Avatar";
import { Emblem, ProfileCard } from "./ProfileCard";

type Slot = CosmeticSlot | "title";
const GROUPS: { slot: CosmeticSlot; title: string; hint: string }[] = [
  { slot: "bg", title: "Фон профиля", hint: "Виден в карточке профиля." },
  { slot: "emblem", title: "Эмблема", hint: "Значок рядом с именем в лидерборде, комьюнити и чатах." },
  { slot: "ring", title: "Рамка аватара", hint: "Видна всем, где показан ваш аватар." },
  { slot: "name", title: "Цвет имени", hint: "Видят все участники." },
];

export interface CosmeticsProps {
  name: string;
  avatarUrl: string | null;
  pro: boolean;
  look: Look;
  owned: string[];
  prices: Record<string, number>;
  title: string;
  titles: { id: string; label: string }[];
}

export function CosmeticsForm({ name, avatarUrl, pro, look: initial, owned, prices, title: initialTitle, titles }: CosmeticsProps) {
  const router = useRouter();
  const toast = useToast();
  const [look, setLook] = useState(initial);
  const [title, setTitleState] = useState(initialTitle);
  const [busy, setBusy] = useState(false);
  const has = new Set(owned);

  async function save(slot: Slot, value: string, label: string) {
    setBusy(true);
    try {
      await api("/api/profile/cosmetics", { method: "POST", body: { slot, value } });
      if (slot === "title") setTitleState(label);
      else setLook((l) => ({ ...l, [slot]: value }));
      router.refresh();
    } catch (e) {
      toast.show(errorMessage(e), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  const unlocked = (o: CosmeticOption) => o.access.tier === "free" || (o.access.tier === "pro" ? pro : has.has(o.access.item));

  function preview(slot: CosmeticSlot, o: CosmeticOption) {
    if (slot === "bg") return <span className={`cx-swatch pcard pbg-${o.value || "plain"}`} aria-hidden />;
    if (slot === "emblem") return o.value ? <Emblem value={o.value} lg /> : <span className="emblem lg" style={{ opacity: 0.25 }} aria-hidden />;
    if (slot === "ring") return <Avatar name={name} src={avatarUrl} className={o.value ? `ring-${o.value}` : ""} />;
    return <span className={`cx-name ${o.value ? `name-${o.value}` : ""}`}>{name.split(" ")[0] || "Имя"}</span>;
  }

  function tag(o: CosmeticOption) {
    if (o.access.tier === "pro") return <span className="cx-tag pro"><Icon name={pro ? "sparkle" : "lock"} /> Pro</span>;
    if (o.access.tier === "shop") {
      return has.has(o.access.item) ? <span className="cx-tag"><Icon name="check" /> куплено</span> : <span className="cx-tag"><Icon name="lock" /> {prices[o.access.item] ?? ""} <Coin size={10} /></span>;
    }
    return <span className="cx-tag">бесплатно</span>;
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <ProfileCard name={name} avatarUrl={avatarUrl} look={look} pro={pro} title={title} heading="h2" sub={<span>Так вас видят другие</span>} />
      {!pro && (
        <div className="card card-pad row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
          <span className="muted" style={{ fontSize: 13 }}>Анимированный фон, сияющая рамка, переливающееся имя и эксклюзивные эмблемы доступны в Pro.</span>
          <Link href="/pro" className="btn btn-accent btn-sm"><Icon name="sparkle" size="sm" /> Открыть Pro</Link>
        </div>
      )}
      {GROUPS.map((g) => (
        <section key={g.slot} className="cx-group" data-slot={g.slot}>
          <div>
            <h3>{g.title}</h3>
            <span className="muted" style={{ fontSize: 12.5 }}>{g.hint}</span>
          </div>
          <div className="cx-opts">
            {COSMETICS[g.slot].map((o) => {
              const on = look[g.slot] === o.value;
              const body = (
                <>
                  {preview(g.slot, o)}
                  <span>{o.label}</span>
                  {tag(o)}
                </>
              );
              return unlocked(o) ? (
                <button key={o.value || "none"} type="button" className={`cx-opt${on ? " is-on" : ""}`} aria-pressed={on} disabled={busy} data-value={o.value} onClick={() => !on && save(g.slot, o.value, o.label)}>
                  {body}
                </button>
              ) : (
                <Link key={o.value || "none"} href="/pro" className="cx-opt is-locked" data-value={o.value} title={o.access.tier === "pro" ? "Доступно в Pro" : "Купить в магазине"}>
                  {body}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      <section className="cx-group" data-slot="title">
        <div>
          <h3>Статус</h3>
          <span className="muted" style={{ fontSize: 12.5 }}>Титулы покупаются в магазине за PigCoin$ и показываются рядом с именем.</span>
        </div>
        <div className="cx-opts">
          <button type="button" className={`cx-opt${!title ? " is-on" : ""}`} aria-pressed={!title} disabled={busy} onClick={() => title && save("title", "", "")}>
            <span>Без статуса</span>
          </button>
          {initialTitle && !titles.some((t) => t.label === initialTitle) && (
            <button type="button" className={`cx-opt${title === initialTitle ? " is-on" : ""}`} aria-pressed={title === initialTitle} disabled>
              <span className="title-chip">{initialTitle}</span>
              <span className="cx-tag">награда</span>
            </button>
          )}
          {titles.map((t) => (
            <button key={t.id} type="button" className={`cx-opt${title === t.label ? " is-on" : ""}`} aria-pressed={title === t.label} disabled={busy} onClick={() => title !== t.label && save("title", t.id, t.label)}>
              <span className="title-chip">{t.label}</span>
            </button>
          ))}
          <Link href="/pro" className="cx-opt is-locked">
            <Icon name="bag" />
            <span>Ещё титулы в магазине</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
