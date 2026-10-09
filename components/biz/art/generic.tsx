// Fallback sprites keyed by the catalog's slot hint (wall/counter/screen/desk/server/cloud/staff/street/annex/…)
// and the challenge-reward sprites (ids prefixed "ch-"). Anything new in lib/biz/catalog.ts lands somewhere sensible.
import type { ReactNode } from "react";
import { Box, C, GenericTile, LOOKS, P, Person, RewardBadge, Shadow, WallL, WallR, pts, tf, type Pt } from "./iso";
import { Desk, Plant, Worker } from "./room";
import type { Slot, SpriteDef } from "./types";

export const isReward = (id: string) => id.startsWith("ch-");

/** Flat 2D drawing on a wall plane: local x runs along the wall (screen-right), y is vertical. */
export const OnWall = ({ side, at, children, className }: { side: "L" | "R"; at: Pt; children: ReactNode; className?: string }) => (
  <g className={className} transform={`matrix(1 ${side === "R" ? 0.5 : -0.5} 0 1 ${at[0].toFixed(1)} ${at[1].toFixed(1)})`}>
    {children}
  </g>
);
export const wallPoint = (s: Slot, z: number): Pt => (s.wall === "L" ? P(0, s.gy + (s.d ?? 1) / 2, z) : P(s.gx + (s.w ?? 1) / 2, 0, z));

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const initial = (t: string) => (t.replace(/[«»"'\s]/g, "")[0] ?? "?").toUpperCase();

function Glyph({ kind }: { kind: number }) {
  switch (kind % 5) {
    case 0: // bar chart
      return (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} className={`bz-bar b${i}`} x={-8 + i * 4.4} y={4 - (3 + i * 2.4)} width={3} height={3 + i * 2.4} fill={i === 3 ? C.g4 : C.g6} />
          ))}
        </g>
      );
    case 1: // line chart
      return <path d="M-9 3 l5 -4 4 2 6 -7 3 2" stroke={C.g4} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    case 2: // chat bubbles
      return (
        <g>
          <rect x={-9} y={-6} width={11} height={6} rx={2} fill={C.g6} />
          <rect x={-2} y={1} width={11} height={5} rx={2} fill={C.n1} />
        </g>
      );
    case 3: // phone
      return (
        <g>
          <rect x={-4} y={-8} width={8} height={14} rx={1.6} fill={C.n1} />
          <rect x={-2.8} y={-6.4} width={5.6} height={9} fill={C.g5} />
        </g>
      );
    default: // stars
      return <path d="M-6 -1 l1.2 -3 1.2 3 3 .2 -2.3 2 .7 3 -2.6 -1.6 -2.6 1.6 .7 -3 -2.3 -2 Z M5 -1 l1 -2.4 1 2.4 2.4 .2 -1.8 1.6 .6 2.4 -2.2 -1.3 -2.2 1.3 .6 -2.4 -1.8 -1.6 Z" fill={C.g4} />;
  }
}

/** Wall screen / poster for wall, screen and window hints. */
function WallThing({ s, id, title, hint }: { s: Slot; id: string; title: string; hint: string }) {
  const at = wallPoint(s, s.z ?? 52);
  const screen = hint === "screen";
  return (
    <OnWall side={s.wall ?? "R"} at={at}>
      <rect x={-15} y={-12} width={30} height={22} rx={2} fill={C.ink} />
      <rect x={-13} y={-10} width={26} height={18} rx={1} fill={screen ? C.g9 : C.n1} />
      {screen ? (
        <g transform="translate(0 0)">
          <Glyph kind={hash(id)} />
        </g>
      ) : (
        <text x={0} y={4} textAnchor="middle" fontSize={11} fontWeight={800} fill={C.g7} style={{ fontFamily: "var(--font-sans, system-ui)" }}>
          {initial(title)}
        </text>
      )}
      {screen && <circle cx={11} cy={-8} r={1} fill={C.g4} className="bz-blink" />}
    </OnWall>
  );
}

