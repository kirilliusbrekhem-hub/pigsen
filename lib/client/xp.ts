import type { XpResultDTO } from "@/types";

/** Short toast line for an XP award, or null when nothing was gained. */
export function xpMessage(xp: XpResultDTO | undefined, base: string): string {
  if (!xp || xp.gained <= 0) return base;
  const lvl = xp.leveledUp ? ` Новый уровень: ${xp.level.name}!` : "";
  const coins = xp.coins ? `, +${xp.coins} PigCoin$` : "";
  return `${base} +${xp.gained} XP${coins}.${lvl}`;
}
