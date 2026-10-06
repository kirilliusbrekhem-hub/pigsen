"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Coin } from "@/components/ui/Coin";
import { api } from "@/lib/client/api";

export function DailyBonus({ pro }: { pro: boolean }) {
  const [bonus, setBonus] = useState(0);
  const router = useRouter();
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    api<{ bonus: number }>("/api/coins/daily", { method: "POST" })
      .then((r) => {
        if (r.bonus > 0) {
          setBonus(r.bonus);
          router.refresh();
        }
      })
      .catch(() => {});
  }, [router]);
  if (!bonus) return null;
  return (
    <div className="card bonus-card" data-testid="daily-bonus">
      <Coin size={22} />
      <span>
        Ежедневный бонус: <b>+{bonus} PigCoin$</b>. Заходите каждый день: чем длиннее серия, тем больше бонус.
        {!pro && " В Pro ещё +30 в день."}
      </span>
    </div>
  );
}
