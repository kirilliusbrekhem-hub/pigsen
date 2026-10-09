// Кофейня (and пекарня, which reuses the café room with ovens and bread). Fully drawn.
import { Box, C, LOOKS, P, Shadow, Tile, WallR, WallText, pts, tf, type Pt } from "./iso";
import { Chair, DEFAULT_EXTRA, DoorL, Lamp, Plant, RoundTable, Room, Staff, WindowL } from "./room";
import { DEFAULT_REWARDS, OnWall, rewardSprites } from "./generic";
import type { Art, SceneCtx, Slot, SpriteDef } from "./types";

const TABLES: Pt[] = [
  [6.9, 4.1],
  [6.9, 6.0],
];
const CHAIRS = (t: Pt): Pt[] => [
  [t[0] - 0.95, t[1] - 0.15],
  [t[0] - 0.15, t[1] - 0.95],
];
const TERRACE_TABLE: Pt = [10.3, 3.7];

function CafeBackground({ ctx, bakery }: { ctx: SceneCtx; bakery?: boolean }) {
  const reno = [...ctx.has].some((i) => /renovation/.test(i));
  return (
    <Room ctx={ctx} wainscot={reno ? C.g7 : null} floor={reno ? [C.n3, C.n1] : [C.n2, C.n1]}>
      <WindowL gy0={0.9} gy1={3.2} z0={30} z1={70} />
      <DoorL />
      {/* shelves with cups/jars on the back wall */}
      <WallR gx0={1.1} gx1={2.9} z0={50} z1={52} fill={C.ink2} />
      {[1.3, 1.65, 2.0, 2.35, 2.7].map((g, i) => {
        const [x, y] = P(g, 0, 52);
        return bakery ? (
          <ellipse key={g} cx={x} cy={y - 3} rx={5} ry={3} fill={i % 2 ? C.n4 : C.n5} />
        ) : (
          <path key={g} d={`M${x - 3} ${y} v-6 h6 v6 Z`} fill={i % 2 ? C.w : C.g3} />
        );
      })}
    </Room>
  );
}

function CafeFixtures({ ctx, bakery }: { ctx: SceneCtx; bakery?: boolean }) {
  return (
    <g>
      {/* back counter */}
      <Box gx={0.9} gy={0} w={5.1} d={0.6} h={22} top={C.n1} left={C.ink2} right={C.ink} />
      <polygon points={pts(P(0.9, 0.6, 18), P(6, 0.6, 18), P(6, 0.6, 16), P(0.9, 0.6, 16))} fill={C.g6} />
      {/* owner behind the counter */}
      <Staff gx={4.1} gy={1.15} look={LOOKS[2]} apron={C.g7} className="bz-idle" hat={bakery ? C.w : undefined} />
      {/* front counter */}
      <Shadow gx={3.3} gy={2.3} rx={60} ry={14} o={0.12} />
      <Box gx={1} gy={1.7} w={4.6} d={0.7} h={24} top={C.n1} left={C.ink2} right={C.ink} />
      <polygon points={pts(P(1, 2.4, 22), P(5.6, 2.4, 22), P(5.6, 2.4, 20), P(1, 2.4, 20))} fill={C.g5} />
      {[1.6, 2.6, 3.6, 4.6].map((g) => (
        <polygon key={g} points={pts(P(g, 2.4, 16), P(g + 0.6, 2.4, 16), P(g + 0.6, 2.4, 5), P(g, 2.4, 5))} fill={C.ink3} />
      ))}
      {/* register */}
      <Box gx={3.6} gy={1.85} w={0.45} d={0.35} h={6} z={24} top={C.ink3} left={C.ink2} right={C.ink} />
      <polygon points={pts(P(3.62, 1.85, 30), P(4.03, 1.85, 30), P(4.03, 1.85, 36), P(3.62, 1.85, 36))} fill={C.g4} />
      {ctx.level >= 2 && <Lamp gx={3.2} gy={2.0} z={66} />}
    </g>
  );
}