/** Small object on a counter/desk for counter hints. */
function CounterThing({ s, id }: { s: Slot; id: string }) {
  const z = s.z ?? 24;
  const v = hash(id) % 3;
  const [x, y] = P(s.gx + 0.2, s.gy + 0.2, z);
  return (
    <g>
      <ellipse cx={x} cy={y} rx={8} ry={3} fill={C.ink} opacity={0.15} />
      {v === 0 && <Box gx={s.gx} gy={s.gy} w={0.4} d={0.35} h={10} z={z} top={C.g4} left={C.g6} right={C.g7} />}
      {v === 1 && (
        <g transform={`translate(${x} ${y})`}>
          <path d="M-5 0 v-11 a5 2 0 0 1 10 0 v11 a5 2 0 0 1 -10 0 Z" fill={C.n1} stroke={C.n5} strokeWidth={0.5} />
          <ellipse cx={0} cy={-11} rx={5} ry={2} fill={C.g6} />
        </g>
      )}
      {v === 2 && (
        <g transform={`translate(${x} ${y})`}>
          <rect x={-6} y={-12} width={12} height={10} rx={1.5} fill={C.ink} />
          <rect x={-4.6} y={-10.6} width={9.2} height={6} fill={C.g5} />
          <rect x={-2} y={-2} width={4} height={2} fill={C.ink3} />
        </g>
      )}
    </g>
  );
}

function Server({ s }: { s: Slot }) {
  return (
    <g>
      <Shadow gx={s.gx + 0.4} gy={s.gy + 0.4} rx={14} ry={6} />
      <Box gx={s.gx} gy={s.gy} w={0.7} d={0.6} h={48} top={C.ink3} left={C.ink2} right={C.ink} />
      {[8, 18, 28, 38].map((z, i) => (
        <g key={z}>
          <polygon points={pts(P(s.gx + 0.06, s.gy + 0.6, z), P(s.gx + 0.64, s.gy + 0.6, z), P(s.gx + 0.64, s.gy + 0.6, z + 6), P(s.gx + 0.06, s.gy + 0.6, z + 6))} fill={C.ink} />
          {(() => {
            const [x, y] = P(s.gx + 0.16, s.gy + 0.6, z + 3);
            return <circle cx={x} cy={y} r={1.1} fill={i % 2 ? C.g5 : C.g3} className={`bz-led d${i % 3}`} />;
          })()}
        </g>
      ))}
    </g>
  );
}

/** Floating cloud above the room: online services (подписки, биллинг, интеграции…). */
function CloudThing({ s, id, title }: { s: Slot; id: string; title: string }) {
  const [x, y] = P(s.gx, s.gy, s.z ?? 130);
  return (
    <g className="bz-float" style={{ animationDelay: `${-(hash(id) % 40) / 10}s` }}>
      <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
        <path d="M-17 6 a7 7 0 0 1 2 -13.5 a9 9 0 0 1 17 -3 a7 7 0 0 1 12 6 a5.5 5.5 0 0 1 -1 10.5 Z" fill={C.w} stroke={C.g4} strokeWidth={1} />
        <circle cx={0} cy={0} r={6} fill={C.g6} />
        <text x={0} y={3} textAnchor="middle" fontSize={7.5} fontWeight={800} fill={C.w} style={{ fontFamily: "var(--font-sans, system-ui)" }}>
          {initial(title)}
        </text>
        <path d="M0 8 v8" stroke={C.g4} strokeWidth={0.8} strokeDasharray="2 2" />
      </g>
    </g>
  );
}

