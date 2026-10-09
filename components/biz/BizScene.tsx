"use client";
// «Мой бизнес» diorama: data-driven isometric scene. Art per business type lives in components/biz/art/*.
// Visitors are a small pool (≤12) driven by one requestAnimationFrame loop that mutates SVG attributes directly
// (no React re-render per frame). Paused when the tab is hidden or the scene is off-screen; static with reduced motion.
import { useEffect, useMemo, useRef, useState } from "react";
import { rub } from "@/lib/client/format";
import { artFor, layout, type Art, type BubbleIcon, type SceneCtx, type Tod } from "./art";
import { C, GenericTile, LOOKS, P, Person, RepairMark, VIEW, pts, type Pt } from "./art/iso";
import { Defs } from "./art/room";
import { HintSprite, isReward } from "./art/generic";
import { CHALLENGE_ITEMS } from "@/lib/biz/catalog";

export interface SceneCatalogItem {
  id: string;
  title: string;
  price: number;
  state: string;
  reason?: string;
  /** Catalog slot hint (wall, counter, screen, desk, staff, cloud…). */
  slot?: string;
  challenge?: boolean;
}

interface Props {
  owned: { itemId: string; status: string }[];
  level: number;
  guests: number;
  name: string;
  kind?: string;
  kindTitle?: string;
  rating?: number;
  /** 0..100 from the engine; drives mood bubbles (falls back to rating). */
  mood?: number;
  catalog?: SceneCatalogItem[];
  /** Tap on an empty slot's price chip (e.g. scroll to that upgrade). */
  onPick?: (itemId: string) => void;
}

const POOL = 12;
const ICONS: BubbleIcon[] = ["cup", "cake", "laptop", "doc", "chat", "bread", "box", "scissors", "bag", "app", "check", "happy", "neutral", "angry", "dots"];

const todNow = (): Tod => {
  const h = new Date().getHours();
  return h >= 8 && h < 18 ? "day" : h >= 6 && h < 21 ? "eve" : "night";
};