function Machine({ s, gold }: { s: Slot; gold?: boolean }) {
  const z = s.z ?? 22;
  const [x, y] = P(s.gx + 0.45, s.gy + 0.5, z + 8);
  return (
    <g>
      <Box gx={s.gx} gy={s.gy} w={0.95} d={0.5} h={20} z={z} top={C.n4} left="url(#bz-metal)" right={C.n5} />
      <Box gx={s.gx + 0.05} gy={s.gy} w={0.85} d={0.45} h={4} z={z + 20} top={gold ? C.g5 : C.ink3} left={C.ink2} right={C.ink} />
      <polygon points={pts(P(s.gx + 0.15, s.gy + 0.5, z + 17), P(s.gx + 0.8, s.gy + 0.5, z + 17), P(s.gx + 0.8, s.gy + 0.5, z + 12), P(s.gx + 0.15, s.gy + 0.5, z + 12))} fill={C.ink} />
      <circle cx={x - 6} cy={y + 2} r={1.6} fill={C.g5} className="bz-blink" />
      <rect x={x - 2} y={y + 2} width={4} height={4} fill={C.w} />
      <g className="bz-steamset">
        <path className="bz-steam" d={`M${x - 2} ${y - 18} q-4 -6 0 -12`} />
        <path className="bz-steam s2" d={`M${x + 3} ${y - 18} q4 -6 0 -12`} />
      </g>
    </g>
  );
}