/** Small pavilion on the slab: a branch, a second office, a warehouse. */
function Annex({ s, title }: { s: Slot; title: string }) {
  const { gx, gy } = s;
  const [x, y] = P(gx + 0.8, gy + 1.2, 30);
  return (
    <g>
      <Shadow gx={gx + 0.8} gy={gy + 0.7} rx={34} ry={12} />
      <Box gx={gx} gy={gy} w={1.5} d={1.2} h={28} top={C.n1} left={C.n2} right={C.n3} />
      <Box gx={gx - 0.06} gy={gy - 0.06} w={1.62} d={1.32} h={5} z={28} top={C.g6} left={C.g7} right={C.g8} />
      <polygon points={pts(P(gx + 0.3, gy + 1.2, 0), P(gx + 0.75, gy + 1.2, 0), P(gx + 0.75, gy + 1.2, 18), P(gx + 0.3, gy + 1.2, 18))} fill={C.g9} />
      <polygon points={pts(P(gx + 1.5, gy + 0.25, 8), P(gx + 1.5, gy + 0.95, 8), P(gx + 1.5, gy + 0.95, 20), P(gx + 1.5, gy + 0.25, 20))} fill="url(#bz-sky)" />
      <circle cx={x} cy={y - 10} r={5.5} fill={C.ink} />
      <text x={x} y={y - 7.6} textAnchor="middle" fontSize={7} fontWeight={800} fill={C.g4} style={{ fontFamily: "var(--font-sans, system-ui)" }}>
        {initial(title)}
      </text>
    </g>
  );
}

function StreetThing({ s, title }: { s: Slot; title: string }) {
  const [x, y] = P(s.gx + 0.3, s.gy + 0.3);
  return (
    <g>
      <ellipse cx={x} cy={y} rx={12} ry={4} fill={C.ink} opacity={0.18} />
      <path d={`M${x - 8} ${y} l4 -22 h8 l4 22`} stroke={C.ink2} strokeWidth={1.6} fill="none" />
      <path d={`M${x - 7} ${y - 6} l3 -16 h8 l3 16 Z`} fill={C.ink} />
      <text x={x} y={y - 11} textAnchor="middle" fontSize={7.5} fontWeight={800} fill={C.g4} style={{ fontFamily: "var(--font-sans, system-ui)" }}>
        {initial(title)}
      </text>
    </g>
  );
}

/** Draw any item by its catalog slot hint. */
export function HintSprite({ hint, s, id, title, n }: { hint: string; s: Slot; id: string; title: string; n: number }) {
  switch (hint) {
    case "wall":
    case "screen":
    case "window":
      return <WallThing s={s} id={id} title={title} hint={hint} />;
    case "counter":
      return <CounterThing s={s} id={id} />;
    case "server":
      return <Server s={s} />;
    case "cloud":
      return <CloudThing s={s} id={id} title={title} />;
    case "annex":
      return <Annex s={s} title={title} />;
    case "street":
    case "outside":
      return <StreetThing s={s} title={title} />;
    case "desk":
      return (
        <g>
          <Desk gx={s.gx} gy={s.gy} monitors={2} />
        </g>
      );
    case "staff":
      return s.desk ? (
        <g>
          <Desk gx={s.gx} gy={s.gy} laptop={n % 2 === 0} />
          <Worker gx={s.gx + 0.7} gy={s.gy + 1.15} look={LOOKS[(n + 3) % LOOKS.length]} />
        </g>
      ) : (
        <g transform={tf(s.gx, s.gy)}>
          <g className={n % 2 ? "bz-route" : "bz-idle"}>
            <Person look={LOOKS[(n + 1) % LOOKS.length]} apron={C.g7} />
          </g>
        </g>
      );
    default:
      return <GenericTile gx={s.gx} gy={s.gy} title={title} />;
  }
}