function BubbleIconArt({ icon }: { icon: BubbleIcon }) {
  switch (icon) {
    case "cup":
      return <path d="M-5 -9 h8 v4 a4 4 0 0 1 -8 0 Z M3 -8 q3 0 3 2.4 q0 2.4 -3 2.4" fill={C.g7} stroke={C.g7} strokeWidth={0.8} />;
    case "cake":
      return (
        <g>
          <path d="M-6 -2 v-5 l11 -4 v9 Z" fill={C.g6} />
          <path d="M-6 -7 l11 -4" stroke={C.w} strokeWidth={1.4} />
          <circle cx={3} cy={-12} r={1.4} fill={C.ink} />
        </g>
      );
    case "laptop":
      return (
        <g>
          <rect x={-5} y={-11} width={10} height={7} rx={1} fill={C.ink} />
          <rect x={-3.8} y={-10} width={7.6} height={5} fill={C.g5} />
          <path d="M-7 -3 h14 l-1 -1 h-12 Z" fill={C.ink3} stroke={C.ink3} />
        </g>
      );
    case "doc":
      return (
        <g>
          <path d="M-4 -12 h6 l3 3 v9 h-9 Z" fill={C.w} stroke={C.ink} strokeWidth={1} />
          <path d="M-2 -7 h5 M-2 -4.5 h5" stroke={C.g7} strokeWidth={1.1} />
        </g>
      );
    case "chat":
      return <path d="M-6 -11 h12 v7 h-6 l-3 3 v-3 h-3 Z" fill={C.g6} />;
    case "app":
      return (
        <g>
          <rect x={-3.5} y={-12.5} width={7} height={12} rx={1.6} fill={C.ink} />
          <rect x={-2.4} y={-11} width={4.8} height={8} rx={0.6} fill={C.g5} />
        </g>
      );
    case "bread":
      return <path d="M-6 -4 q0 -7 6 -7 q6 0 6 7 Z M-3 -9 l1.6 3 M0 -10 l1.4 3.4 M3 -9 l1.2 3" fill={C.n5} stroke={C.ink3} strokeWidth={0.8} />;
    case "box":
      return (
        <g>
          <path d="M-6 -9 l6 -3 6 3 v7 l-6 3 -6 -3 Z" fill={C.g4} />
          <path d="M-6 -9 l6 3 6 -3 M0 -6 v7" stroke={C.g8} strokeWidth={0.9} fill="none" />
        </g>
      );
    case "bag":
      return <path d="M-5 -9 h10 l1 9 h-12 Z M-2.4 -9 v-2 a2.4 2.4 0 0 1 4.8 0 v2" fill={C.g6} stroke={C.g8} strokeWidth={0.9} />;
    case "scissors":
      return (
        <g stroke={C.ink} strokeWidth={1.3} fill="none">
          <circle cx={-3.5} cy={-3.5} r={2} />
          <circle cx={3.5} cy={-3.5} r={2} />
          <path d="M-2 -5 l6 -7 M2 -5 l-6 -7" />
        </g>
      );
    case "check":
      return (
        <g>
          <circle cx={0} cy={-6.5} r={6} fill={C.g6} />
          <path d="M-3 -6.5 l2.2 2.3 4 -4.6" stroke={C.w} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "happy":
    case "neutral":
    case "angry":
      return (
        <g>
          <circle cx={0} cy={-6.5} r={6} fill={icon === "happy" ? C.g5 : icon === "neutral" ? C.n4 : C.ink} />
          <circle cx={-2.1} cy={-8} r={0.9} fill={icon === "angry" ? C.w : C.ink} />
          <circle cx={2.1} cy={-8} r={0.9} fill={icon === "angry" ? C.w : C.ink} />
          {icon === "happy" && <path d="M-3 -5.4 q3 3.4 6 0" stroke={C.ink} strokeWidth={1.1} fill="none" strokeLinecap="round" />}
          {icon === "neutral" && <path d="M-2.6 -4.2 h5.2" stroke={C.ink} strokeWidth={1.1} strokeLinecap="round" />}
          {icon === "angry" && <path d="M-3 -3.4 q3 -2.8 6 0 M-3.4 -10 l2.4 1 M3.4 -10 l-2.4 1" stroke={C.w} strokeWidth={1.1} fill="none" strokeLinecap="round" />}
        </g>
      );
    case "dots":
      return (
        <g className="bz-dots">
          {[-4, 0, 4].map((x) => (
            <circle key={x} cx={x} cy={-6.5} r={1.4} fill={C.ink3} />
          ))}
        </g>
      );
  }
}

/** One pooled visitor: outer <g> is moved by the engine; data-b selects the bubble icon. */
function Visitor({ i, carry }: { i: number; carry: Art["flow"]["carry"] }) {
  return (
    <g className="bz-v" data-v={i} opacity={0}>
      <g className="bz-vf">
        <Person look={LOOKS[(i * 3) % LOOKS.length]}>
          {carry && (
            <g className="bz-carry">
              {carry === "cup" && <path d="M5 -15 h5 v5 a2.5 2.5 0 0 1 -5 0 Z" fill={C.w} stroke={C.ink3} strokeWidth={0.6} />}
              {carry === "bag" && <path d="M5 -15 h7 l1 8 h-9 Z" fill={C.n1} stroke={C.ink3} strokeWidth={0.6} />}
              {carry === "box" && <rect x={3} y={-20} width={10} height={9} rx={1} fill={C.g4} stroke={C.g8} strokeWidth={0.6} />}
            </g>
          )}
        </Person>
      </g>
      <g className="bz-bub" transform="translate(0 -36)">
        <path d="M-10 -14 h20 a3 3 0 0 1 3 3 v11 a3 3 0 0 1 -3 3 h-7 l-3 4 -3 -4 h-7 a3 3 0 0 1 -3 -3 v-11 a3 3 0 0 1 3 -3 Z" fill={C.w} stroke={C.ink} strokeWidth={0.8} />
        <g transform="translate(0 2)">
          {ICONS.map((ic) => (
            <g key={ic} className={`bi bi-${ic}`}>
              <BubbleIconArt icon={ic} />
            </g>
          ))}
        </g>
      </g>
    </g>
  );
}

type Phase = "off" | "in" | "q" | "order" | "toPick" | "wait" | "toSeat" | "sit" | "leave";
interface V {
  phase: Phase;
  x: number;
  y: number;
  path: Pt[];
  t: number;
  speed: number;
  bub: BubbleIcon | null;
  bubT: number;
  carry: boolean;
  seat: number;
  alpha: number;
  flip: number;
  cls: string;
  tr: string;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function BizScene({ owned, level, guests, name, kind = "coffee", kindTitle = "", rating = 3.5, mood, catalog, onPick }: Props) {
  const art = useMemo(() => artFor(kind, kindTitle), [kind, kindTitle]);
  const [tod, setTod] = useState<Tod>(todNow);
  const [sel, setSel] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setTod(todNow()), 5 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  const titles = useMemo(() => new Map((catalog ?? []).map((c) => [c.id, c.title])), [catalog]);
  const ctx: SceneCtx = useMemo(
    () => ({
      ok: new Set(owned.filter((o) => o.status === "ok").map((o) => o.itemId)),
      has: new Set(owned.map((o) => o.itemId)),
      level,
      name,
      tod,
      title: (id) => titles.get(id) ?? CHALLENGE_ITEMS.find((c) => c.id === id)?.title ?? id,
    }),
    [owned, level, name, tod, titles],
  );

  const ids = useMemo(() => {
    const hintOf = (id: string) => catalog?.find((c) => c.id === id)?.slot ?? CHALLENGE_ITEMS.find((c) => c.id === id)?.slot ?? null;
    return [...(catalog ?? []).filter((c) => !c.challenge || owned.some((o) => o.itemId === c.id)), ...owned.map((o) => ({ id: o.itemId }))].map((x) => ({ id: "id" in x ? x.id : "", hint: hintOf(x.id) }));
  }, [catalog, owned]);
  const placed = useMemo(() => layout(art, ids), [art, ids]);

  const seats = useMemo(() => {
    const s: Pt[] = [...(art.flow.baseSeats ?? [])];
    for (const o of owned) {
      if (o.status !== "ok") continue;
      const p = placed.get(o.itemId);
      if (p?.def?.seats) s.push(...p.def.seats(p.slot));
    }
    return s;
  }, [art, owned, placed]);

  const maxActive = Math.max(3, Math.min(POOL, Math.round(2 + guests / 14)));
  const spawnEvery = Math.max(1.3, Math.min(9, 9 - guests / 15));
  const fast = art.flow.fast(ctx.ok);

  // ── visitor engine ──
  useEffect(() => {
    const layer = layerRef.current;
    const svg = svgRef.current;
    if (!layer || !svg) return;
    const nodes = Array.from(layer.querySelectorAll<SVGGElement>(":scope > .bz-v"));
    const flips = nodes.map((n) => n.querySelector<SVGGElement>(".bz-vf"));
    const F = art.flow;
    const vs: V[] = nodes.map(() => ({ phase: "off", x: 0, y: 0, path: [], t: 0, speed: 1.3, bub: null, bubT: 0, carry: false, seat: -1, alpha: 0, flip: 1, cls: "", tr: "" }));
    const queue: number[] = [];
    const taken = new Set<number>();
    const qSlot = (i: number): Pt => [F.queueHead[0] + F.queueStep[0] * i, F.queueHead[1] + F.queueStep[1] * i];
    const pickMood = (): BubbleIcon => {
      if (F.done === "check") return "check";
      const r = Math.random();
      const m = mood ?? (rating - 1) * 25;
      const pH = Math.min(0.9, Math.max(0.05, (m - 35) / 50));
      const pA = Math.min(0.7, Math.max(0, (50 - m) / 60));
      return r < pH ? "happy" : r < pH + pA ? "angry" : "neutral";
    };

    const paint = (v: V, i: number) => {
      const node = nodes[i];
      const walking = v.path.length > 0 && v.phase !== "off";
      const cls = `bz-v${walking ? " is-walk" : ""}${v.phase === "sit" ? " is-sit" : ""}${v.carry ? " is-carry" : ""}`;
      if (cls !== v.cls) {
        node.setAttribute("class", cls);
        v.cls = cls;
      }
      const b = v.bub ?? "";
      if (node.getAttribute("data-b") !== b) node.setAttribute("data-b", b);
      const [sx, sy] = P(v.x, v.y);
      const tr = `translate(${sx.toFixed(1)} ${(sy + (v.phase === "sit" ? -4 : 0)).toFixed(1)})`;
      if (tr !== v.tr) {
        node.setAttribute("transform", tr);
        v.tr = tr;
      }
      node.setAttribute("opacity", v.alpha.toFixed(2));
      flips[i]?.setAttribute("transform", `scale(${v.flip} 1)`);
    };

    const spawn = () => {
      const i = vs.findIndex((v) => v.phase === "off");
      if (i < 0) return;
      const v = vs[i];
      Object.assign(v, { phase: "in", x: F.door[0], y: F.door[1], path: [F.inside, qSlot(queue.length)], t: 0, speed: 1.15 + Math.random() * 0.35, bub: null, bubT: 0, carry: false, seat: -1, alpha: 0 });
      queue.push(i);
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // Static tableau: a short queue, someone waiting, someone seated.
      const n = Math.min(maxActive, 4);
      for (let k = 0; k < n; k++) {
        const v = vs[k];
        const [x, y] = k < 2 ? qSlot(k) : k === 2 ? F.pickup : seats[0] ?? qSlot(2);
        Object.assign(v, { phase: k === 3 && seats[0] ? "sit" : "q", x, y, alpha: 1, bub: k === 0 ? F.orderIcons[0] : k === 2 ? pickMood() : null, carry: k >= 2 });
        paint(v, k);
      }
      return;
    }

    let raf = 0;
    let last = 0;
    let spawnT = 0.4;
    let sortT = 0;
    let running = false;

    const step = (dt: number) => {
      spawnT -= dt;
      const active = vs.filter((v) => v.phase !== "off").length;
      if (spawnT <= 0) {
        if (active < maxActive && queue.length < 5) spawn();
        spawnT = spawnEvery * (0.7 + Math.random() * 0.6);
      }
      vs.forEach((v, i) => {
        if (v.phase === "off") return;
        // queue positions follow the line as it advances
        if (v.phase === "q" || v.phase === "in") {
          const qi = queue.indexOf(i);
          const target = qSlot(qi);
          const end = v.path[v.path.length - 1];
          if (v.phase === "q" && (!end || dist(end, target) > 0.01) && dist([v.x, v.y], target) > 0.02) v.path = [target];
          if (v.phase === "in" && end && dist(end, target) > 0.01) v.path[v.path.length - 1] = target;
          if (v.phase === "q" && qi === 0 && v.path.length === 0) {
            v.phase = "order";
            v.t = (1.4 + Math.random()) / fast;
            v.bub = F.orderIcons[Math.floor(Math.random() * F.orderIcons.length)];
          }
        }
        // walk
        if (v.path.length) {
          const tgt = v.path[0];
          const d = dist([v.x, v.y], tgt);
          const mv = v.speed * dt;
          const [ax] = P(v.x, v.y);
          if (d <= mv) {
            v.x = tgt[0];
            v.y = tgt[1];
            v.path.shift();
          } else {
            v.x += ((tgt[0] - v.x) / d) * mv;
            v.y += ((tgt[1] - v.y) / d) * mv;
          }
          const [bx] = P(v.x, v.y);
          if (Math.abs(bx - ax) > 0.01) v.flip = bx < ax ? -1 : 1;
        }
        if (v.phase === "in") {
          v.alpha = Math.min(1, v.alpha + dt * 2.5);
          if (!v.path.length) v.phase = "q";
        }
        if (v.bubT > 0) {
          v.bubT -= dt;
          if (v.bubT <= 0) v.bub = null;
        }
        switch (v.phase) {
          case "order":
            v.t -= dt;
            if (v.t <= 0) {
              queue.splice(queue.indexOf(i), 1);
              v.phase = "toPick";
              v.bub = "dots";
              v.path = [[F.pickup[0] + (Math.random() - 0.5) * 0.5, F.pickup[1] + Math.random() * 0.4]];
            }
            break;
          case "toPick":
            if (!v.path.length) {
              v.phase = "wait";
              v.t = (1.6 + Math.random() * 1.4) / fast;
            }
            break;
          case "wait":
            v.t -= dt;
            if (v.t <= 0) {
              v.carry = !!F.carry;
              v.bub = pickMood();
              v.bubT = 1.8;
              const free = seats.map((_, k) => k).filter((k) => !taken.has(k));
              if (free.length && Math.random() < 0.75) {
                const k = free[Math.floor(Math.random() * free.length)];
                taken.add(k);
                v.seat = k;
                v.phase = "toSeat";
                v.path = [seats[k]];
              } else {
                v.phase = "leave";
                v.path = [F.inside, F.door];
              }
            }
            break;
          case "toSeat":
            if (!v.path.length) {
              v.phase = "sit";
              v.t = 5 + Math.random() * 5;
              v.flip = 1;
            }
            break;
          case "sit":
            v.t -= dt;
            if (v.t <= 0) {
              taken.delete(v.seat);
              v.seat = -1;
              v.phase = "leave";
              if (F.done === "check") {
                v.bub = "check";
                v.bubT = 1.4;
              }
              v.path = [F.inside, F.door];
            }
            break;
          case "leave":
            if (v.path.length <= 1) v.alpha = Math.max(0, Math.min(v.alpha, dist([v.x, v.y], F.door) * 1.6));
            if (!v.path.length) {
              v.phase = "off";
              v.alpha = 0;
              v.bub = null;
              v.carry = false;
            }
            break;
        }
        paint(v, i);
        if (v.phase === "off") paint(v, i);
      });
      // depth: re-order pooled nodes by screen y every ~0.3s
      sortT -= dt;
      if (sortT <= 0) {
        sortT = 0.3;
        const order = vs.map((v, i) => ({ i, y: v.x + v.y })).sort((a, b) => a.y - b.y);
        order.forEach(({ i }) => layer.appendChild(nodes[i]));
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      step(dt);
      raf = requestAnimationFrame(frame);
    };
    let visible = true;
    const sync = () => {
      const want = visible && document.visibilityState === "visible";
      if (want && !running) {
        running = true;
        last = 0;
        raf = requestAnimationFrame(frame);
      } else if (!want && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
      svg.toggleAttribute("data-paused", !want);
    };
    const io = new IntersectionObserver((e) => {
      visible = e[0]?.isIntersecting ?? true;
      sync();
    });
    io.observe(svg);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [art, maxActive, spawnEvery, fast, seats, rating, mood]);

  const ownedMap = useMemo(() => new Map(owned.map((o) => [o.itemId, o.status])), [owned]);
  const renderItem = (id: string, layer: "back" | "front") => {
    const p = placed.get(id);
    if (!p) return null;
    const l = p.def?.layer ?? (p.hint && ["cloud", "street", "outside", "annex"].includes(p.hint) ? "front" : "back");
    if (l !== layer) return null;
    const broken = ownedMap.get(id) !== "ok";
    const s = p.slot;
    const rz = s.wall ? Math.min(70, s.z ?? 50) - 20 : 0;
    const mark: Pt = s.wall === "R" ? [s.gx + (s.w ?? 1) / 2, 0.3] : s.wall === "L" ? [0.3, s.gy + (s.d ?? 1) / 2] : [s.gx + (s.w ?? 0.8) / 2, s.gy + (s.d ?? 0.8) / 2];
    return (
      <g key={id} className={`bz-item${broken ? " is-broken" : ""}`} data-item={id} data-broken={broken || undefined}>
        <title>{`${ctx.title(id)}${broken ? " — на ремонте" : ""}`}</title>
        <g className="bz-sprite">{p.def ? p.def.draw(s, ctx, id, p.n) : p.hint ? <HintSprite hint={p.hint} s={s} id={id} title={ctx.title(id)} n={p.n} /> : <GenericTile gx={s.gx} gy={s.gy} title={ctx.title(id)} reward={isReward(id)} />}</g>
        {broken && p.hint !== "cloud" && <RepairMark gx={mark[0]} gy={mark[1]} z={s.wall ? rz : (s.z ?? 0)} />}
      </g>
    );
  };

  const empty = (catalog ?? []).filter((c) => !ownedMap.has(c.id) && !c.challenge && c.state !== "exclusive");
  const ownedIds = owned.map((o) => o.itemId);

  const slotFor = (id: string) => {
    const s = placed.get(id)!.slot;
    const z = s.z ?? 0;
    const zc = s.z ?? 53;
    if (s.wall === "R") {
      const w = s.w ?? 1;
      return { poly: pts(P(s.gx, 0, zc - 11), P(s.gx + w, 0, zc - 11), P(s.gx + w, 0, zc + 11), P(s.gx, 0, zc + 11)), c: P(s.gx + w / 2, 0, zc) };
    }
    if (s.wall === "L") {
      const d = s.d ?? 1;
      return { poly: pts(P(0, s.gy, zc - 11), P(0, s.gy + d, zc - 11), P(0, s.gy + d, zc + 11), P(0, s.gy, zc + 11)), c: P(0, s.gy + d / 2, zc) };
    }
    const w = Math.min(1.6, s.w ?? 0.8);
    const d = Math.min(1.6, s.d ?? 0.8);
    return { poly: pts(P(s.gx, s.gy, z), P(s.gx + w, s.gy, z), P(s.gx + w, s.gy + d, z), P(s.gx, s.gy + d, z)), c: P(s.gx + w / 2, s.gy + d / 2, z) };
  };

  return (
    <svg
      ref={svgRef}
      className="bz-scene"
      data-tod={tod}
      data-art={art.key}
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      role="img"
      aria-label={`Иллюстрация бизнеса «${name}»: ${owned.length} улучшений, ${art.visitors}: ${guests} в день`}
      onClick={(e) => {
        if (!(e.target as Element).closest(".bz-slot")) setSel(null);
      }}
    >
      <Defs />
      <art.Background ctx={ctx} />
      <g className="bz-layer-back">{ownedIds.map((id) => renderItem(id, "back"))}</g>
      {art.Fixtures && <art.Fixtures ctx={ctx} />}
      <g className="bz-slots">
        {empty.map((c) => {
          const g = slotFor(c.id);
          const on = sel === c.id;
          const locked = c.state === "locked";
          return (
            <g
              key={c.id}
              className={`bz-slot${on ? " is-on" : ""}${locked ? " is-locked" : ""}`}
              data-slot={c.id}
              role="button"
              tabIndex={0}
              aria-label={`${c.title} — ${rub(c.price)}${c.reason ? `. ${c.reason}` : ""}`}
              onClick={() => setSel(on ? null : c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSel(on ? null : c.id);
                }
              }}
            >
              <polygon className="bz-slot-area" points={g.poly} />
              <circle className="bz-slot-hit" cx={g.c[0]} cy={g.c[1]} r={14} />
              <circle className="bz-slot-plus-bg" cx={g.c[0]} cy={g.c[1]} r={6.5} />
              <path className="bz-slot-plus" d={`M${g.c[0] - 3} ${g.c[1]} h6 M${g.c[0]} ${g.c[1] - 3} v6`} />
            </g>
          );
        })}
      </g>
      <g className="bz-visitors" ref={layerRef} aria-hidden>
        {Array.from({ length: POOL }, (_, i) => (
          <Visitor key={i} i={i} carry={art.flow.carry} />
        ))}
      </g>
      <g className="bz-layer-front">{ownedIds.map((id) => renderItem(id, "front"))}</g>
      <rect className="bz-night" x={0} y={0} width={VIEW.w} height={VIEW.h} rx={18} />
      {sel &&
        (() => {
          const c = empty.find((x) => x.id === sel);
          if (!c) return null;
          const g = slotFor(c.id);
          const label = c.title.length > 22 ? `${c.title.slice(0, 21)}…` : c.title;
          const wpx = Math.max(92, label.length * 5.6 + 20);
          const x = Math.min(VIEW.w - wpx / 2 - 6, Math.max(wpx / 2 + 6, g.c[0]));
          const y = Math.max(40, g.c[1] - 14);
          return (
            <g
              className="bz-tip"
              transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
              role="button"
              tabIndex={0}
              aria-label={`Перейти к улучшению «${c.title}»`}
              onClick={(e) => {
                e.stopPropagation();
                onPick?.(c.id);
                setSel(null);
              }}
            >
              <rect x={-wpx / 2} y={-34} width={wpx} height={30} rx={9} />
              <path d="M-5 -4.5 l5 5 5 -5 Z" />
              <text className="bz-tip-t" y={-22}>
                {label}
              </text>
              <text className="bz-tip-p" y={-10}>
                {c.state === "locked" ? `Закрыто · ${rub(c.price)}` : `${rub(c.price)} · купить ›`}
              </text>
            </g>
          );
        })()}
    </svg>
  );
}

export default BizScene;
