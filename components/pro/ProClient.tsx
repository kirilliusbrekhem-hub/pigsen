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
    const win = window.open("about:blank", "_blank");
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
  includedInPro?: boolean;
  /** Original price when a Pro discount applies. */
  fullPrice?: number;
  hot?: boolean;
}

export function Shop({ items, coins }: { items: ShopItemView[]; coins: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function buy(id: string, title: string) {
    setBusy(id);
    try {
      const r = await api<{ message?: string }>("/api/shop/buy", { method: "POST", body: { itemId: id } });
      toast.show(r.message ?? `Куплено: ${title}`);
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
        <div key={i.id} className={`card shop-item ${i.hot ? "is-hot" : ""}`}>
          {i.hot && <span className="chip shop-hot">Хит</span>}
          <span className="shop-ic">
            <Icon name={i.icon} />
          </span>
          <b>{i.title}</b>
          <span className="muted" style={{ fontSize: 13 }}>
            {i.description}
          </span>
          {i.includedInPro ? (
            <span className="pos" style={{ fontSize: 13 }}>
              <Icon name="sparkle" size="sm" /> Входит в ваш Pro
            </span>
          ) : i.owned ? (
            <span className="pos" style={{ fontSize: 13 }}>
              <Icon name="check" size="sm" /> Уже ваше
            </span>
          ) : (
            <Button variant={coins >= i.price ? "primary" : "secondary"} size="sm" onClick={() => buy(i.id, i.title)} loading={busy === i.id} disabled={coins < i.price}>
              {i.fullPrice && <s className="muted">{i.fullPrice}</s>} {i.price} <Coin size={14} />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