// ── challenge rewards ──
function Frame({ s, id }: { s: Slot; id: string }) {
  const at = wallPoint(s, s.z ?? 50);
  const k = /budget|pie|50/.test(id) ? "pie" : /debt|chain/.test(id) ? "chain" : /notebook|spend/.test(id) ? "note" : /compare|deposit|table/.test(id) ? "table" : /interview|board/.test(id) ? "board" : /subs/.test(id) ? "minus" : "cup";
  return (
    <OnWall side={s.wall ?? "R"} at={at}>
      <rect x={-11} y={-10} width={22} height={18} rx={1.5} fill={C.ink} />
      <rect x={-9} y={-8} width={18} height={14} fill={k === "board" ? C.w : C.n1} />
      {k === "pie" && (
        <g transform="translate(0 -1)">
          <circle r={5.5} fill={C.g3} />
          <path d="M0 0 V-5.5 A5.5 5.5 0 0 1 5.2 1.8 Z" fill={C.g7} />
          <path d="M0 0 L5.2 1.8 A5.5 5.5 0 0 1 -1 5.4 Z" fill={C.g5} />
        </g>
      )}
      {k === "chain" && <path d="M-6 -1 a2.4 2.4 0 0 1 4 -2 M2 1 a2.4 2.4 0 0 0 4 -2 M-2 -3 l1 1.4 M1 0 l1 1.4" stroke={C.ink} strokeWidth={1.4} fill="none" />}
      {k === "note" && (
        <g>
          <rect x={-5} y={-6} width={10} height={11} fill={C.w} stroke={C.ink3} strokeWidth={0.6} />
          <path d="M-3 -3 h6 M-3 0 h6 M-3 3 h4" stroke={C.g7} strokeWidth={0.9} />
        </g>
      )}
      {k === "table" && <path d="M-7 -5 h14 M-7 -1 h14 M-7 3 h14 M-2 -6 v10" stroke={C.ink3} strokeWidth={0.8} />}
      {k === "board" && [0, 1, 2, 3, 4].map((i) => <rect key={i} x={-7 + (i % 3) * 5} y={-6 + Math.floor(i / 3) * 6} width={4} height={4} fill={i % 2 ? C.g3 : C.g5} />)}
      {k === "minus" && <path d="M-5 -1 h10" stroke={C.g7} strokeWidth={2.4} strokeLinecap="round" />}
      {k === "cup" && <path d="M-4 -5 h8 q0 6 -4 6 q-4 0 -4 -6 Z M-1 1 h2 v2 h2 v1 h-6 v-1 h2 Z" fill={C.g6} />}
      <RewardBadge x={11} y={-10} />
    </OnWall>
  );
}

function ShelfObject({ s, id }: { s: Slot; id: string }) {
  const z = s.z ?? 60;
  const [x, y] = s.wall === "L" ? P(0.25, s.gy, z) : P(s.gx, 0.25, z);
  const k = /coffee|mug/.test(id) ? "mug" : /lunch|delivery/.test(id) ? "lunch" : /bond|globe/.test(id) ? "globe" : /ai|robot/.test(id) ? "robot" : /unit|calc/.test(id) ? "calc" : "cup";
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      {k === "mug" && <path d="M-3.5 0 v-9 h7 v9 Z M3.5 -7 q3 0 3 2.5 q0 2.5 -3 2.5" fill={C.g6} stroke={C.g8} strokeWidth={0.7} />}
      {k === "lunch" && (
        <g>
          <rect x={-6} y={-7} width={12} height={7} rx={1.5} fill={C.g5} />
          <rect x={-6} y={-9} width={12} height={2.5} rx={1} fill={C.g8} />
        </g>
      )}
      {k === "globe" && (
        <g>
          <path d="M-3 0 h6 l-1 -2 h-4 Z" fill={C.ink} />
          <circle cx={0} cy={-8} r={5.5} fill={C.g5} />
          <path d="M-3 -10 q2 -1 3 1 q2 2 1 4 M1 -12 q2 0 3 2" stroke={C.g8} strokeWidth={1} fill="none" />
        </g>
      )}
      {k === "robot" && (
        <g className="bz-idle">
          <rect x={-4.5} y={-7} width={9} height={7} rx={1.5} fill={C.n4} />
          <rect x={-3.5} y={-13} width={7} height={6} rx={1.5} fill={C.n1} stroke={C.n5} strokeWidth={0.6} />
          <circle cx={-1.4} cy={-10} r={0.9} fill={C.g6} className="bz-blink" />
          <circle cx={1.4} cy={-10} r={0.9} fill={C.g6} className="bz-blink" />
        </g>
      )}
      {k === "calc" && (
        <g>
          <rect x={-4} y={-11} width={8} height={11} rx={1} fill={C.ink} />
          <rect x={-3} y={-10} width={6} height={3} fill={C.g4} />
          {[0, 1, 2].map((i) => [0, 1].map((j) => <rect key={`${i}${j}`} x={-3 + i * 2.2} y={-6 + j * 2.4} width={1.6} height={1.6} fill={C.n4} />))}
        </g>
      )}
      {k === "cup" && <path d="M-4 -12 h8 q0 7 -4 7 q-4 0 -4 -7 Z M-1 -5 h2 v3 h2 v2 h-6 v-2 h2 Z" fill={C.g5} />}
      <RewardBadge x={7} y={-12} />
    </g>
  );
}

