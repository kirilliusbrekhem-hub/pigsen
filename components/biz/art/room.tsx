// Shared diorama pieces: backdrop, slab, walls with windows/door, furniture helpers.
import type { ReactNode } from "react";
import { Box, C, LOOKS, P, Person, Shadow, Tile, VIEW, WallL, WallR, WH, pts, tf, type PersonLook } from "./iso";
import type { SceneCtx, Slot } from "./types";

export function Defs() {
  return (
    <defs>
      <linearGradient id="bz-sky" x1="0" y1="0" x2="0" y2="1">
        <stop className="bz-sky-a" offset="0" />
        <stop className="bz-sky-b" offset="1" />
      </linearGradient>
      <linearGradient id="bz-bg" x1="0" y1="0" x2="0" y2="1">
        <stop className="bz-bg-a" offset="0" />
        <stop className="bz-bg-b" offset="1" />
      </linearGradient>
      <linearGradient id="bz-wallL" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.n1} />
        <stop offset="1" stopColor={C.n2} />
      </linearGradient>
      <linearGradient id="bz-wallR" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.n2} />
        <stop offset="1" stopColor={C.n3} />
      </linearGradient>
      <linearGradient id="bz-glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={C.w} stopOpacity={0.75} />
        <stop offset="0.5" stopColor={C.g2} stopOpacity={0.35} />
        <stop offset="1" stopColor={C.g3} stopOpacity={0.55} />
      </linearGradient>
      <linearGradient id="bz-metal" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={C.n4} />
        <stop offset="0.45" stopColor={C.w} />
        <stop offset="1" stopColor={C.n5} />
      </linearGradient>
      <radialGradient id="bz-glow">
        <stop offset="0" stopColor={C.g4} stopOpacity={0.9} />
        <stop offset="1" stopColor={C.g4} stopOpacity={0} />
      </radialGradient>
      <radialGradient id="bz-warm">
        <stop offset="0" stopColor={C.w} stopOpacity={0.85} />
        <stop offset="1" stopColor={C.w} stopOpacity={0} />
      </radialGradient>
    </defs>
  );
}

