"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Coin } from "@/components/ui/Coin";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";

export function BuyPlan({ plan, label, enabled }: { plan: "month" | "year"; label: string; enabled: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await api<{ url: string }>("/api/billing/checkout", { method: "POST", body: { plan } });
      window.location.assign(r.url);
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
      setBusy(false);
    }
  }
  if (!enabled) {
    return (
      <Button variant="secondary" disabled>
        Оплата картой скоро
      </Button>
    );
  }
  return (
    <Button variant={plan === "year" ? "accent" : "primary"} onClick={go} loading={busy}>
      {label}
    </Button>
  );
}

export interface ShopItemView {
  id: string;
  title: string;
  description: string;
  price: number;
  icon: string;
  owned: boolean;
}

export function Shop({ items, coins }: { items: ShopItemView[]; coins: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function buy(id: string, title: string) {
    setBusy(id);
    try {
      await api("/api/shop/buy", { method: "POST", body: { itemId: id } });
      toast.show(`Куплено: ${title}`);
      router.refresh();
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="shop-grid">
      {items.map((i) => (
        <div key={i.id} className="card shop-item">
          <span className="shop-ic">
            <Icon name={i.icon} />
          </span>
          <b>{i.title}</b>
          <span className="muted" style={{ fontSize: 13 }}>
            {i.description}
          </span>
          {i.owned ? (
            <span className="pos" style={{ fontSize: 13 }}>
              <Icon name="check" size="sm" /> Уже ваше
            </span>
          ) : (
            <Button variant={coins >= i.price ? "primary" : "secondary"} size="sm" onClick={() => buy(i.id, i.title)} loading={busy === i.id} disabled={coins < i.price}>
              {i.price} <Coin size={14} />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