function FloorReward({ s, id }: { s: Slot; id: string }) {
  const [x, y] = P(s.gx + 0.35, s.gy + 0.35, 14);
  const k = /big|pig|week/.test(id) ? "pig" : /sell|avito|box/.test(id) ? "box" : /safe|crypto/.test(id) ? "safe" : /raise|tie/.test(id) ? "tie" : "trophy";
  return (
    <g>
      <Shadow gx={s.gx + 0.35} gy={s.gy + 0.35} rx={13} ry={5} />
      {k === "safe" ? (
        <g>
          <Box gx={s.gx} gy={s.gy} w={0.7} d={0.7} h={24} top={C.ink3} left={C.ink2} right={C.ink} />
          {(() => {
            const [a, b] = P(s.gx + 0.35, s.gy + 0.7, 12);
            return (
              <g>
                <circle cx={a} cy={b} r={4} fill="url(#bz-metal)" />
                <circle cx={a + 7} cy={b + 3} r={1.6} fill={C.g5} />
                <circle cx={a - 7} cy={b - 3} r={1.6} fill={C.g5} />
              </g>
            );
          })()}
        </g>
      ) : k === "box" ? (
        <g>
          <Box gx={s.gx} gy={s.gy} w={0.7} d={0.6} h={16} top={C.g3} left={C.g4} right={C.g5} />
          <OnWall side="L" at={P(s.gx + 0.35, s.gy + 0.6, 8)}>
            <rect x={-9} y={-3.5} width={18} height={7} rx={1} fill={C.ink} transform="rotate(-8)" />
            <text y={2} textAnchor="middle" fontSize={5} fontWeight={800} fill={C.g4} transform="rotate(-8)" style={{ fontFamily: "var(--font-sans, system-ui)" }}>
              ПРОДАНО
            </text>
          </OnWall>
        </g>
      ) : (
        <g>
          <Box gx={s.gx} gy={s.gy} w={0.7} d={0.7} h={14} top={C.ink3} left={C.ink2} right={C.ink} />
          <g transform={`translate(${x} ${y})`} className="bz-shine">
            {k === "pig" && (
              <g>
                <ellipse cx={0} cy={-9} rx={11} ry={8} fill={C.g6} />
                <circle cx={9} cy={-11} r={4.5} fill={C.g5} />
                <ellipse cx={12.5} cy={-11} rx={2} ry={2.4} fill={C.g7} />
                <path d="M3 -18 l2 -4 2 4 Z" fill={C.g7} />
                <rect x={-7} y={-3} width={3} height={4} fill={C.g8} />
                <rect x={4} y={-3} width={3} height={4} fill={C.g8} />
                <rect x={-3} y={-17.5} width={6} height={1.6} rx={0.8} fill={C.ink} />
                <ellipse cx={-4} cy={-12} rx={3} ry={2} fill={C.w} opacity={0.35} />
              </g>
            )}
            {k === "tie" && (
              <g>
                <path d="M0 0 v-30 M-8 -30 h16" stroke={C.ink2} strokeWidth={1.6} />
                <path d="M-2 -28 h4 l-1 3 3 12 -4 4 -4 -4 3 -12 Z" fill={C.g6} />
              </g>
            )}
            {k === "trophy" && (
              <g>
                <rect x={-5} y={-3} width={10} height={3} rx={1} fill={C.ink} />
                <rect x={-1.4} y={-8} width={2.8} height={5} fill={C.g6} />
                <path d="M-7 -20 h14 q0 12 -7 12 q-7 0 -7 -12 Z" fill={C.g5} />
                <path d="M-7 -18 q-5 0 -4 4 q1 3 5 2 M7 -18 q5 0 4 4 q-1 3 -5 2" stroke={C.g6} strokeWidth={1.6} fill="none" />
              </g>
            )}
          </g>
        </g>
      )}
      <RewardBadge x={x + 13} y={y - 20} />
    </g>
  );
}

