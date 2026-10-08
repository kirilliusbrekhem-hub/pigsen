"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { haptic, preloadFx, reward } from "@/components/fx";
import { api, errorMessage } from "@/lib/client/api";
import type { XpResultDTO } from "@/types";

const FILLS = ["var(--accent)", "var(--ink)", "var(--accent-soft)", "var(--ink-2)", "var(--accent-hover)", "var(--surface-2)"];
const INKS = ["var(--accent-ink)", "var(--bg)", "var(--ink)", "var(--bg)", "var(--accent-ink)", "var(--ink)"];

/** Daily wheel of fortune. The prize is chosen by the server; the wheel only animates to it. */
export function LuckyWheel({ available, prizes }: { available: boolean; prizes: string[] }) {
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [won, setWon] = useState<string | null>(null);
  const [used, setUsed] = useState(!available);
  const router = useRouter();
  const toast = useToast();
  const n = prizes.length;
  const seg = 360 / n;
  const R = 80;

  async function spin(btn: HTMLElement) {
    setSpinning(true);
    haptic(8);
    try {
      const r = await api<{ index: number; label: string; coins: number; xp: XpResultDTO | null }>("/api/quests/spin", { method: "POST" });
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      setAngle(360 * (reduce ? 0 : 5) + (360 - (r.index * seg + seg / 2)));
      setTimeout(
        () => {
          setWon(r.label);
          setUsed(true);
          setSpinning(false);
          reward({ xp: r.xp?.gained ?? 0, coins: r.coins, origin: btn, level: r.xp?.level, leveledUp: r.xp?.leveledUp, power: 1.5 });
          router.refresh();
        },
        reduce ? 0 : 3600,
      );
    } catch (e) {
      setSpinning(false);
      setUsed(true);
      toast.show(errorMessage(e), { kind: "err" });
    }
  }

  const arc = (i: number) => {
    const a0 = ((i * seg - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
    return `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`;
  };

  return (
    <div className="wheel-card" data-testid="lucky-wheel">
      <div className="wheel-box">
        <svg viewBox="-86 -92 172 178" className="wheel-svg" aria-hidden="true">
          <g className="wheel-rot" style={{ transform: `rotate(${angle}deg)` }}>
            {prizes.map((p, i) => {
              const mid = i * seg + seg / 2;
              return (
                <g key={i}>
                  <path d={arc(i)} fill={FILLS[i % FILLS.length]} stroke="var(--surface)" strokeWidth="1.5" />
                  <text transform={`rotate(${mid}) translate(0 -52) rotate(90)`} fill={INKS[i % INKS.length]} fontSize="12" fontWeight="600" textAnchor="middle" dominantBaseline="middle">
                    {p.replace(" PigCoin$", "")}
                  </text>
                </g>
              );
            })}
            <circle r="16" fill="var(--surface)" stroke="var(--line-2)" />
          </g>
          <path d="M-8 -90 L8 -90 L0 -74 Z" fill="var(--ink)" />
        </svg>
      </div>
      <div className="wheel-txt">
        <b>Колесо удачи</b>
        <span className="muted">{won ? `Выпало: ${won}` : used ? "Сегодня уже крутили. Завтра новая попытка" : "Одна попытка в день, призы в PigCoin$ и XP"}</span>
        <button type="button" className="btn btn-primary btn-sm" disabled={used || spinning} onPointerEnter={preloadFx} onClick={(e) => spin(e.currentTarget)} data-testid="spin-btn">
          {spinning ? "Крутится…" : used ? "Завтра" : "Крутить"}
        </button>
      </div>
    </div>
  );
}