const coffeeSprites: SpriteDef[] = [
  { match: ["machine"], slots: [{ gx: 1.6, gy: 0.05, z: 22 }], layer: "back", draw: (s) => <Machine s={s} /> },
  {
    match: ["grinder", "mixer"],
    slots: [{ gx: 2.9, gy: 0.1, z: 22 }],
    layer: "back",
    draw: (s) => {
      const [x, y] = P(s.gx + 0.25, s.gy + 0.25, 22);
      return (
        <g>
          <Box gx={s.gx} gy={s.gy} w={0.45} d={0.4} h={14} z={22} top={C.ink3} left={C.ink2} right={C.ink} />
          <path d={`M${x - 6} ${y - 14} l-3 -12 h18 l-3 12 Z`} fill={C.g3} opacity={0.85} />
          <path d={`M${x - 5} ${y - 16} l-1.6 -6 h13 l-1.6 6 Z`} fill={C.ink3} />
        </g>
      );
    },
  },
  {
    match: ["latte"],
    slots: [{ gx: 4.6, gy: 1.85, z: 24 }],
    layer: "back",
    draw: (s) => {
      const [x, y] = P(s.gx + 0.3, s.gy + 0.25, 24);
      return (
        <g>
          <ellipse cx={x} cy={y} rx={9} ry={3.5} fill={C.ink} opacity={0.15} />
          <path d={`M${x - 6} ${y - 8} h10 v4 a5 5 0 0 1 -10 0 Z`} fill={C.w} />
          <ellipse cx={x - 1} cy={y - 8} rx={5} ry={1.8} fill={C.g8} />
          <path d={`M${x - 1} ${y - 7.2} l-1.8 -1.6 a1 1 0 0 1 1.8 -1 a1 1 0 0 1 1.8 1 Z`} fill={C.w} />
          <path d={`M${x + 6} ${y - 2} v-9 l3 -2 v11 Z`} fill="url(#bz-metal)" />
        </g>
      );
    },
  },
  {
    match: ["showcase", "bakery-showcase"],
    slots: [{ gx: 1.15, gy: 1.75, z: 24, w: 1.3, d: 0.6 }],
    layer: "back",
    draw: (s) => {
      const z = 24;
      return (
        <g>
          <Box gx={s.gx} gy={s.gy} w={1.3} d={0.6} h={2} z={z} top={C.ink3} left={C.ink2} right={C.ink} />
          {[0.15, 0.5, 0.85].map((o, i) => {
            const [x, y] = P(s.gx + o + 0.15, s.gy + 0.3, z + 4);
            return (
              <g key={o}>
                <path d={`M${x - 5} ${y} q0 -6 5 -6 q5 0 5 6 Z`} fill={i === 1 ? C.g6 : C.n1} />
                <path d={`M${x - 5} ${y - 3} h10`} stroke={i === 1 ? C.g3 : C.n4} strokeWidth={1.2} />
              </g>
            );
          })}
          <Box gx={s.gx} gy={s.gy} w={1.3} d={0.6} h={14} z={z + 2} top="url(#bz-glass)" left="url(#bz-glass)" right="url(#bz-glass)" stroke={C.ink3} />
        </g>
      );
    },
  },
  {
    match: ["menu"],
    slots: [{ gx: 3.1, gy: 0, wall: "R", w: 2.2 }],
    layer: "back",
    draw: (s) => (
      <g>
        <WallR gx0={s.gx} gx1={s.gx + 2.2} z0={44} z1={74} fill={C.ink} />
        <WallR gx0={s.gx + 0.1} gx1={s.gx + 2.1} z0={46} z1={72} fill={C.ink3} />
        <WallText at={P(s.gx + 1.1, 0, 64)} side="R" size={6.5} fill={C.g4} spacing={1.2}>
          МЕНЮ
        </WallText>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <WallR gx0={s.gx + 0.3} gx1={s.gx + 1.3} z0={56 - i * 4} z1={57 - i * 4} fill={C.n3} />
            <WallR gx0={s.gx + 1.6} gx1={s.gx + 1.9} z0={56 - i * 4} z1={57 - i * 4} fill={C.g5} />
          </g>
        ))}
      </g>
    ),
  },
  {
    match: ["sign", "bakery-sign"],
    slots: [{ gx: 1.0, gy: 0, wall: "R", w: 5 }],
    layer: "back",
    draw: (s, ctx) => (
      <g>
        <WallR gx0={s.gx} gx1={s.gx + 5} z0={76} z1={92} fill={C.ink} />
        <WallR gx0={s.gx + 0.08} gx1={s.gx + 4.92} z0={77.5} z1={90.5} fill={C.g8} />
        <WallText at={P(s.gx + 2.5, 0, 81)} side="R" size={8.5} spacing={1.5} fill={C.w}>
          {ctx.name.length > 18 ? `${ctx.name.slice(0, 17)}…` : ctx.name.toUpperCase()}
        </WallText>
      </g>
    ),
  },
  {
    match: ["neon", "bakery-neon"],
    slots: [{ gx: 0, gy: 3.6, wall: "L", d: 1.2 }],
    layer: "back",
    draw: (_s, _c, id) => (
      <g className="bz-neon-on">
        <WallText at={P(0, 4.15, 76)} side="L" size={12} weight={800} className="bz-neon-text" spacing={1.5}>
          {id === "bakery-neon" ? "ХЛЕБ" : "OPEN"}
        </WallText>
        <g transform={tf(0, 3.9, 60)}>
          <path className="bz-neon-line" d="M-6 0 h10 v4 a5 5 0 0 1 -10 0 Z M4 1 q4 0 4 3 q0 3 -4 3" transform="skewY(-26.57)" />
        </g>
      </g>
    ),
  },
  {
    match: ["vinyl"],
    slots: [{ gx: 7.9, gy: 0.25 }],
    layer: "back",
    draw: (s) => {
      const [x, y] = P(s.gx + 0.4, s.gy + 0.3, 20);
      return (
        <g>
          <Shadow gx={s.gx + 0.4} gy={s.gy + 0.35} rx={16} ry={6} />
          <Box gx={s.gx} gy={s.gy} w={0.85} d={0.65} h={18} top={C.ink3} left={C.ink2} right={C.ink} />
          <polygon points={pts(P(s.gx + 0.1, s.gy + 0.65, 14), P(s.gx + 0.75, s.gy + 0.65, 14), P(s.gx + 0.75, s.gy + 0.65, 4), P(s.gx + 0.1, s.gy + 0.65, 4))} fill={C.g8} />
          <Box gx={s.gx + 0.04} gy={s.gy + 0.04} w={0.77} d={0.57} h={2} z={18} top={C.n4} left={C.n5} right={C.n6} />
          <ellipse cx={x} cy={y - 1} rx={9} ry={4.5} fill={C.ink} />
          <ellipse className="bz-disc" cx={x} cy={y - 1} rx={6} ry={3} fill="none" stroke={C.ink3} strokeWidth={1} strokeDasharray="6 4" />
          <ellipse cx={x} cy={y - 1} rx={2} ry={1} fill={C.g5} />
          <g className="bz-notes">
            <path d={`M${x + 4} ${y - 14} v-6 l4 -1 v6`} stroke={C.g7} strokeWidth={1.2} fill="none" />
            <circle cx={x + 3} cy={y - 14} r={1.4} fill={C.g7} />
          </g>
        </g>
      );
    },
  },
  {
    match: ["renovation", "bakery-renovation"],
    slots: [{ gx: 8.3, gy: 1.4 }],
    layer: "back",
    draw: (s) => (
      <g>
        <Plant gx={s.gx + 0.3} gy={s.gy + 0.3} big />
        <Plant gx={0.45} gy={4.3} />
        <Lamp gx={2.0} gy={2.05} z={64} />
        <Lamp gx={4.6} gy={2.05} z={64} />
      </g>
    ),
  },
  {
    match: ["chairs"],
    slots: [{ gx: 5.9, gy: 3.9, w: 1, d: 1 }],
    layer: "back",
    draw: (_s, ctx) => (
      <g>
        {(ctx.has.has("tables") ? TABLES.flatMap(CHAIRS) : ([[6.2, 3.9], [6.2, 5.0], [6.2, 6.0]] as Pt[])).map((c) => (
          <Chair key={c.join()} gx={c[0] - 0.26} gy={c[1] - 0.26} />
        ))}
      </g>
    ),
  },
  {
    match: ["tables", "bakery-tables"],
    slots: [{ gx: 6.5, gy: 3.7, w: 1, d: 1 }],
    layer: "front",
    draw: (_s, _c, id) => (
      <g>
        {id === "bakery-tables" && TABLES.flatMap(CHAIRS).map((c) => <Chair key={c.join()} gx={c[0] - 0.26} gy={c[1] - 0.26} />)}
        {TABLES.map((t) => (
          <g key={t.join()}>
            <RoundTable gx={t[0]} gy={t[1]} />
            <g transform={tf(t[0], t[1], 20)}>
              <path d="M-3 -1 h6 v2 a3 3 0 0 1 -6 0 Z" fill={C.w} stroke={C.n5} strokeWidth={0.5} />
            </g>
          </g>
        ))}
      </g>
    ),
    seats: () => TABLES.flatMap(CHAIRS),
  },
  {
    match: ["terrace"],
    slots: [{ gx: 9.4, gy: 2.4, w: 1.8, d: 3 }],
    layer: "front",
    draw: () => {
      const [x, y] = P(TERRACE_TABLE[0], TERRACE_TABLE[1]);
      return (
        <g>
          <Tile gx={9.25} gy={1.6} w={2} d={4.6} fill={C.n3} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Tile key={i} gx={9.25} gy={1.6 + i * 0.575} w={2} d={0.06} fill={C.n4} />
          ))}
          <Chair gx={TERRACE_TABLE[0] - 1.0} gy={TERRACE_TABLE[1] - 0.4} />
          <Chair gx={TERRACE_TABLE[0] - 0.4} gy={TERRACE_TABLE[1] - 1.0} />
          <RoundTable gx={TERRACE_TABLE[0]} gy={TERRACE_TABLE[1]} />
          <rect x={x - 1} y={y - 70} width={2} height={52} fill={C.ink2} />
          <path className="bz-umb" d={`M${x - 34} ${y - 58} q34 -30 68 0 q-8 -4 -17 0 q-8 -4 -17 0 q-9 -4 -17 0 q-9 -4 -17 0 Z`} fill={C.g6} />
          <path d={`M${x - 17} ${y - 58} q17 -26 17 -28 q0 2 17 28 q-8 -4 -17 0 q-9 -4 -17 0 Z`} fill={C.w} opacity={0.85} />
          <Box gx={9.3} gy={6.1} w={1.9} d={0.25} h={8} top={C.g6} left={C.ink2} right={C.ink} />
          {[9.5, 9.9, 10.3, 10.7].map((g) => {
            const [fx, fy] = P(g, 6.2, 8);
            return <circle key={g} cx={fx} cy={fy - 2} r={2.6} fill={g === 9.9 ? C.w : C.g5} />;
          })}
        </g>
      );
    },
    seats: () => [
      [TERRACE_TABLE[0] - 0.75, TERRACE_TABLE[1] - 0.15],
      [TERRACE_TABLE[0] - 0.15, TERRACE_TABLE[1] - 0.75],
    ],
  },
  {
    match: ["hall2"],
    slots: [{ gx: 5.9, gy: 0, wall: "R", w: 1.6 }],
    layer: "back",
    draw: (s) => (
      <g>
        <WallR gx0={s.gx - 0.1} gx1={s.gx + 1.7} z0={0} z1={68} fill={C.ink} />
        <WallR gx0={s.gx} gx1={s.gx + 1.6} z0={0} z1={64} fill={C.g9} />
        <WallR gx0={s.gx} gx1={s.gx + 1.6} z0={0} z1={64} fill="url(#bz-warm)" opacity={0.35} />
        {[0.35, 1.1].map((o) => {
          const [x, y] = P(s.gx + o, 0, 0);
          return (
            <g key={o}>
              <ellipse cx={x + 3} cy={y - 18} rx={7} ry={3} fill={C.g6} />
              <rect x={x + 2} y={y - 18} width={2} height={14} fill={C.g7} />
            </g>
          );
        })}
        <WallText at={P(s.gx + 0.8, 0, 72)} side="R" size={6} fill={C.g8} spacing={1}>
          ЗАЛ 2
        </WallText>
      </g>
    ),
  },
  {
    match: ["delivery", "bakery-delivery"],
    slots: [{ gx: 3.2, gy: 7.6 }],
    layer: "front",
    draw: (s) => {
      const [x, y] = P(s.gx + 0.5, s.gy + 0.5);
      return (
        <g className="bz-scooter">
          <ellipse cx={x} cy={y} rx={22} ry={6} fill={C.ink} opacity={0.18} />
          <g transform={`translate(${x} ${y})`}>
            <circle cx={-14} cy={-6} r={6} fill={C.ink} />
            <circle cx={-14} cy={-6} r={2.4} fill={C.n4} />
            <circle cx={14} cy={-6} r={6} fill={C.ink} />
            <circle cx={14} cy={-6} r={2.4} fill={C.n4} />
            <path d="M-16 -10 q4 -10 16 -10 h8 l6 -12 h4 l-6 16 q-4 6 -12 6 Z" fill={C.g6} />
            <rect x={-20} y={-30} width={16} height={14} rx={2} fill={C.g8} />
            <path d="M-17 -24 h10" stroke={C.g3} strokeWidth={1.6} />
            <path d="M18 -32 h6" stroke={C.ink} strokeWidth={2.4} strokeLinecap="round" />
          </g>
        </g>
      );
    },
  },
  {
    match: ["barista", "baker"],
    slots: [{ gx: 2.2, gy: 1.1 }],
    layer: "back",
    draw: (s, _c, id) => <Staff gx={s.gx} gy={s.gy} look={LOOKS[0]} apron={C.ink} hat={id === "baker" ? C.w : undefined} className="bz-route" />,
  },
];