/** Window on a wall with sky behind (sky colors follow time of day via CSS). */
export function WindowL({ gy0, gy1, z0, z1, bars = 2 }: { gy0: number; gy1: number; z0: number; z1: number; bars?: number }) {
  return (
    <g>
      <WallL gy0={gy0 - 0.08} gy1={gy1 + 0.08} z0={z0 - 4} z1={z1 + 4} fill={C.ink2} />
      <WallL gy0={gy0} gy1={gy1} z0={z0} z1={z1} fill="url(#bz-sky)" />
      <Hills side="L" a={gy0} b={gy1} z0={z0} />
      <WallL gy0={gy0} gy1={gy1} z0={z0} z1={z1} fill="url(#bz-glass)" opacity={0.5} />
      {Array.from({ length: bars }, (_, i) => {
        const g = gy0 + ((gy1 - gy0) * (i + 1)) / (bars + 1);
        return <WallL key={i} gy0={g - 0.03} gy1={g + 0.03} z0={z0} z1={z1} fill={C.ink2} />;
      })}
      <polygon points={pts(P(0.0, gy0 - 0.1, z0 - 4), P(0, gy1 + 0.1, z0 - 4), P(0.22, gy1 + 0.1, z0 - 4), P(0.22, gy0 - 0.1, z0 - 4))} fill={C.n4} />
    </g>
  );
}
export function WindowR({ gx0, gx1, z0, z1, bars = 2, city }: { gx0: number; gx1: number; z0: number; z1: number; bars?: number; city?: boolean }) {
  return (
    <g>
      <WallR gx0={gx0 - 0.08} gx1={gx1 + 0.08} z0={z0 - 4} z1={z1 + 4} fill={C.ink2} />
      <WallR gx0={gx0} gx1={gx1} z0={z0} z1={z1} fill="url(#bz-sky)" />
      {city ? <City a={gx0} b={gx1} z0={z0} z1={z1} /> : <Hills side="R" a={gx0} b={gx1} z0={z0} />}
      <WallR gx0={gx0} gx1={gx1} z0={z0} z1={z1} fill="url(#bz-glass)" opacity={0.45} />
      {Array.from({ length: bars }, (_, i) => {
        const g = gx0 + ((gx1 - gx0) * (i + 1)) / (bars + 1);
        return <WallR key={i} gx0={g - 0.03} gx1={g + 0.03} z0={z0} z1={z1} fill={C.ink2} />;
      })}
      <polygon points={pts(P(gx0 - 0.1, 0, z0 - 4), P(gx1 + 0.1, 0, z0 - 4), P(gx1 + 0.1, 0.22, z0 - 4), P(gx0 - 0.1, 0.22, z0 - 4))} fill={C.n4} />
    </g>
  );
}
function Hills({ side, a, b, z0 }: { side: "L" | "R"; a: number; b: number; z0: number }) {
  const q = (t: number, z: number) => (side === "L" ? P(0, a + (b - a) * t, z) : P(a + (b - a) * t, 0, z));
  const top = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t, i) => q(t, z0 + 10 + (i % 2 ? 7 : 2)));
  return <polygon className="bz-hill" points={pts(q(0, z0), ...top, q(1, z0))} />;
}
function City({ a, b, z0, z1 }: { a: number; b: number; z0: number; z1: number }) {
  const n = Math.max(4, Math.round((b - a) * 2.4));
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const g0 = a + ((b - a) * i) / n + 0.04;
    const g1 = a + ((b - a) * (i + 1)) / n - 0.04;
    const h = Math.min(z1 - z0 - 8, 8 + ((i * 37) % 5) * 5);
    out.push(<WallR key={i} gx0={g0} gx1={g1} z0={z0} z1={z0 + h} fill={i % 2 ? C.g4 : C.g3} opacity={0.75} className="bz-tower" />);
    out.push(<WallR key={`w${i}`} gx0={g0 + 0.08} gx1={g0 + 0.16} z0={z0 + h - 6} z1={z0 + h - 3} fill={C.g2} className="bz-litwin" />);
  }
  return <g>{out}</g>;
}

/** Door in the left wall (gy 5..6.4). Visitors fade in/out here. */
export function DoorL({ label }: { label?: string }) {
  return (
    <g>
      <WallL gy0={4.88} gy1={6.52} z0={0} z1={68} fill={C.ink} />
      <WallL gy0={5} gy1={6.4} z0={0} z1={62} fill="url(#bz-sky)" />
      <WallL gy0={5} gy1={6.4} z0={0} z1={62} fill={C.g9} opacity={0.35} />
      <polygon points={pts(P(0, 5, 0), P(0, 6.4, 0), P(0.9, 6.4, 0), P(0.9, 5, 0))} fill={C.w} opacity={0.22} />
      <WallL gy0={5.67} gy1={5.73} z0={0} z1={62} fill={C.ink} opacity={0.6} />
      {label && (
        <g transform={tf(0, 5.7, 72)}>
          <rect x={-14} y={-6} width={28} height={11} rx={5.5} fill={C.g7} transform="skewY(-26.57)" />
        </g>
      )}
      {/* doormat */}
      <Tile gx={0.1} gy={5.1} w={0.9} d={1.2} fill={C.g8} />
      <Tile gx={0.2} gy={5.2} w={0.7} d={1.0} fill={C.g7} />
    </g>
  );
}

