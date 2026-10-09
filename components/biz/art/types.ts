import type { ReactNode } from "react";
import type { Pt } from "./iso";

export type Tod = "day" | "eve" | "night";

export interface SceneCtx {
  /** Working items. */
  ok: Set<string>;
  /** Owned items, any status. */
  has: Set<string>;
  level: number;
  name: string;
  tod: Tod;
  title: (id: string) => string;
}

export interface Slot {
  gx: number;
  gy: number;
  z?: number;
  /** Wall-mounted: placeholder is drawn on the wall instead of the floor. */
  wall?: "L" | "R";
  /** Footprint for the placeholder (tiles). */
  w?: number;
  d?: number;
  /** Staff hint: seat the worker at their own desk (IT offices). */
  desk?: boolean;
}

export interface SpriteDef {
  /** Exact ids or a predicate (aliases so the art survives catalog changes). */
  match: string[] | ((id: string, hint?: string) => boolean);
  slots: Slot[];
  layer: "back" | "front";
  draw: (slot: Slot, ctx: SceneCtx, id: string, n: number) => ReactNode;
  /** Grid points where visitors can sit when this item works. */
  seats?: (slot: Slot) => Pt[];
}

export type BubbleIcon = "cup" | "cake" | "laptop" | "doc" | "chat" | "bread" | "box" | "scissors" | "bag" | "app" | "check" | "happy" | "neutral" | "angry" | "dots";

export interface Flow {
  door: Pt;
  inside: Pt;
  queueHead: Pt;
  queueStep: Pt;
  pickup: Pt;
  orderIcons: BubbleIcon[];
  /** Bubble shown when served: mood face (rating) or a deal ✓. */
  done: "mood" | "check";
  carry: "cup" | "bag" | "box" | null;
  /** Items that speed up service (staff). */
  fast: (ok: Set<string>) => number;
  /** Seats available without any item (e.g. a sofa built into the room). */
  baseSeats?: Pt[];
}

export interface Art {
  key: string;
  /** Visitor wording for a11y. */
  visitors: string;
  Background: (p: { ctx: SceneCtx }) => ReactNode;
  /** Fixed fixtures drawn after back items (counters, desks that always exist). */
  Fixtures?: (p: { ctx: SceneCtx }) => ReactNode;
  sprites: SpriteDef[];
  /** Floor spots for items no rule or hint pool claims. */
  extraSlots: Slot[];
  /** Fallback places per catalog slot hint (wall, counter, screen, desk, server, cloud, staff, street, annex…). */
  hints: Partial<Record<string, Slot[]>>;
  flow: Flow;
}