function StoneOven({ s }: { s: Slot }) {
  const [x, y] = P(s.gx + 0.6, s.gy + 0.55, 22);
  return (
    <g>
      <Box gx={s.gx} gy={s.gy} w={1.2} d={0.55} h={30} z={22} top={C.ink3} left={C.ink2} right={C.ink} />
      <OnWall side="R" at={[x, y]}>
        <path className="bz-oven" d="M-9 -2 v-10 a9 7 0 0 1 18 0 v10 Z" />
        <path d="M-9 -2 h18" stroke={C.ink} strokeWidth={1.4} />
      </OnWall>
      <path className="bz-steam" d={`M${x + 4} ${y - 34} q-4 -6 0 -12`} />
    </g>
  );
}
function BreadShelf({ s }: { s: Slot }) {
  return (
    <g>
      <Shadow gx={s.gx + 0.5} gy={s.gy + 0.3} rx={18} ry={6} />
      <Box gx={s.gx} gy={s.gy} w={1} d={0.5} h={50} top={C.ink3} left={C.ink2} right={C.ink} />
      {[10, 24, 38].map((z) => (
        <g key={z}>
          <polygon points={pts(P(s.gx + 0.05, s.gy + 0.5, z), P(s.gx + 0.95, s.gy + 0.5, z), P(s.gx + 0.95, s.gy + 0.5, z + 11), P(s.gx + 0.05, s.gy + 0.5, z + 11))} fill={C.n3} />
          {[0.25, 0.55, 0.8].map((o) => {
            const [x, y] = P(s.gx + o, s.gy + 0.5, z + 2);
            return <ellipse key={o} cx={x} cy={y - 2} rx={4.5} ry={2.6} fill={C.n5} stroke={C.n6} strokeWidth={0.5} />;
          })}
        </g>
      ))}
    </g>
  );
}
function Pastry({ s, cake }: { s: Slot; cake?: boolean }) {
  const [x, y] = P(s.gx + 0.25, s.gy + 0.25, 24);
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={0} rx={9} ry={3.6} fill={C.w} stroke={C.n4} strokeWidth={0.6} />
      {cake ? (
        <g>
          <path d="M-6 -1 v-8 a6 2.4 0 0 1 12 0 v8 a6 2.4 0 0 1 -12 0 Z" fill={C.n1} />
          <ellipse cx={0} cy={-9} rx={6} ry={2.4} fill={C.g5} />
          <circle cx={0} cy={-11} r={1.4} fill={C.g8} />
        </g>
      ) : (
        [-4, 3].map((o) => <path key={o} d={`M${o - 4} -1 q4 -7 8 0 q-4 2 -8 0 Z`} fill={C.n5} stroke={C.n6} strokeWidth={0.5} />)
      )}
    </g>
  );
}