/** Backdrop + floating slab with sidewalk/terrace zone + room floor and the two walls. */
export function Room({ ctx, floor = [C.n2, C.n1], wallTone, wainscot, children }: { ctx: SceneCtx; floor?: [string, string]; wallTone?: [string, string]; wainscot?: string | null; children?: ReactNode }) {
  const tiles: ReactNode[] = [];
  for (let x = 0; x < 9; x++) for (let y = 0; y < 7; y++) tiles.push(<Tile key={`${x}.${y}`} gx={x} gy={y} fill={(x + y) % 2 ? floor[0] : floor[1]} />);
  const pave: ReactNode[] = [];
  for (let x = 0; x < 11; x++) pave.push(<Tile key={`p${x}`} gx={x + 0.04} gy={7.25} w={0.92} d={1.5} fill={x % 2 ? C.n3 : C.n2} />);
  return (
    <g className="bz-room">
      <rect className="bz-backdrop" x={0} y={0} width={VIEW.w} height={VIEW.h} rx={18} fill="url(#bz-bg)" />
      <g className="bz-clouds">
        <path className="bz-cloud c1" d="M40 60 q8 -14 22 -8 q8 -10 20 -2 q14 -2 14 10 Z" />
        <path className="bz-cloud c2" d="M300 30 q6 -10 16 -6 q6 -8 15 -1 q10 -1 10 7 Z" />
      </g>
      <g className="bz-stars">
        {[[30, 40], [80, 22], [330, 60], [372, 26], [52, 120], [355, 110]].map(([x, y]) => (
          <circle key={`${x}`} cx={x} cy={y} r={1.1} />
        ))}
      </g>
      {/* slab */}
      <Box gx={0} gy={0} w={11.4} d={9} h={12} z={-12} top={C.g3} left={C.g8} right={C.g9} />
      <polygon points={pts(P(0, 9, -12), P(11.4, 9, -12), P(11.4, 9, -15), P(0, 9, -15))} fill={C.ink} opacity={0.25} />
      <Tile gx={0} gy={7} w={11.4} d={2} fill={C.g3} />
      {pave}
      <Tile gx={9} gy={0} w={2.4} d={7} fill={C.g2} />
      <Tile gx={0} gy={8.75} w={11.4} d={0.25} fill={C.g4} />
      {/* floor */}
      <g className="bz-floor">{tiles}</g>
      <polygon points={pts(P(0, 7, 0), P(9, 7, 0), P(9, 7, -3), P(0, 7, -3))} fill={C.n5} />
      <polygon points={pts(P(9, 0, 0), P(9, 7, 0), P(9, 7, -3), P(9, 0, -3))} fill={C.n6} />
      {/* walls */}
      <WallL gy0={0} gy1={7} z0={0} z1={WH} fill={wallTone?.[0] ?? "url(#bz-wallL)"} />
      <WallR gx0={0} gx1={9} z0={0} z1={WH} fill={wallTone?.[1] ?? "url(#bz-wallR)"} />
      {wainscot && (
        <g>
          <WallL gy0={0} gy1={7} z0={0} z1={30} fill={wainscot} />
          <WallR gx0={0} gx1={9} z0={0} z1={30} fill={wainscot} opacity={0.88} />
          <WallL gy0={0} gy1={7} z0={29} z1={32} fill={C.ink} opacity={0.35} />
          <WallR gx0={0} gx1={9} z0={29} z1={32} fill={C.ink} opacity={0.3} />
        </g>
      )}
      <WallL gy0={0} gy1={7} z0={0} z1={4} fill={C.ink3} />
      <WallR gx0={0} gx1={9} z0={0} z1={4} fill={C.ink2} />
      {/* wall caps */}
      <polygon points={pts(P(0, 7, WH), P(0, 0, WH), P(9, 0, WH), P(9, -0.3, WH), P(-0.3, -0.3, WH), P(-0.3, 7, WH))} fill={C.ink} />
      <polygon points={pts(P(-0.3, 7, WH), P(0, 7, WH), P(0, 7, 0), P(-0.3, 7, 0))} fill={C.ink2} />
      <polygon points={pts(P(9, -0.3, WH), P(9, 0, WH), P(9, 0, 0), P(9, -0.3, 0))} fill={C.ink3} />
      {children}
      {ctx.tod !== "day" && <rect className="bz-dusk-hint" x={0} y={0} width={1} height={1} opacity={0} />}
    </g>
  );
}

