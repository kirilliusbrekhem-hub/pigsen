"use client";
// Tiny front door to the effects engine: the engine chunk is fetched on the first effect, not on page load.
import type { Origin, RewardInput } from "./engine";
import type { XpResultDTO } from "@/types";

type Engine = typeof import("./engine");
let engine: Promise<Engine> | null = null;
const load = () => (engine ??= import("./engine"));
const run = (fn: (e: Engine) => void) => {
  if (typeof window === "undefined") return;
  load().then(fn).catch(() => {});
};

/** Warms the chunk (e.g. on hover of a reward button). */
export const preloadFx = () => run(() => {});
export const burst = (origin?: Origin, power = 1) => run((e) => e.burst(origin, power));
export const haptic = (pattern: number | number[] = 12) => run((e) => e.haptic(pattern));
export const floatText = (text: string, origin?: Origin) => run((e) => e.floatText(text, origin));
export const levelUp = (level: { index: number; name: string }) => run((e) => e.levelUp(level));
export const reward = (r: RewardInput) => run((e) => e.reward(r));

/** Celebrates an XP award returned by the API (lesson, quiz, quest, idea review). */
export function rewardXp(xp: XpResultDTO | undefined | null, origin?: Origin, power = 1, extraCoins = 0) {
  if (!xp) {
    if (extraCoins) reward({ coins: extraCoins, origin, power });
    return;
  }
  reward({ xp: xp.gained, coins: (xp.coins ?? 0) + extraCoins, origin, level: xp.level, leveledUp: xp.leveledUp, power: xp.gained > 0 || extraCoins ? power : 0 });
}