const bakerySprites: SpriteDef[] = [
  { match: ["oven"], slots: [{ gx: 1.6, gy: 0.05, z: 22 }], layer: "back", draw: (s) => <Machine s={s} gold /> },
  { match: ["coffee-corner"], slots: [{ gx: 3.5, gy: 0.05, z: 22 }], layer: "back", draw: (s) => <Machine s={s} /> },
  { match: ["stone-oven"], slots: [{ gx: 4.6, gy: 0.02, z: 22 }], layer: "back", draw: (s) => <StoneOven s={s} /> },
  { match: ["shelves"], slots: [{ gx: 7.8, gy: 0.2 }], layer: "back", draw: (s) => <BreadShelf s={s} /> },
  { match: ["croissants"], slots: [{ gx: 4.55, gy: 1.85, z: 24 }], layer: "back", draw: (s) => <Pastry s={s} /> },
  { match: ["cakes"], slots: [{ gx: 2.6, gy: 1.85, z: 24 }], layer: "back", draw: (s) => <Pastry s={s} cake /> },
];

const cafeFlow = {
  door: [0.15, 5.7] as Pt,
  inside: [1.2, 5.75] as Pt,
  queueHead: [3.3, 2.95] as Pt,
  queueStep: [0, 0.72] as Pt,
  pickup: [5.0, 2.95] as Pt,
  done: "mood" as const,
  fast: (ok: Set<string>) => (ok.has("barista") ? 1.7 : 1) * (ok.has("machine") ? 1.2 : 1),
};