// ── furniture helpers ──
export function Plant({ gx, gy, big }: { gx: number; gy: number; big?: boolean }) {
  const [x, y] = P(gx, gy);
  const s = big ? 1.3 : 1;
  return (
    <g>
      <ellipse cx={x} cy={y} rx={9 * s} ry={4 * s} fill={C.ink} opacity={0.18} />
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M-6 0 l-1.4 -11 h14.8 l-1.4 11 Z" fill={C.ink2} />
        <path d="M-7.4 -11 h14.8 v-2.2 h-14.8 Z" fill={C.ink3} />
        <g className="bz-sway">
          <path d="M0 -12 q-14 -6 -10 -22 q8 6 10 22" fill={C.g6} />
          <path d="M0 -12 q14 -8 9 -24 q-9 8 -9 24" fill={C.g7} />
          <path d="M0 -12 q-3 -16 3 -30 q4 14 -3 30" fill={C.g5} />
          <path d="M0 -12 q-9 -2 -12 -12 q8 0 12 12" fill={C.g8} />
        </g>
      </g>
    </g>
  );
}

export function Chair({ gx, gy, tone = C.ink2 }: { gx: number; gy: number; tone?: string }) {
  return (
    <g>
      <Shadow gx={gx + 0.25} gy={gy + 0.25} rx={8} ry={3.5} />
      {[[0, 0], [0.42, 0], [0, 0.42], [0.42, 0.42]].map(([a, b]) => (
        <Box key={`${a}${b}`} gx={gx + 0.04 + a} gy={gy + 0.04 + b} w={0.06} d={0.06} h={10} top={tone} left={tone} right={C.ink} />
      ))}
      <Box gx={gx} gy={gy} w={0.52} d={0.52} h={2.4} z={10} top={C.g5} left={C.g7} right={C.g8} />
      <Box gx={gx} gy={gy} w={0.08} d={0.52} h={12} z={12} top={tone} left={tone} right={C.ink} />
    </g>
  );
}

export function RoundTable({ gx, gy, top = C.w }: { gx: number; gy: number; top?: string }) {
  const [x, y] = P(gx, gy);
  return (
    <g>
      <ellipse cx={x} cy={y} rx={14} ry={6} fill={C.ink} opacity={0.18} />
      <rect x={x - 1.6} y={y - 18} width={3.2} height={18} fill={C.ink2} />
      <ellipse cx={x} cy={y} rx={7} ry={3} fill={C.ink2} />
      <ellipse cx={x} cy={y - 18} rx={15} ry={7.5} fill={C.n4} />
      <ellipse cx={x} cy={y - 19.6} rx={15} ry={7.5} fill={top} />
      <ellipse cx={x - 4} cy={y - 21} rx={6} ry={2} fill={C.w} opacity={0.6} />
    </g>
  );
}

export function Lamp({ gx, gy, z, on }: { gx: number; gy: number; z: number; on?: boolean }) {
  const [x, y] = P(gx, gy, z);
  return (
    <g className="bz-lamp">
      <line x1={x} y1={y - 60} x2={x} y2={y - 8} stroke={C.ink} strokeWidth={0.8} />
      {on !== false && <circle className="bz-lamp-glow" cx={x} cy={y + 6} r={22} fill="url(#bz-warm)" />}
      <path d={`M${x - 7} ${y} q0 -9 7 -9 q7 0 7 9 Z`} fill={C.g8} />
      <ellipse cx={x} cy={y} rx={7} ry={2} fill={C.g3} />
    </g>
  );
}

/** A staff member standing at a grid point; className adds an idle/route animation. */
export function Staff({ gx, gy, look, apron, className, hat, children }: { gx: number; gy: number; look: PersonLook; apron?: string; className?: string; hat?: string; children?: ReactNode }) {
  return (
    <g transform={tf(gx, gy)}>
      <g className={className}>
        <Person look={look} apron={apron} hat={hat}>
          {children}
        </Person>
      </g>
    </g>
  );
}

/** Seated worker at a desk, typing (back to the viewer). */
export function Worker({ gx, gy, look = LOOKS[0] }: { gx: number; gy: number; look?: PersonLook }) {
  const [x, y] = P(gx, gy);
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={0} rx={8} ry={3} fill={C.ink} opacity={0.18} />
      <rect x={-1} y={-8} width={2} height={8} fill={C.ink} />
      <ellipse cx={0} cy={-8} rx={7} ry={3} fill={C.ink2} />
      <g className="bz-type">
        <path d="M-6 -10 v-9 a6 6 0 0 1 12 0 v9 Z" fill={look.body} />
        <circle cx={0} cy={-26} r={5.2} fill={C.skin} />
        <path d="M-5.2 -26 a5.2 5.2 0 0 1 10.4 0 v2 q-5 -3 -10.4 0 Z" fill={look.hair} />
        <rect className="bz-arm l" x={-8} y={-19} width={2.6} height={8} rx={1.3} fill={look.body} transform="rotate(-30 -7 -19)" />
        <rect className="bz-arm r" x={5.4} y={-19} width={2.6} height={8} rx={1.3} fill={look.body} transform="rotate(30 7 -19)" />
      </g>
    </g>
  );
}

