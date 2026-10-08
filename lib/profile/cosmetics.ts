// Client-safe catalog of profile cosmetics. Every option is free, Pro-only or unlocked by a shop item (PigCoin$).
// Stored values are the Profile columns: profileBg, profileEmblem, nameColor, avatarRing (title is handled separately).
// Old stored values ("gold", "violet", "fire") are kept as ids so items bought earlier keep working; only their look changed.

export type CosmeticSlot = "bg" | "emblem" | "name" | "ring";
export type Access = { tier: "free" } | { tier: "pro" } | { tier: "shop"; item: string };

export interface CosmeticOption {
  value: string;
  label: string;
  access: Access;
  /** Emblems: icon name. */
  icon?: string;
}

const free: Access = { tier: "free" };
const pro: Access = { tier: "pro" };
const shop = (item: string): Access => ({ tier: "shop", item });

export const COSMETICS: Record<CosmeticSlot, CosmeticOption[]> = {
  bg: [
    { value: "", label: "Классика", access: free },
    { value: "mint", label: "Мята", access: free },
    { value: "ink", label: "Графит", access: free },
    { value: "grid", label: "Сетка", access: shop("bg-grid") },
    { value: "forest", label: "Лес", access: pro },
    { value: "night", label: "Ночной неон", access: pro },
    { value: "stripes", label: "Полосы", access: pro },
    { value: "aurora", label: "Сияние (анимация)", access: pro },
  ],
  emblem: [
    { value: "", label: "Без эмблемы", access: free },
    { value: "leaf", label: "Росток", icon: "leaf", access: free },
    { value: "piggy", label: "Копилка", icon: "piggy", access: free },
    { value: "gem", label: "Кристалл", icon: "gem", access: shop("emblem-gem") },
    { value: "crown", label: "Корона", icon: "crown", access: pro },
    { value: "bolt", label: "Молния", icon: "bolt", access: pro },
    { value: "rocket", label: "Ракета", icon: "rocket", access: pro },
    { value: "trophy", label: "Кубок", icon: "trophy", access: pro },
    { value: "star", label: "Звезда", icon: "star", access: pro },
  ],
  name: [
    { value: "", label: "Обычное", access: free },
    { value: "mint", label: "Зелёное", access: free },
    { value: "emerald", label: "Изумрудное", access: shop("name-emerald") },
    { value: "violet", label: "Малахитовое", access: shop("name-violet") },
    { value: "gold", label: "Неоновое", access: shop("name-gold") },
    { value: "aurora", label: "Переливающееся", access: pro },
    { value: "glow", label: "Светящееся", access: pro },
  ],
  ring: [
    { value: "", label: "Без рамки", access: free },
    { value: "line", label: "Тонкая", access: free },
    { value: "gold", label: "Изумрудная", access: shop("ring-gold") },
    { value: "fire", label: "Неоновая", access: shop("ring-fire") },
    { value: "duo", label: "Двойная", access: pro },
    { value: "pulse", label: "Сияющая (анимация)", access: pro },
  ],
};

export const optionOf = (slot: CosmeticSlot, value: string) => COSMETICS[slot].find((o) => o.value === value);

export interface Look {
  name: string;
  ring: string;
  emblem: string;
  bg: string;
}

export type LookFields = { nameColor: string; avatarRing: string; profileEmblem: string; profileBg: string };
type LookProfile = ({ proUntil?: Date | null } & Partial<LookFields>) | null | undefined;

/** What others see: unknown values and Pro options of an expired Pro are dropped. */
export function lookOf(p: LookProfile): Look {
  const isPro = !!p?.proUntil && p.proUntil.getTime() > Date.now();
  const pick = (slot: CosmeticSlot, v: string | undefined) => {
    const o = optionOf(slot, v ?? "");
    return o && (o.access.tier !== "pro" || isPro) ? o.value : "";
  };
  return { name: pick("name", p?.nameColor), ring: pick("ring", p?.avatarRing), emblem: pick("emblem", p?.profileEmblem), bg: pick("bg", p?.profileBg) };
}

export const EMPTY_LOOK: Look = { name: "", ring: "", emblem: "", bg: "" };
export const emblemIcon = (v: string) => optionOf("emblem", v)?.icon ?? "";
export const nameCls = (look?: Look) => (look?.name ? `name-${look.name}` : undefined);
export const ringCls = (look?: Look) => (look?.ring ? ` ring-${look.ring}` : "");

/** Profile fields to select wherever users are shown to others. */
export const LOOK_SELECT = { nameColor: true, avatarRing: true, profileEmblem: true, profileBg: true } as const;
