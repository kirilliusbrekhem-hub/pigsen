// Scene registry: business kind → art. Unknown kinds fall back by keyword, then to the café.
import { bakeryArt, coffeeArt } from "./coffee";
import { officeArt } from "./office";
import { barberArt, shopArt } from "./others";
import type { Art, Slot, SpriteDef } from "./types";

export type { Art, SceneCtx, Slot, SpriteDef, Flow, BubbleIcon, Tod } from "./types";

const cache = new Map<string, Art>();

export function artFor(kind: string, title = ""): Art {
  const key = `${kind}|${title}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = `${kind} ${title}`.toLowerCase();
  let art: Art;
  if (/coffee|cafe|кофе/.test(s)) art = coffeeArt;
  else if (/barber|барбер|salon|салон/.test(s)) art = barberArt;
  else if (/bak|пекар|bread/.test(s)) art = bakeryArt;
  else if (/saas|стартап|startup/.test(s)) art = officeArt("SAAS · CLOUD");
  else if (/app|mobile|приложен/.test(s)) art = officeArt("MOBILE APP");
  else if (/web|it\b|studio|студ|dev|agency|it_|^it/.test(s)) art = officeArt("WEB STUDIO");
  else if (/shop|store|магазин|market/.test(s)) art = shopArt;
  else art = coffeeArt;
  cache.set(key, art);
  return art;
}

export interface Placed {
  id: string;
  def: SpriteDef | null;
  /** Catalog slot hint, used by the generic sprite when no rule claims the id. */
  hint: string | null;
  slot: Slot;
  /** Index among items sharing the same rule/pool (for variations). */
  n: number;
}

/** Deterministic placement: catalog order first (stable as items are bought), then owned extras (rewards). */
export function layout(art: Art, items: { id: string; hint?: string | null }[]): Map<string, Placed> {
  const used = new Map<object, number>();
  let extra = 0;
  const out = new Map<string, Placed>();
  for (const { id, hint = null } of items) {
    if (out.has(id)) continue;
    let placed: Placed | null = null;
    for (const def of art.sprites) {
      const ok = Array.isArray(def.match) ? def.match.includes(id) : def.match(id, hint ?? undefined);
      if (!ok) continue;
      const n = used.get(def) ?? 0;
      if (n >= def.slots.length) continue;
      used.set(def, n + 1);
      placed = { id, def, hint, slot: def.slots[n], n };
      break;
    }
    const pool = !placed && hint ? art.hints[hint] : undefined;
    if (!placed && pool) {
      const n = used.get(pool) ?? 0;
      if (n < pool.length) {
        used.set(pool, n + 1);
        placed = { id, def: null, hint, slot: pool[n], n };
      }
    }
    if (!placed) {
      const slot = art.extraSlots[extra % art.extraSlots.length];
      const lap = Math.floor(extra / art.extraSlots.length);
      placed = { id, def: null, hint: null, slot: lap ? { gx: slot.gx + 0.3 * lap, gy: slot.gy - 0.3 * lap } : slot, n: extra };
      extra++;
    }
    out.set(id, placed);
  }
  return out;
}