/** Desk with monitor along the back-right wall; worker sits on the near side. */
export function Desk({ gx, gy, monitors = 1, laptop }: { gx: number; gy: number; monitors?: number; laptop?: boolean }) {
  const mx = (i: number) => gx + 0.35 + i * 0.55;
  return (
    <g>
      <Shadow gx={gx + 0.65} gy={gy + 0.4} rx={22} ry={8} o={0.14} />
      <Box gx={gx} gy={gy} w={0.06} d={0.75} h={20} top={C.ink2} left={C.ink2} right={C.ink} />
      <Box gx={gx + 1.24} gy={gy} w={0.06} d={0.75} h={20} top={C.ink2} left={C.ink2} right={C.ink} />
      <Box gx={gx} gy={gy} w={1.3} d={0.75} h={2.5} z={20} top={C.n1} left={C.n4} right={C.n5} />
      {laptop ? (
        <g>
          <polygon points={pts(P(gx + 0.4, gy + 0.3, 22.5), P(gx + 0.9, gy + 0.3, 22.5), P(gx + 0.9, gy + 0.55, 22.5), P(gx + 0.4, gy + 0.55, 22.5))} fill={C.n5} />
          <polygon points={pts(P(gx + 0.4, gy + 0.3, 22.5), P(gx + 0.9, gy + 0.3, 22.5), P(gx + 0.9, gy + 0.3, 33), P(gx + 0.4, gy + 0.3, 33))} fill={C.ink} />
          <polygon className="bz-screen" points={pts(P(gx + 0.44, gy + 0.31, 24), P(gx + 0.86, gy + 0.31, 24), P(gx + 0.86, gy + 0.31, 32), P(gx + 0.44, gy + 0.31, 32))} />
        </g>
      ) : (
        Array.from({ length: monitors }, (_, i) => (
          <g key={i}>
            <Box gx={mx(i)} gy={gy + 0.15} w={0.08} d={0.08} h={6} z={22.5} top={C.ink} left={C.ink2} right={C.ink} />
            <polygon points={pts(P(mx(i) - 0.22, gy + 0.18, 28), P(mx(i) + 0.3, gy + 0.18, 28), P(mx(i) + 0.3, gy + 0.18, 41), P(mx(i) - 0.22, gy + 0.18, 41))} fill={C.ink} />
            <polygon className="bz-screen" points={pts(P(mx(i) - 0.18, gy + 0.19, 29.5), P(mx(i) + 0.26, gy + 0.19, 29.5), P(mx(i) + 0.26, gy + 0.19, 39.5), P(mx(i) - 0.18, gy + 0.19, 39.5))} />
          </g>
        ))
      )}
      <polygon points={pts(P(gx + 0.35, gy + 0.5, 22.6), P(gx + 0.95, gy + 0.5, 22.6), P(gx + 0.95, gy + 0.66, 22.6), P(gx + 0.35, gy + 0.66, 22.6))} fill={C.ink3} />
    </g>
  );
}

export const DEFAULT_EXTRA: Slot[] = [
  { gx: 9.5, gy: 5.4 },
  { gx: 10.4, gy: 4.3 },
  { gx: 9.5, gy: 0.9 },
  { gx: 10.4, gy: 2.3 },
  { gx: 4.3, gy: 6.4 },
  { gx: 9.5, gy: 3.1 },
  { gx: 10.4, gy: 6.0 },
  { gx: 8.4, gy: 4.4 },
  { gx: 1.3, gy: 7.5 },
  { gx: 7.0, gy: 7.6 },
]

