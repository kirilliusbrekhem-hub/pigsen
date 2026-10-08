"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Coin } from "@/components/ui/Coin";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { reachGoal } from "@/lib/analytics/goal";
import { api, errorMessage } from "@/lib/client/api";


// On phones a pre-opened about:blank tab gets stuck (Telegram opens in its app and the blank tab stays),
// so navigate the current tab there; on desktop pre-open a tab so popup blockers allow it.
function openPayWindow(): Window | null {
  if (typeof window === "undefined" || window.matchMedia("(pointer: coarse)").matches) return null;
  return window.open("about:blank", "_blank");
}

export function BuyPlan({ plan, label, enabled }: { plan: "month" | "year"; label: string; enabled: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);

  // Telegram payments finish in another tab/app: poll our server until the bot confirms.
  async function waitFor(id: string) {
    setWaiting(true);
    for (let i = 0; i < 150; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const s = await api<{ status: string | null }>(`/api/billing/status?id=${encodeURIComponent(id)}`);
        if (s.status === "succeeded") {
          toast.show("Оплата прошла, Pro активирован! 🎉");
          setWaiting(false);
          router.refresh();
          return;
        }
      } catch {
        /* keep polling */
      }
    }
    setWaiting(false);
  }

  async function go() {
    setBusy(true);
    // Open the window synchronously so popup blockers allow it; point it at the invoice once we have it.
    const win = openPayWindow();
    try {
      const r = await api<{ url: string; id?: string; telegram?: boolean }>("/api/billing/checkout", { method: "POST", body: { plan } });
      if (r.telegram && r.id) {
        if (win) win.location.href = r.url;
        else window.location.assign(r.url);
        void waitFor(r.id);
      } else {
        win?.close();
        window.location.assign(r.url);
      }
    } catch (err) {
      win?.close();
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }
  if (waiting) {
    return (
      <Button variant="secondary" loading>
        Ждём оплату в Telegram…
      </Button>
    );
  }
  if (!enabled) {
    return (
      <Button variant="secondary" disabled>
        Оплата картой скоро
      </Button>
    );
  }
  return (
    <Button variant={plan === "year" ? "accent" : "primary"} onClick={() => {
      reachGoal("pro_click");
      void go();
    }} loading={busy}>
      {label}
    </Button>
  );
}

export function CoinPacks({ packs, enabled }: { packs: { id: string; coins: number; stars: number; note?: string }[]; enabled: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<string | null>(null);

  async function waitFor(id: string, coins: number) {
    for (let i = 0; i < 150; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const s = await api<{ status: string | null }>(`/api/billing/status?id=${encodeURIComponent(id)}`);
        if (s.status === "succeeded") {
          toast.show(`+${coins} PigCoin$ на балансе! 🎉`);
          router.refresh();
          break;
        }
      } catch {
        /* keep polling */
      }
    }
    setWaiting(null);
  }

  async function buy(pack: string, coins: number) {
    reachGoal("coins_click");
    setBusy(pack);
    const win = openPayWindow();
    try {
      const r = await api<{ url: string; id: string }>("/api/coins/stars", { method: "POST", body: { pack } });
      if (win) win.location.href = r.url;
      else window.location.assign(r.url);
      setWaiting(pack);
      void waitFor(r.id, coins);
    } catch (err) {
      win?.close();
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="packs-grid" data-testid="coin-packs">
      {packs.map((p) => (
        <div key={p.id} className="card pack">
          <b className="num" style={{ fontSize: 22 }}>
            {p.coins} <Coin size={18} />
          </b>
          {p.note && <span className="chip">{p.note}</span>}
          {!enabled ? (
            <Button variant="secondary" size="sm" disabled>
              Скоро
            </Button>
          ) : waiting === p.id ? (
            <Button variant="secondary" size="sm" loading>
              Ждём оплату…
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => buy(p.id, p.coins)} loading={busy === p.id} disabled={!!waiting}>
              {p.stars} ⭐
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

export interface ShopItemView {
  id: string;
  title: string;
  description: string;
  price: number;
  icon: string;
  category: "boost" | "access" | "style";
  owned: boolean;
  /** Owned cosmetic that can be put on / taken off. */
  equippable?: boolean;
  equipped?: boolean;
  /** Extra status line, e.g. "Активен до …". */
  note?: string;
  includedInPro?: boolean;
  /** Original price when a Pro discount applies. */
  fullPrice?: number;
  hot?: boolean;
}

const CATS = [
  ["boost", "Буст"],
  ["access", "Доступ"],
  ["style", "Стиль"],
] as const;

export function Shop({ items, coins }: { items: ShopItemView[]; coins: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [cat, setCat] = useState<"all" | ShopItemView["category"]>("all");
  async function buy(id: string, title: string) {
    setBusy(id);
    try {
      const r = await api<{ message?: string }>("/api/shop/buy", { method: "POST", body: { itemId: id } });
      if (id === "pro-trial") reachGoal("pro_trial");
      toast.show(r.message ?? `Куплено: ${title}`);
      router.refresh();
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(null);
    }
  }
  async function equip(id: string, off: boolean) {
    setBusy(id);
    try {
      await api("/api/coins/equip", { method: "POST", body: { itemId: id, off } });
      toast.show(off ? "Снято" : "Надето");
      router.refresh();
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="shop-tabs" role="tablist" aria-label="Категории магазина">
        {[["all", "Все"] as const, ...CATS].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={cat === id} className={`btn btn-sm ${cat === id ? "btn-primary" : "btn-secondary"}`} onClick={() => setCat(id)}>
            {label}
          </button>
        ))}
        <span className="num" style={{ marginLeft: "auto", alignSelf: "center" }} data-testid="shop-balance">
          Баланс: {coins} <Coin size={14} />
        </span>
      </div>
      {CATS.filter(([id]) => cat === "all" || cat === id).map(([id, label]) => {
        const list = items.filter((i) => i.category === id);
        if (!list.length) return null;
        return (
          <section key={id} className="shop-cat">
            <h3>{label}</h3>
            <div className="shop-grid">
              {list.map((i) => (
                <div key={i.id} className={`card shop-item ${i.hot ? "is-hot" : ""}`} data-item={i.id}>
                  {i.hot && <span className="chip shop-hot">Хит</span>}
                  <span className="shop-ic">
                    <Icon name={i.icon} />
                  </span>
                  <b>{i.title}</b>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {i.description}
                  </span>
                  {i.note && (
                    <span className="pos" style={{ fontSize: 13 }}>
                      {i.note}
                    </span>
                  )}
                  {i.includedInPro ? (
                    <span className="pos" style={{ fontSize: 13 }}>
                      <Icon name="sparkle" size="sm" /> Входит в ваш Pro
                    </span>
                  ) : i.owned ? (
                    <div className="shop-actions">
                      <span className="pos" style={{ fontSize: 13 }}>
                        <Icon name="check" size="sm" /> {i.equipped ? "Надето" : "Уже ваше"}
                      </span>
                      {i.equippable && (
                        <Button variant="secondary" size="sm" onClick={() => equip(i.id, !!i.equipped)} loading={busy === i.id}>
                          {i.equipped ? "Снять" : "Надеть"}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button variant={coins >= i.price ? "primary" : "secondary"} size="sm" onClick={() => buy(i.id, i.title)} loading={busy === i.id} disabled={coins < i.price}>
                      {i.fullPrice && <s className="muted">{i.fullPrice}</s>} {i.price} <Coin size={14} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
