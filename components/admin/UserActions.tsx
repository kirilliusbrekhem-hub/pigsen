"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";

export function UserActions({ id, blocked, pro, self }: { id: string; blocked: boolean; pro: boolean; self: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [coins, setCoins] = useState("100");
  const [days, setDays] = useState("30");

  async function act(body: object, done: string) {
    setBusy(true);
    try {
      await api(`/api/admin/users/${id}`, { method: "POST", body });
      toast.show(done);
      router.refresh();
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-pad stack" style={{ gap: 14 }}>
      <b>Действия</b>
      <div className="admin-action">
        <span>Выдать Pro на</span>
        <input className="input" type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} aria-label="Дней Pro" />
        <span>дней</span>
        <Button variant="accent" size="sm" loading={busy} onClick={() => act({ kind: "pro", days: Number(days) }, `Pro продлён на ${days} дн.`)}>
          Выдать
        </Button>
        {pro && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => act({ kind: "revokePro" }, "Pro отключён")}>
            Отключить Pro
          </Button>
        )}
      </div>
      <div className="admin-action">
        <span>PigCoin$</span>
        <input className="input" type="number" value={coins} onChange={(e) => setCoins(e.target.value)} aria-label="Количество монет" />
        <Button variant="primary" size="sm" loading={busy} onClick={() => act({ kind: "coins", amount: Math.abs(Number(coins)) }, `Начислено ${Math.abs(Number(coins))}`)}>
          Начислить
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => act({ kind: "coins", amount: -Math.abs(Number(coins)) }, `Списано ${Math.abs(Number(coins))}`)}>
          Списать
        </Button>
      </div>
      {!self && (
        <div className="admin-action">
          {blocked ? (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => act({ kind: "block", blocked: false }, "Разблокирован")}>
              Разблокировать
            </Button>
          ) : (
            <Button variant="danger" size="sm" disabled={busy} onClick={() => confirm("Заблокировать пользователя? Он не сможет войти.") && act({ kind: "block", blocked: true }, "Заблокирован")}>
              Заблокировать
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