function RewardNeon({ s }: { s: Slot }) {
  const at = wallPoint(s, s.z ?? 64);
  return (
    <OnWall side={s.wall ?? "R"} at={at} className="bz-neon-on">
      <rect x={-20} y={-9} width={40} height={16} rx={3} fill={C.ink} />
      <text y={3} textAnchor="middle" fontSize={8} fontWeight={800} className="bz-neon-text" style={{ fontFamily: "var(--font-sans, system-ui)" }}>
        LANDING
      </text>
      <RewardBadge x={20} y={-9} />
    </OnWall>
  );
}

export interface RewardPlaces {
  frames: Slot[];
  shelf: Slot[];
  floor: Slot[];
  neon: Slot[];
}
/** Wall shelf drawn under counter-type rewards. */
export function RewardShelf({ s }: { s: Slot[] }) {
  if (!s.length) return null;
  const a = s[0];
  const b = s[s.length - 1];
  const z = (a.z ?? 60) - 1;
  if (a.wall === "L") return <WallL gy0={a.gy - 0.35} gy1={b.gy + 0.35} z0={z - 2} z1={z} fill={C.ink2} />;
  return <WallR gx0={a.gx - 0.35} gx1={b.gx + 0.35} z0={z - 2} z1={z} fill={C.ink2} />;
}

export function rewardSprites(p: RewardPlaces): SpriteDef[] {
  return [
    { match: (id, h) => isReward(id) && h === "window", slots: p.neon, layer: "back", draw: (s) => <RewardNeon s={s} /> },
    { match: (id, h) => isReward(id) && h === "wall", slots: p.frames, layer: "back", draw: (s, _c, id) => <Frame s={s} id={id} /> },
    {
      match: (id, h) => isReward(id) && h === "counter",
      slots: p.shelf,
      layer: "back",
      draw: (s, _c, id, n) => (
        <g>
          {n === 0 && <RewardShelf s={p.shelf} />}
          <ShelfObject s={s} id={id} />
        </g>
      ),
    },
    { match: (id) => isReward(id), slots: p.floor, layer: "back", draw: (s, _c, id) => <FloorReward s={s} id={id} /> },
  ];
}

export const DEFAULT_REWARDS: RewardPlaces = {
  frames: [
    { gx: 7.15, gy: 0, wall: "R", w: 0.7, z: 52 },
    { gx: 8.0, gy: 0, wall: "R", w: 0.7, z: 52 },
    { gx: 7.15, gy: 0, wall: "R", w: 0.7, z: 74 },
    { gx: 8.0, gy: 0, wall: "R", w: 0.7, z: 74 },
    { gx: 0, gy: 4.5, wall: "L", d: 0.6, z: 82 },
    { gx: 0, gy: 0.2, wall: "L", d: 0.6, z: 82 },
  ],
  shelf: [
    { gx: 0, gy: 5.2, wall: "L", z: 72 },
    { gx: 0, gy: 5.7, wall: "L", z: 72 },
    { gx: 0, gy: 6.2, wall: "L", z: 72 },
    { gx: 0, gy: 4.7, wall: "L", z: 72 },
  ],
  floor: [
    { gx: 8.2, gy: 6.1 },
    { gx: 5.3, gy: 6.3 },
    { gx: 2.4, gy: 6.4 },
    { gx: 8.3, gy: 2.7 },
    { gx: 0.35, gy: 4.0 },
  ],
  neon: [{ gx: 0, gy: 3.6, wall: "L", d: 1.2, z: 76 }],
};

export const plantFill = (s: Slot) => <Plant gx={s.gx + 0.3} gy={s.gy + 0.3} />;