const COFFEE_HINTS: Art["hints"] = {
  counter: [
    { gx: 2.6, gy: 1.85, z: 24 },
    { gx: 3.05, gy: 1.85, z: 24 },
    { gx: 5.1, gy: 1.9, z: 24 },
    { gx: 3.95, gy: 0.1, z: 22 },
    { gx: 5.4, gy: 0.1, z: 22 },
  ],
  wall: [{ gx: 0.05, gy: 0, wall: "R", w: 0.8, z: 62 }, { gx: 0, gy: 0.05, wall: "L", d: 0.7, z: 56 }],
  screen: [{ gx: 0, gy: 3.6, wall: "L", d: 1.2, z: 44 }, { gx: 0.05, gy: 0, wall: "R", w: 0.8, z: 40 }],
  window: [{ gx: 0, gy: 1.5, wall: "L", d: 1.2, z: 50 }],
  annex: [{ gx: 9.5, gy: 0.05 }],
  staff: [{ gx: 5.2, gy: 1.05 }, { gx: 1.4, gy: 1.05 }],
  street: [{ gx: 6.2, gy: 7.6 }, { gx: 8.4, gy: 7.6 }],
  outside: [{ gx: 9.6, gy: 6.3 }],
  cloud: [{ gx: 4.5, gy: 3.5, z: 150 }, { gx: 7.5, gy: 2.5, z: 150 }],
};

export const coffeeArt: Art = {
  key: "coffee",
  visitors: "гости",
  Background: ({ ctx }) => <CafeBackground ctx={ctx} />,
  Fixtures: ({ ctx }) => <CafeFixtures ctx={ctx} />,
  sprites: [...coffeeSprites, ...rewardSprites(DEFAULT_REWARDS)],
  extraSlots: DEFAULT_EXTRA,
  hints: COFFEE_HINTS,
  flow: { ...cafeFlow, orderIcons: ["cup", "cup", "cake", "laptop"], carry: "cup" },
};

export const bakeryArt: Art = {
  key: "bakery",
  visitors: "покупатели",
  Background: ({ ctx }) => <CafeBackground ctx={ctx} bakery />,
  Fixtures: ({ ctx }) => <CafeFixtures ctx={ctx} bakery />,
  sprites: [...bakerySprites, ...coffeeSprites, ...rewardSprites(DEFAULT_REWARDS)],
  extraSlots: DEFAULT_EXTRA,
  hints: { ...COFFEE_HINTS, counter: [{ gx: 3.05, gy: 1.85, z: 24 }, { gx: 5.1, gy: 1.9, z: 24 }, { gx: 1.2, gy: 1.85, z: 24 }, { gx: 5.6, gy: 0.1, z: 22 }] },
  flow: { ...cafeFlow, orderIcons: ["bread", "cake", "cup"], carry: "bag", fast: (ok) => (ok.has("baker") ? 1.7 : 1) * (ok.has("oven") ? 1.2 : 1) },
};
