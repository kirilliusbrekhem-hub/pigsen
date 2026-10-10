// Еда (бургерная, суши-бар), услуги (фитнес, автомойка, салон красоты), торговля (магазин одежды) and two more IT
// offices (игровая студия, ИИ-стартап). Each room has its own floor/walls and a signature fixture so even an empty
// business reads at a glance; bought items get keyword sprites, the rest fall back to the generic hint sprites.
import { Box, C, LOOKS, P, Person, Shadow, Tile, WallL, WallR, WallText, pts, tf, type Pt } from "./iso";
import { Chair, DEFAULT_EXTRA, Desk, DoorL, Lamp, Plant, RoundTable, Room, Staff, WindowL, WindowR } from "./room";
import { DEFAULT_REWARDS, rewardSprites } from "./generic";
import { SimpleFixtures, counterFlow } from "./others";
import { OFFICE_REWARDS, OfficeFixtures, officeFlow, officeHints, officeSprites } from "./office";
import type { Art, SceneCtx, SpriteDef } from "./types";

const OFFLINE_HINTS = {
  counter: [{ gx: 1.3, gy: 3.3, z: 24 }, { gx: 2.2, gy: 3.3, z: 24 }],
  screen: [{ gx: 0, gy: 3.3, wall: "L" as const, d: 0.8, z: 52 }, { gx: 0, gy: 0.3, wall: "L" as const, d: 0.8, z: 74 }],
  wall: [{ gx: 7.3, gy: 0, wall: "R" as const, w: 0.8, z: 74 }, { gx: 8.1, gy: 0, wall: "R" as const, w: 0.8, z: 74 }],
  window: [{ gx: 0, gy: 1.2, wall: "L" as const, d: 1, z: 50 }],
  annex: [{ gx: 9.6, gy: 0.4 }, { gx: 9.6, gy: 2.6 }, { gx: 9.6, gy: 4.8 }],
  staff: [{ gx: 7.2, gy: 1.6 }, { gx: 4.2, gy: 3.0 }],
  street: [{ gx: 6.2, gy: 7.6 }, { gx: 3.8, gy: 7.6 }],
  outside: [{ gx: 9.6, gy: 5.2 }],
  floor: [{ gx: 7.6, gy: 4.6 }, { gx: 4.2, gy: 6.3 }],
  cloud: [{ gx: 4.5, gy: 3.5, z: 150 }],
};

/** Back-wall sign: dark plate with light lettering (or neon if `neon`). */
function Plate({ gx0, gx1, z, text, size = 9, neon }: { gx0: number; gx1: number; z: number; text: string; size?: number; neon?: boolean }) {
  return (
    <g>
      {!neon && <WallR gx0={gx0} gx1={gx1} z0={z - 9} z1={z + 9} fill={C.ink} />}
      <WallText at={P((gx0 + gx1) / 2, 0, z - 3.5)} side="R" size={size} weight={800} spacing={1.6} fill={neon ? undefined : C.g4} className={neon ? "bz-neon-text" : undefined}>
        {text}
      </WallText>
    </g>
  );
}

function Steam({ gx, gy, z }: { gx: number; gy: number; z: number }) {
  const [x, y] = P(gx, gy, z);
  return (
    <g>
      <path className="bz-steam" d={`M${x} ${y} q-4 -6 0 -12`} />
      <path className="bz-steam s2" d={`M${x + 5} ${y} q-4 -6 0 -12`} />
    </g>
  );
}

// ───────────────────────── Бургерная ─────────────────────────
function BurgerBackground({ ctx }: { ctx: SceneCtx }) {
  const reno = ctx.has.has("burger-renovation");
  return (
    <Room ctx={ctx} floor={[C.ink2, C.n1]} wainscot={reno ? C.g8 : C.g7}>
      <WindowL gy0={0.9} gy1={3.2} z0={36} z1={72} />
      <DoorL />
      {/* chalk menu board */}
      <WallR gx0={6.6} gx1={8.6} z0={44} z1={78} fill={C.ink} />
      <WallR gx0={6.7} gx1={8.5} z0={46} z1={76} fill={C.ink3} />
      {[70, 63, 56, 50].map((z, i) => (
        <WallR key={z} gx0={6.85} gx1={i % 2 ? 7.9 : 8.25} z0={z} z1={z + 1.6} fill={i ? C.n4 : C.g4} />
      ))}
    </Room>
  );
}
function BurgerFixtures() {
  return (
    <g>
      {/* kitchen line along the back wall */}
      <Box gx={2.4} gy={0} w={4} d={0.7} h={22} top="url(#bz-metal)" left={C.n5} right={C.n6} />
      <polygon points={pts(P(2.4, 0.7, 18), P(6.4, 0.7, 18), P(6.4, 0.7, 16), P(2.4, 0.7, 16))} fill={C.g6} />
      <WallR gx0={2.4} gx1={6.4} z0={22} z1={46} fill={C.n1} />
      {[2.8, 3.6, 4.4, 5.2, 6.0].map((g, i) => (
        <WallR key={g} gx0={g - 0.35} gx1={g + 0.35} z0={26 + (i % 2) * 6} z1={28 + (i % 2) * 6} fill={C.n4} />
      ))}
      <Staff gx={4.2} gy={1.3} look={LOOKS[1]} apron={C.ink} hat={C.w} className="bz-cut" />
      <SimpleFixtures tone="shop" />
    </g>
  );
}
const BURGER_TABLES: Pt[] = [
  [6.6, 3.9],
  [6.6, 5.8],
];
const burgerSprites: SpriteDef[] = [
  {
    match: ["grill", "starter"],
    slots: [{ gx: 2.6, gy: 0.1, z: 22, w: 1.4 }],
    layer: "back",
    draw: (s, _c, id) =>
      id === "starter" ? (
        <g>
          <Box gx={s.gx + 0.1} gy={s.gy + 0.1} w={0.5} d={0.4} h={4} z={22} top={C.n1} left={C.n4} right={C.n5} />
          <Box gx={s.gx + 0.15} gy={s.gy + 0.15} w={0.35} d={0.3} h={3} z={26} top={C.g5} left={C.g7} right={C.g8} />
        </g>
      ) : (
        <g>
          <Box gx={s.gx} gy={s.gy} w={1.4} d={0.5} h={2} z={22} top={C.ink} left={C.ink2} right={C.ink} />
          {[0.25, 0.5, 0.75, 1.0, 1.25].map((o) => (
            <polygon key={o} points={pts(P(s.gx + o, s.gy + 0.05, 24.2), P(s.gx + o + 0.04, s.gy + 0.05, 24.2), P(s.gx + o + 0.04, s.gy + 0.45, 24.2), P(s.gx + o, s.gy + 0.45, 24.2))} fill={C.n5} />
          ))}
          {[0.3, 0.8].map((o) => (
            <ellipse key={o} cx={P(s.gx + o + 0.15, s.gy + 0.25, 25)[0]} cy={P(s.gx + o + 0.15, s.gy + 0.25, 25)[1]} rx={4.5} ry={2.2} fill={C.ink3} />
          ))}
          <Steam gx={s.gx + 0.6} gy={s.gy + 0.25} z={30} />
        </g>
      ),
  },
  {
    match: ["fryer"],
    slots: [{ gx: 4.4, gy: 0.1, z: 22 }],
    layer: "back",
    draw: (s) => (
      <g>
        <Box gx={s.gx} gy={s.gy} w={0.8} d={0.5} h={6} z={22} top={C.n5} left="url(#bz-metal)" right={C.n5} />
        <Box gx={s.gx + 0.1} gy={s.gy + 0.08} w={0.6} d={0.34} h={0.6} z={28} top={C.g8} left={C.g8} right={C.g9} />
        <Steam gx={s.gx + 0.4} gy={s.gy + 0.25} z={32} />
      </g>
    ),
  },
  {
    match: ["milkshake", "sauces", "buns"],
    slots: [{ gx: 5.4, gy: 0.15, z: 22 }, { gx: 5.9, gy: 0.15, z: 22 }, { gx: 3.6, gy: 0.15, z: 22 }],
    layer: "back",
    draw: (s, _c, id) => {
      const [x, y] = P(s.gx + 0.2, s.gy + 0.2, s.z ?? 22);
      if (id === "buns") return <path d={`M${x - 7} ${y} q0 -7 7 -7 q7 0 7 7 Z`} fill={C.n4} stroke={C.n6} strokeWidth={0.6} />;
      return (
        <g>
          {[-4, 2].map((dx, i) => (
            <path key={dx} d={`M${x + dx - 2.5} ${y} l-0.6 -9 h6.2 l-0.6 9 Z`} fill={i ? C.g4 : C.n1} stroke={C.ink3} strokeWidth={0.4} />
          ))}
        </g>
      );
    },
  },
  {
    match: ["burger-tables"],
    slots: BURGER_TABLES.map(([gx, gy]) => ({ gx: gx - 0.9, gy: gy - 0.9, w: 1.8, d: 1.8 })),
    layer: "front",
    draw: (s) => {
      const t: Pt = [s.gx + 0.9, s.gy + 0.9];
      return (
        <g>
          <Chair gx={t[0] - 1.0} gy={t[1] - 0.2} tone={C.g8} />
          <Chair gx={t[0] - 0.2} gy={t[1] - 1.0} tone={C.g8} />
          <RoundTable gx={t[0]} gy={t[1]} top={C.n1} />
        </g>
      );
    },
    seats: (s) => [
      [s.gx + 0.15, s.gy + 0.95],
      [s.gx + 0.95, s.gy + 0.15],
    ],
  },
  {
    match: ["burger-sign", "burger-neon"],
    slots: [{ gx: 0, gy: 1.2, wall: "L", d: 1.6 }, { gx: 2.6, gy: 0, wall: "R", w: 3.4 }],
    layer: "back",
    draw: (_s, _c, id) =>
      id === "burger-neon" ? (
        <Plate gx0={2.6} gx1={6.2} z={60} text="BURGER" size={12} neon />
      ) : (
        <WallText at={P(0, 2.05, 80)} side="L" size={10} weight={900} fill={C.ink} spacing={1.6}>
          BURGERS
        </WallText>
      ),
  },
  {
    match: ["cook"],
    slots: [{ gx: 2.9, gy: 1.3 }],
    layer: "back",
    draw: (s) => <Staff gx={s.gx} gy={s.gy} look={LOOKS[4]} apron={C.w} hat={C.w} className="bz-cut" />,
  },
];

export const burgerArt: Art = {
  key: "burger",
  visitors: "гости",
  Background: ({ ctx }) => <BurgerBackground ctx={ctx} />,
  Fixtures: () => <BurgerFixtures />,
  sprites: [...burgerSprites, ...rewardSprites(DEFAULT_REWARDS)],
  extraSlots: DEFAULT_EXTRA,
  hints: { ...OFFLINE_HINTS, wall: [{ gx: 7.0, gy: 0, wall: "R", w: 0.8, z: 86 }, { gx: 0, gy: 3.6, wall: "L", d: 0.8, z: 82 }] },
  flow: { ...counterFlow, orderIcons: ["bag", "cup"], carry: "bag", fast: (ok) => 1 + 0.3 * [...ok].filter((i) => /cook|cashier/.test(i)).length },
};

// ───────────────────────── Суши-бар ─────────────────────────
function Lantern({ gx, gy, z }: { gx: number; gy: number; z: number }) {
  const [x, y] = P(gx, gy, z);
  return (
    <g>
      <line x1={x} y1={y - 30} x2={x} y2={y - 8} stroke={C.ink} strokeWidth={0.7} />
      <circle cx={x} cy={y + 4} r={16} fill="url(#bz-warm)" className="bz-lamp-glow" />
      <ellipse cx={x} cy={y} rx={6} ry={8} fill={C.n1} />
      <path d={`M${x - 6} ${y - 2} h12 M${x - 5.5} ${y + 3} h11`} stroke={C.n4} strokeWidth={0.6} />
      <rect x={x - 2.5} y={y - 9.5} width={5} height={2} fill={C.ink} />
      <rect x={x - 2.5} y={y + 7.5} width={5} height={2} fill={C.ink} />
    </g>
  );
}
function SushiBackground({ ctx }: { ctx: SceneCtx }) {
  const reno = ctx.has.has("sushi-renovation");
  return (
    <Room ctx={ctx} floor={[C.n4, C.n3]} wallTone={[C.ink3, C.ink2]} wainscot={reno ? C.n5 : null}>
      <WindowL gy0={1.0} gy1={3.0} z0={34} z1={70} />
      <DoorL />
      {/* noren curtain over the door */}
      {[5.0, 5.47, 5.94].map((gy) => (
        <WallL key={gy} gy0={gy} gy1={gy + 0.43} z0={46} z1={66} fill={C.g8} gx={0.02} />
      ))}
      {/* enso circle */}
      {(() => {
        const [x, y] = P(7.6, 0, 62);
        return (
          <g transform={`matrix(1 0.5 0 1 ${x} ${y})`}>
            <circle r={13} fill="none" stroke={C.g5} strokeWidth={3.2} strokeDasharray="70 12" />
          </g>
        );
      })()}
      {/* wood slats */}
      {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5].map((g) => (
        <WallR key={g} gx0={g} gx1={g + 0.08} z0={30} z1={88} fill={C.n6} opacity={0.5} />
      ))}
    </Room>
  );
}
function SushiFixtures() {
  return (
    <g>
      {/* chef's bar: back prep counter + long front bar */}
      <Box gx={1.0} gy={0} w={5.4} d={0.55} h={22} top={C.n1} left={C.ink2} right={C.ink} />
      <Staff gx={3.9} gy={1.05} look={LOOKS[2]} apron={C.w} hat={C.w} className="bz-cut" />
      <Shadow gx={4.0} gy={2.4} rx={70} ry={14} o={0.12} />
      <Box gx={2.4} gy={1.75} w={4.2} d={0.6} h={24} top={C.n2} left={C.n6} right={C.n5} />
      <Box gx={2.4} gy={1.75} w={4.2} d={0.6} h={2} z={24} top={C.n1} left={C.n4} right={C.n4} />
      <SimpleFixtures tone="barber" />
    </g>
  );
}
const sushiSprites: SpriteDef[] = [
  {
    match: ["fish-fridge"],
    slots: [{ gx: 3.2, gy: 1.8, z: 26 }],
    layer: "back",
    draw: (s) => (
      <g>
        <Box gx={s.gx} gy={s.gy} w={1.6} d={0.4} h={8} z={26} top="url(#bz-glass)" left="url(#bz-glass)" right={C.g2} />
        {[0.2, 0.55, 0.9, 1.25].map((o, i) => (
          <Box key={o} gx={s.gx + o} gy={s.gy + 0.1} w={0.25} d={0.2} h={2} z={27} top={i % 2 ? C.n1 : C.g4} left={C.n4} right={C.n5} />
        ))}
      </g>
    ),
  },
  {
    match: ["rice-cooker", "starter", "miso", "knives"],
    slots: [{ gx: 1.6, gy: 0.1, z: 22 }, { gx: 2.4, gy: 0.1, z: 22 }, { gx: 5.4, gy: 0.1, z: 22 }, { gx: 4.8, gy: 0.1, z: 22 }],
    layer: "back",
    draw: (s, _c, id) => {
      const [x, y] = P(s.gx + 0.25, s.gy + 0.2, s.z ?? 22);
      if (id === "starter") return <Box gx={s.gx} gy={s.gy} w={0.6} d={0.4} h={0.8} z={22} top={C.g4} left={C.g6} right={C.g7} />;
      if (id === "knives") return <path d={`M${x - 6} ${y - 2} l12 -3 v1.4 l-12 3 Z M${x - 6} ${y + 1} l12 -3 v1.4 l-12 3 Z`} fill={C.n4} />;
      return (
        <g>
          <ellipse cx={x} cy={y} rx={6} ry={3} fill={C.n5} />
          <rect x={x - 6} y={y - 7} width={12} height={7} fill={id === "miso" ? C.ink2 : C.w} />
          <ellipse cx={x} cy={y - 7} rx={6} ry={3} fill={id === "miso" ? C.ink3 : C.n2} />
          <Steam gx={s.gx + 0.25} gy={s.gy + 0.2} z={(s.z ?? 22) + 10} />
        </g>
      );
    },
  },
  {
    match: ["sushi-bar"],
    slots: [{ gx: 2.6, gy: 2.6, w: 3.8, d: 0.6 }],
    layer: "front",
    draw: () => (
      <g>
        {[2.8, 3.8, 4.8, 5.8].map((g) => (
          <g key={g}>
            <Shadow gx={g + 0.2} gy={2.95} rx={7} ry={3} />
            <Box gx={g + 0.15} gy={2.8} w={0.08} d={0.08} h={14} top={C.ink} left={C.ink2} right={C.ink} />
            <Box gx={g} gy={2.65} w={0.38} d={0.38} h={2.5} z={14} top={C.g6} left={C.g8} right={C.g9} />
          </g>
        ))}
      </g>
    ),
    seats: () => [2.8, 3.8, 4.8, 5.8].map((g): Pt => [g + 0.2, 2.85]),
  },
  {
    match: ["conveyor"],
    slots: [{ gx: 2.45, gy: 1.8, z: 26, w: 4.1 }],
    layer: "back",
    draw: () => (
      <g>
        <Box gx={2.45} gy={1.8} w={4.1} d={0.3} h={1.5} z={26} top={C.ink3} left={C.ink} right={C.ink} />
        {[2.7, 3.3, 3.9, 4.5, 5.1, 5.7, 6.2].map((g, i) => {
          const [x, y] = P(g, 1.95, 27.5);
          return <ellipse key={g} className="bz-blink" cx={x} cy={y} rx={4} ry={1.8} fill={i % 2 ? C.g4 : C.n1} />;
        })}
      </g>
    ),
  },
  {
    match: ["sushi-sign", "sushi-lanterns"],
    slots: [{ gx: 0, gy: 1.4, wall: "L", d: 1.4 }, { gx: 2, gy: 0, wall: "R", w: 4 }],
    layer: "front",
    draw: (_s, _c, id) =>
      id === "sushi-sign" ? (
        <g>
          <WallText at={P(0, 2.0, 80)} side="L" size={10} weight={900} spacing={2} className="bz-neon-text">
            SUSHI
          </WallText>
          <Lantern gx={0.4} gy={4.4} z={74} />
        </g>
      ) : (
        <g>
          <Lantern gx={3.0} gy={1.9} z={78} />
          <Lantern gx={4.6} gy={1.9} z={78} />
          <Lantern gx={6.2} gy={1.9} z={78} />
        </g>
      ),
  },
  {
    match: ["sushi-chef"],
    slots: [{ gx: 5.6, gy: 1.05 }],
    layer: "back",
    draw: (s) => <Staff gx={s.gx} gy={s.gy} look={LOOKS[0]} apron={C.w} hat={C.w} className="bz-cut" />,
  },
];
export const sushiArt: Art = {
  key: "sushi",
  visitors: "гости",
  Background: ({ ctx }) => <SushiBackground ctx={ctx} />,
  Fixtures: () => <SushiFixtures />,
  sprites: [...sushiSprites, ...rewardSprites(DEFAULT_REWARDS)],
  extraSlots: DEFAULT_EXTRA,
  hints: OFFLINE_HINTS,
  flow: { ...counterFlow, orderIcons: ["bag", "cup"], carry: "bag", fast: (ok) => 1 + 0.3 * [...ok].filter((i) => /chef/.test(i)).length },
};

// ───────────────────────── Фитнес-клуб ─────────────────────────
function Treadmill({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <Shadow gx={gx + 0.35} gy={gy + 0.7} rx={14} ry={7} />
      <Box gx={gx} gy={gy} w={0.7} d={1.5} h={5} top={C.ink3} left={C.ink2} right={C.ink} />
      <Box gx={gx + 0.08} gy={gy + 0.2} w={0.54} d={1.2} h={0.5} z={5} top={C.ink} left={C.ink} right={C.ink} />
      <Box gx={gx + 0.04} gy={gy} w={0.06} d={0.06} h={26} top={C.n5} left={C.n5} right={C.n6} />
      <Box gx={gx + 0.6} gy={gy} w={0.06} d={0.06} h={26} top={C.n5} left={C.n5} right={C.n6} />
      <Box gx={gx} gy={gy - 0.05} w={0.7} d={0.25} h={5} z={24} top={C.ink3} left={C.ink2} right={C.ink} />
      <polygon className="bz-screen" points={pts(P(gx + 0.15, gy + 0.2, 27), P(gx + 0.55, gy + 0.2, 27), P(gx + 0.55, gy + 0.2, 29), P(gx + 0.15, gy + 0.2, 29))} />
    </g>
  );
}
function FitnessBackground({ ctx }: { ctx: SceneCtx }) {
  return (
    <Room ctx={ctx} floor={[C.ink3, C.ink2]} wainscot={ctx.has.has("gym-renovation") ? C.g8 : null}>
      <WindowR gx0={5.4} gx1={8.6} z0={56} z1={84} bars={3} />
      <DoorL />
      <WallR gx0={0} gx1={9} z0={40} z1={44} fill={C.g6} />
      <WallL gy0={0} gy1={7} z0={40} z1={44} fill={C.g6} />
      {/* training zone */}
      <Tile gx={4.4} gy={3.6} w={4.2} d={3.0} fill={C.g8} />
      <Tile gx={4.55} gy={3.75} w={3.9} d={2.7} fill={C.g7} opacity={0.6} />
      {[4.4, 5.8, 7.2].map((g) => (
        <Tile key={g} gx={g} gy={3.6} w={0.05} d={3.0} fill={C.g5} />
      ))}
    </Room>
  );
}
const TREADMILLS: Pt[] = [
  [2.7, 0.4],
  [3.7, 0.4],
  [4.7, 0.4],
];
const fitnessSprites: SpriteDef[] = [
  {
    match: ["treadmill"],
    slots: [{ gx: 2.7, gy: 0.4, w: 2.7, d: 1.5 }],
    layer: "back",
    draw: () => (
      <g>
        {TREADMILLS.map(([gx, gy]) => (
          <Treadmill key={gx} gx={gx} gy={gy} />
        ))}
      </g>
    ),
    seats: () => TREADMILLS.map(([gx, gy]): Pt => [gx + 0.35, gy + 1.0]),
  },
  {
    match: ["rack"],
    slots: [{ gx: 6.0, gy: 4.0, w: 1.4, d: 1.0 }],
    layer: "front",
    draw: (s) => (
      <g>
        <Shadow gx={s.gx + 0.7} gy={s.gy + 0.5} rx={26} ry={9} />
        {[
          [0, 0],
          [1.3, 0],
          [0, 0.9],
          [1.3, 0.9],
        ].map(([a, b]) => (
          <Box key={`${a}${b}`} gx={s.gx + a} gy={s.gy + b} w={0.1} d={0.1} h={48} top={C.ink} left={C.ink2} right={C.ink} />
        ))}
        <Box gx={s.gx} gy={s.gy} w={1.4} d={0.1} h={3} z={48} top={C.ink} left={C.ink2} right={C.ink} />
        <Box gx={s.gx} gy={s.gy + 0.9} w={1.4} d={0.1} h={3} z={48} top={C.ink} left={C.ink2} right={C.ink} />
        <Box gx={s.gx - 0.3} gy={s.gy + 0.45} w={2.0} d={0.05} h={1.2} z={30} top={C.n4} left="url(#bz-metal)" right={C.n5} />
        {[-0.25, 1.5].map((o) => (
          <Box key={o} gx={s.gx + o} gy={s.gy + 0.3} w={0.15} d={0.35} h={10} z={25} top={C.g6} left={C.g8} right={C.g9} />
        ))}
      </g>
    ),
  },
  {
    match: ["dumbbells", "starter"],
    slots: [{ gx: 0.1, gy: 0.4, w: 0.5, d: 1.8 }, { gx: 5.0, gy: 5.6, w: 1.2, d: 0.7 }],
    layer: "back",
    draw: (s, _c, id) =>
      id === "starter" ? (
        <g>
          <Tile gx={s.gx} gy={s.gy} w={1.2} d={0.6} fill={C.g5} z={0.5} />
          <Box gx={s.gx + 0.3} gy={s.gy + 0.2} w={0.2} d={0.12} h={3} z={0.5} top={C.ink3} left={C.ink2} right={C.ink} />
          <Box gx={s.gx + 0.7} gy={s.gy + 0.2} w={0.2} d={0.12} h={3} z={0.5} top={C.ink3} left={C.ink2} right={C.ink} />
        </g>
      ) : (
        <g>
          <Box gx={s.gx} gy={s.gy} w={0.5} d={1.8} h={14} top={C.ink3} left={C.ink2} right={C.ink} />
          {[0.15, 0.45, 0.75, 1.05, 1.35, 1.6].map((o, i) => (
            <Box key={o} gx={s.gx + 0.15} gy={s.gy + o} w={0.25} d={0.14} h={4} z={14} top={i % 2 ? C.g5 : C.n4} left={C.ink2} right={C.ink} />
          ))}
        </g>
      ),
  },
  {
    match: ["gym-mirrors"],
    slots: [{ gx: 2.4, gy: 0, wall: "R", w: 3 }],
    layer: "back",
    draw: () => (
      <g>
        {[2.5, 3.5, 4.5].map((g) => (
          <g key={g}>
            <WallR gx0={g} gx1={g + 0.92} z0={8} z1={38} fill={C.ink} />
            <WallR gx0={g + 0.04} gx1={g + 0.88} z0={10} z1={37} fill="url(#bz-sky)" />
            <WallR gx0={g + 0.04} gx1={g + 0.88} z0={10} z1={37} fill="url(#bz-glass)" opacity={0.85} />
          </g>
        ))}
      </g>
    ),
  },
  {
    match: ["gym-sign", "gym-neon"],
    slots: [{ gx: 0, gy: 1.5, wall: "L", d: 2 }, { gx: 2.4, gy: 0, wall: "R", w: 3 }],
    layer: "back",
    draw: (_s, _c, id) =>
      id === "gym-sign" ? (
        <WallText at={P(0, 2.6, 76)} side="L" size={10} weight={900} fill={C.w} spacing={2}>
          FIT CLUB
        </WallText>
      ) : (
        <WallText at={P(3.9, 0, 52)} side="R" size={10} weight={900} spacing={2} className="bz-neon-text">
          NO PAIN
        </WallText>
      ),
  },
  {
    match: ["trainer"],
    slots: [{ gx: 7.6, gy: 5.6 }],
    layer: "front",
    draw: (s) => <Staff gx={s.gx} gy={s.gy} look={LOOKS[0]} apron={C.ink} className="bz-route" />,
  },
];
export const fitnessArt: Art = {
  key: "fitness",
  visitors: "клиенты",
  Background: ({ ctx }) => <FitnessBackground ctx={ctx} />,
  Fixtures: () => <SimpleFixtures tone="barber" />,
  sprites: [...fitnessSprites, ...rewardSprites(DEFAULT_REWARDS)],
  extraSlots: DEFAULT_EXTRA,
  hints: { ...OFFLINE_HINTS, wall: [{ gx: 0, gy: 3.4, wall: "L", d: 0.8, z: 70 }, { gx: 6.0, gy: 0, wall: "R", w: 0.8, z: 30 }], floor: [{ gx: 4.6, gy: 4.0 }, { gx: 7.6, gy: 3.2 }, { gx: 4.6, gy: 5.8 }] },
  flow: { ...counterFlow, orderIcons: ["check", "cup"], carry: null, fast: (ok) => 1 + 0.3 * [...ok].filter((i) => /trainer|reception/.test(i)).length },
};

// ───────────────────────── Автомойка ─────────────────────────
function Car({ gx, gy, foam }: { gx: number; gy: number; foam?: boolean }) {
  const wheel = (a: number, b: number) => {
    const [x, y] = P(gx + a, gy + b, 4);
    return <ellipse key={`${a}${b}`} cx={x} cy={y} rx={4.6} ry={5} fill={C.ink} />;
  };
  return (
    <g>
      <Shadow gx={gx + 1.3} gy={gy + 0.65} rx={48} ry={16} o={0.22} />
      {wheel(0.4, 1.3)}
      {wheel(2.1, 1.3)}
      <Box gx={gx} gy={gy} w={2.6} d={1.3} h={10} z={4} top={C.g6} left={C.g7} right={C.g8} />
      <Box gx={gx + 0.6} gy={gy + 0.1} w={1.3} d={1.1} h={9} z={14} top={C.g5} left="url(#bz-glass)" right={C.g2} />
      <Box gx={gx + 0.65} gy={gy + 0.15} w={1.2} d={1.0} h={0.6} z={23} top={C.g6} left={C.g7} right={C.g8} />
      <polygon points={pts(P(gx + 2.6, gy + 0.15, 9), P(gx + 2.6, gy + 0.4, 9), P(gx + 2.6, gy + 0.4, 12), P(gx + 2.6, gy + 0.15, 12))} fill={C.w} />
      <polygon points={pts(P(gx + 2.6, gy + 0.9, 9), P(gx + 2.6, gy + 1.15, 9), P(gx + 2.6, gy + 1.15, 12), P(gx + 2.6, gy + 0.9, 12))} fill={C.w} />
      {foam &&
        [0.3, 0.7, 1.1, 1.5, 1.9, 2.3].map((o, i) => {
          const [x, y] = P(gx + o, gy + 0.65 + (i % 2) * 0.3, 15 + (i % 3) * 6);
          return <circle key={o} cx={x} cy={y} r={5 + (i % 2) * 2} fill={C.w} opacity={0.92} className="bz-sway" />;
        })}
    </g>
  );
}
function CarwashBackground({ ctx }: { ctx: SceneCtx }) {
  return (
    <Room ctx={ctx} floor={[C.n4, C.n3]} wallTone={[C.n2, C.n3]}>
      <DoorL />
      {/* bay markings + drain */}
      <Tile gx={3.4} gy={2.4} w={4.6} d={0.08} fill={C.g6} />
      <Tile gx={3.4} gy={5.2} w={4.6} d={0.08} fill={C.g6} />
      <Tile gx={4.2} gy={3.75} w={3} d={0.12} fill={C.ink3} />
      {/* tiled back wall */}
      {[10, 26, 42, 58, 74].map((z) => (
        <WallR key={z} gx0={2.8} gx1={9} z0={z} z1={z + 0.8} fill={C.n4} />
      ))}
      <WallL gy0={0.4} gy1={3.8} z0={30} z1={70} fill={C.ink} />
      <WallL gy0={0.5} gy1={3.7} z0={32} z1={68} fill="url(#bz-sky)" />
    </Room>
  );
}
function CarwashFixtures({ ctx }: { ctx: SceneCtx }) {
  return (
    <g>
      <Car gx={4.4} gy={3.1} foam={ctx.ok.has("foam")} />
      <SimpleFixtures tone="shop" />
    </g>
  );
}
const carwashSprites: SpriteDef[] = [
  {
    match: ["wash-box"],
    slots: [{ gx: 3.9, gy: 2.6, w: 3.6, d: 2.4 }],
    layer: "front",
    draw: () => (
      <g>
        {[
          [3.9, 2.6],
          [7.6, 2.6],
          [3.9, 5.0],
          [7.6, 5.0],
        ].map(([a, b]) => (
          <Box key={`${a}${b}`} gx={a} gy={b} w={0.14} d={0.14} h={70} top={C.ink} left={C.ink2} right={C.ink} />
        ))}
        <Box gx={3.9} gy={5.0} w={3.84} d={0.14} h={4} z={70} top={C.g7} left={C.g6} right={C.g8} />
        <Box gx={7.6} gy={2.6} w={0.14} d={2.54} h={4} z={70} top={C.g7} left={C.g6} right={C.g8} />
      </g>
    ),
  },
  {
    match: ["pressure", "starter", "vacuum"],
    slots: [{ gx: 3.0, gy: 0.3 }, { gx: 8.0, gy: 5.8 }, { gx: 8.2, gy: 1.0 }],
    layer: "back",
    draw: (s, _c, id) =>
      id === "starter" ? (
        <g>
          <Shadow gx={s.gx + 0.25} gy={s.gy + 0.25} rx={8} ry={3} />
          <Box gx={s.gx} gy={s.gy} w={0.45} d={0.45} h={9} top={C.g5} left={C.g7} right={C.g8} />
          <Box gx={s.gx + 0.55} gy={s.gy + 0.1} w={0.3} d={0.2} h={3} top={C.g4} left={C.g6} right={C.g7} />
        </g>
      ) : id === "vacuum" ? (
        <g>
          <Shadow gx={s.gx + 0.3} gy={s.gy + 0.3} rx={10} ry={4} />
          <Box gx={s.gx} gy={s.gy} w={0.6} d={0.6} h={20} top={C.ink3} left={C.ink2} right={C.ink} />
          <path d={`M${P(s.gx + 0.3, s.gy + 0.6, 18)[0]} ${P(s.gx + 0.3, s.gy + 0.6, 18)[1]} q-20 10 -30 30`} stroke={C.ink} strokeWidth={2} fill="none" />
        </g>
      ) : (
        <g>
          <Shadow gx={s.gx + 0.4} gy={s.gy + 0.3} rx={12} ry={5} />
          <Box gx={s.gx} gy={s.gy} w={0.8} d={0.55} h={22} top={C.g6} left={C.g7} right={C.g8} />
          <Box gx={s.gx + 0.1} gy={s.gy + 0.1} w={0.6} d={0.35} h={2} z={22} top={C.ink} left={C.ink2} right={C.ink} />
          <path d={`M${P(s.gx + 0.8, s.gy + 0.4, 14)[0]} ${P(s.gx + 0.8, s.gy + 0.4, 14)[1]} q30 4 40 30`} stroke={C.ink} strokeWidth={1.8} fill="none" />
        </g>
      ),
  },
  {
    match: ["wash-sign", "wash-neon"],
    slots: [{ gx: 3.4, gy: 0, wall: "R", w: 4 }, { gx: 0, gy: 0.5, wall: "L", d: 3.2 }],
    layer: "back",
    draw: (_s, _c, id) => (id === "wash-sign" ? <Plate gx0={4.2} gx1={7.6} z={84} text="МОЙКА 24" size={9} /> : <WallR gx0={2.8} gx1={9} z0={6} z1={8} fill={C.g4} className="bz-neon-strip" />),
  },
  {
    match: ["dryer"],
    slots: [{ gx: 5.0, gy: 0, wall: "R", w: 1.4 }],
    layer: "back",
    draw: () => (
      <g>
        <WallR gx0={5.0} gx1={6.4} z0={60} z1={74} fill={C.ink2} />
        {[5.2, 5.6, 6.0].map((g) => (
          <WallR key={g} gx0={g} gx1={g + 0.25} z0={62} z1={72} fill={C.n5} />
        ))}
      </g>
    ),
  },
  {
    match: ["washer"],
    slots: [{ gx: 7.6, gy: 3.6 }],
    layer: "front",
    draw: (s) => <Staff gx={s.gx} gy={s.gy} look={LOOKS[3]} apron={C.ink} className="bz-cut" />,
  },
];
export const carwashArt: Art = {
  key: "carwash",
  visitors: "водители",
  Background: ({ ctx }) => <CarwashBackground ctx={ctx} />,
  Fixtures: ({ ctx }) => <CarwashFixtures ctx={ctx} />,
  sprites: [...carwashSprites, ...rewardSprites(DEFAULT_REWARDS)],
  extraSlots: DEFAULT_EXTRA,
  hints: { ...OFFLINE_HINTS, floor: [{ gx: 8.2, gy: 6.0 }, { gx: 2.6, gy: 6.3 }, { gx: 8.3, gy: 2.4 }] },
  flow: { ...counterFlow, orderIcons: ["check", "cup"], carry: null, fast: (ok) => 1 + 0.3 * [...ok].filter((i) => /washer|tunnel/.test(i)).length },
};

// ───────────────────────── Салон красоты ─────────────────────────
function SalonChair({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <Shadow gx={gx + 0.35} gy={gy + 0.35} rx={14} ry={6} />
      <Box gx={gx + 0.28} gy={gy + 0.28} w={0.14} d={0.14} h={10} top={C.n4} left="url(#bz-metal)" right={C.n5} />
      <Box gx={gx} gy={gy} w={0.7} d={0.7} h={5} z={10} top={C.n1} left={C.n3} right={C.n4} />
      <Box gx={gx} gy={gy} w={0.7} d={0.18} h={18} z={14} top={C.n1} left={C.n3} right={C.n4} />
      <Box gx={gx} gy={gy + 0.1} w={0.12} d={0.6} h={4} z={15} top={C.g4} left={C.g5} right={C.g6} />
      <Box gx={gx + 0.58} gy={gy + 0.1} w={0.12} d={0.6} h={4} z={15} top={C.g4} left={C.g5} right={C.g6} />
    </g>
  );
}
const SALON: Pt[] = [
  [2.7, 0.9],
  [4.6, 0.9],
];
function BeautyBackground({ ctx }: { ctx: SceneCtx }) {
  return (
    <Room ctx={ctx} floor={[C.n1, C.w]} wallTone={[C.g1, C.g2]} wainscot={ctx.has.has("beauty-renovation") ? C.g3 : null}>
      <WindowL gy0={0.9} gy1={3.0} z0={34} z1={72} />
      <DoorL />
      {/* arches on the back wall */}
      {[6.4, 7.6].map((g) => (
        <g key={g}>
          <WallR gx0={g} gx1={g + 0.9} z0={10} z1={62} fill={C.g3} />
          <WallR gx0={g + 0.12} gx1={g + 0.78} z0={10} z1={58} fill={C.g2} />
        </g>
      ))}
      <Plant gx={8.5} gy={3.4} big />
      <Tile gx={5.6} gy={3.8} w={3} d={2.6} fill={C.g2} />
    </Room>
  );
}
const beautySprites: SpriteDef[] = [
  {
    match: ["beauty-mirror"],
    slots: [{ gx: 2.4, gy: 0, wall: "R", w: 3.4 }],
    layer: "back",
    draw: () => (
      <g>
        {SALON.map(([gx]) => {
          const [x, y] = P(gx + 0.45, 0, 52);
          return (
            <g key={gx} transform={`matrix(1 0.5 0 1 ${x} ${y})`}>
              <ellipse rx={13} ry={17} fill={C.ink} />
              <ellipse rx={11} ry={15} fill={C.g2} />
              <ellipse rx={11} ry={15} fill="url(#bz-glass)" />
              {[-14, -7, 0, 7, 14].map((d) => (
                <circle key={d} cx={d * 0.9} cy={-18 + Math.abs(d) * 0.25} r={1.6} fill={C.w} className="bz-blink" />
              ))}
            </g>
          );
        })}
      </g>
    ),
  },
  {
    match: ["beauty-chair"],
    slots: SALON.map(([gx, gy]) => ({ gx, gy, w: 0.7, d: 0.7 })),
    layer: "back",
    draw: () => (
      <g>
        {SALON.map(([gx, gy]) => (
          <SalonChair key={gx} gx={gx} gy={gy} />
        ))}
      </g>
    ),
    seats: () => SALON.map(([gx, gy]): Pt => [gx + 0.35, gy + 0.4]),
  },
  {
    match: ["manicure", "starter"],
    slots: [{ gx: 6.2, gy: 4.4, w: 1.3, d: 0.7 }, { gx: 6.0, gy: 0.3, w: 0.8, d: 0.5 }],
    layer: "front",
    draw: (s, _c, id) =>
      id === "starter" ? (
        <g>
          <Box gx={s.gx} gy={s.gy} w={0.8} d={0.5} h={18} top={C.n1} left={C.n3} right={C.n4} />
          {[0.15, 0.35, 0.55].map((o, i) => (
            <Box key={o} gx={s.gx + o} gy={s.gy + 0.15} w={0.1} d={0.1} h={5} z={18} top={i % 2 ? C.g5 : C.ink3} left={C.ink2} right={C.ink} />
          ))}
        </g>
      ) : (
        <g>
          <Shadow gx={s.gx + 0.65} gy={s.gy + 0.35} rx={22} ry={8} />
          <Box gx={s.gx} gy={s.gy} w={1.3} d={0.7} h={18} top={C.w} left={C.n3} right={C.n4} />
          <Box gx={s.gx + 0.1} gy={s.gy + 0.1} w={0.08} d={0.08} h={16} z={18} top={C.ink} left={C.ink2} right={C.ink} />
          <Box gx={s.gx + 0.1} gy={s.gy + 0.1} w={0.5} d={0.3} h={2} z={32} top={C.ink3} left={C.ink2} right={C.ink} />
          <Chair gx={s.gx + 0.4} gy={s.gy + 0.9} tone={C.n5} />
        </g>
      ),
    seats: (s) => [[s.gx + 0.65, s.gy + 1.15]],
  },
  {
    match: ["beauty-sofa"],
    slots: [{ gx: 6.1, gy: 6.0, w: 1.6, d: 0.7 }],
    layer: "front",
    draw: (s) => (
      <g>
        <Shadow gx={s.gx + 0.8} gy={s.gy + 0.4} rx={30} ry={10} />
        <Box gx={s.gx} gy={s.gy} w={1.6} d={0.7} h={10} top={C.g3} left={C.g4} right={C.g5} />
        <Box gx={s.gx} gy={s.gy} w={1.6} d={0.2} h={10} z={10} top={C.g3} left={C.g4} right={C.g5} />
      </g>
    ),
  },
  {
    match: ["beauty-sign", "beauty-neon"],
    slots: [{ gx: 0, gy: 1.4, wall: "L", d: 1.6 }, { gx: 6.4, gy: 0, wall: "R", w: 2.2 }],
    layer: "back",
    draw: (_s, _c, id) =>
      id === "beauty-sign" ? (
        <WallText at={P(0, 1.95, 80)} side="L" size={9} weight={800} fill={C.g8} spacing={2.4}>
          BEAUTY
        </WallText>
      ) : (
        <WallText at={P(7.5, 0, 72)} side="R" size={10} weight={800} spacing={2} className="bz-neon-text">
          glow
        </WallText>
      ),
  },
  {
    match: ["stylist", "nail-master"],
    slots: [{ gx: 3.6, gy: 1.5 }, { gx: 7.3, gy: 4.2 }],
    layer: "back",
    draw: (s, _c, _id, n) => <Staff gx={s.gx} gy={s.gy} look={LOOKS[(n + 5) % LOOKS.length]} apron={C.g8} className="bz-cut" />,
  },
];
export const beautyArt: Art = {
  key: "beauty",
  visitors: "клиенты",
  Background: ({ ctx }) => <BeautyBackground ctx={ctx} />,
  Fixtures: () => <SimpleFixtures tone="barber" />,
  sprites: [...beautySprites, ...rewardSprites(DEFAULT_REWARDS)],
  extraSlots: DEFAULT_EXTRA,
  hints: OFFLINE_HINTS,
  flow: { ...counterFlow, orderIcons: ["scissors", "happy"], carry: null, fast: (ok) => 1 + 0.3 * [...ok].filter((i) => /stylist|master/.test(i)).length, baseSeats: [] },
};

// ───────────────────────── Магазин одежды ─────────────────────────
const GARMENT = [C.g6, C.ink2, C.n1, C.g4, C.ink, C.g8, C.n4];
function Rail({ gx, gy, seed }: { gx: number; gy: number; seed: number }) {
  return (
    <g>
      <Shadow gx={gx + 0.8} gy={gy + 0.2} rx={30} ry={8} o={0.12} />
      <Box gx={gx} gy={gy} w={0.06} d={0.06} h={44} top={C.ink} left={C.ink2} right={C.ink} />
      <Box gx={gx + 1.6} gy={gy} w={0.06} d={0.06} h={44} top={C.ink} left={C.ink2} right={C.ink} />
      <Box gx={gx} gy={gy} w={1.66} d={0.05} h={1.5} z={44} top={C.n5} left="url(#bz-metal)" right={C.n5} />
      {[0.15, 0.4, 0.65, 0.9, 1.15, 1.4].map((o, i) => {
        const [x, y] = P(gx + o, gy + 0.03, 43);
        const c = GARMENT[(i + seed) % GARMENT.length];
        return <path key={o} d={`M${x - 4} ${y + 2} l1 -2 h6 l1 2 l-1 ${18 + ((i + seed) % 3) * 3} h-6 Z`} fill={c} stroke={C.ink} strokeOpacity={0.2} strokeWidth={0.5} />;
      })}
    </g>
  );
}
function ClothesBackground({ ctx }: { ctx: SceneCtx }) {
  return (
    <Room ctx={ctx} floor={[C.n3, C.n2]} wainscot={ctx.has.has("clothes-renovation") ? C.ink2 : null}>
      <WindowL gy0={0.6} gy1={3.6} z0={8} z1={78} bars={3} />
      <DoorL />
      <Tile gx={4.2} gy={3.4} w={3.8} d={2.8} fill={C.n1} />
      <Plant gx={8.5} gy={0.6} big />
    </Room>
  );
}
const clothesSprites: SpriteDef[] = [
  {
    match: ["racks", "collection", "starter"],
    slots: [{ gx: 4.6, gy: 3.8, w: 1.7, d: 0.3 }, { gx: 4.6, gy: 5.4, w: 1.7, d: 0.3 }, { gx: 2.6, gy: 0.4, w: 1.7, d: 0.3 }],
    layer: "front",
    draw: (s, _c, id, n) => <Rail gx={s.gx} gy={s.gy} seed={id === "starter" ? 4 : n * 2 + 1} />,
  },
  {
    match: ["mannequins"],
    slots: [{ gx: 0.6, gy: 1.4, w: 0.6, d: 1.6 }],
    layer: "back",
    draw: () => (
      <g>
        {[1.3, 2.5].map((gy, i) => (
          <g key={gy} transform={tf(0.8, gy)}>
            <rect x={-1} y={-6} width={2} height={6} fill={C.ink} />
            <Person look={{ body: i ? C.ink2 : C.g6, hair: C.n4, legs: i ? C.n5 : C.ink }} />
          </g>
        ))}
      </g>
    ),
  },
  {
    match: ["fitting"],
    slots: [{ gx: 6.2, gy: 0, wall: "R", w: 2.4 }],
    layer: "back",
    draw: () => (
      <g>
        {[6.3, 7.5].map((g) => (
          <g key={g}>
            <WallR gx0={g} gx1={g + 1.05} z0={0} z1={74} fill={C.ink} />
            {[0, 0.21, 0.42, 0.63, 0.84].map((o, i) => (
              <WallR key={o} gx0={g + o} gx1={g + o + 0.21} z0={4} z1={70} fill={i % 2 ? C.g7 : C.g8} gy={0.05} />
            ))}
          </g>
        ))}
      </g>
    ),
  },
  {
    match: ["clothes-sign", "clothes-neon"],
    slots: [{ gx: 2.4, gy: 0, wall: "R", w: 3.6 }, { gx: 0, gy: 4.2, wall: "L", d: 0.6 }],
    layer: "back",
    draw: (_s, _c, id) =>
      id === "clothes-sign" ? (
        <Plate gx0={2.6} gx1={5.6} z={80} text="STORE" size={10} />
      ) : (
        <WallText at={P(4.1, 0, 60)} side="R" size={12} weight={900} spacing={2} className="bz-neon-text">
          SALE
        </WallText>
      ),
  },
  {
    match: ["clothes-mirror"],
    slots: [{ gx: 5.6, gy: 0, wall: "R", w: 0.6 }],
    layer: "back",
    draw: () => (
      <g>
        <WallR gx0={5.6} gx1={6.15} z0={4} z1={66} fill={C.ink} />
        <WallR gx0={5.64} gx1={6.11} z0={6} z1={64} fill="url(#bz-sky)" />
        <WallR gx0={5.64} gx1={6.11} z0={6} z1={64} fill="url(#bz-glass)" />
      </g>
    ),
  },
  {
    match: ["seller", "stylist-service"],
    slots: [{ gx: 7.4, gy: 4.6 }, { gx: 3.8, gy: 4.8 }],
    layer: "front",
    draw: (s, _c, _id, n) => <Staff gx={s.gx} gy={s.gy} look={LOOKS[(n + 4) % LOOKS.length]} apron={C.ink} className="bz-route" />,
  },
];
export const clothesArt: Art = {
  key: "clothes",
  visitors: "покупатели",
  Background: ({ ctx }) => <ClothesBackground ctx={ctx} />,
  Fixtures: () => <SimpleFixtures tone="shop" />,
  sprites: [...clothesSprites, ...rewardSprites(DEFAULT_REWARDS)],
  extraSlots: DEFAULT_EXTRA,
  hints: { ...OFFLINE_HINTS, wall: [{ gx: 8.6, gy: 0, wall: "R", w: 0.3, z: 80 }, { gx: 0, gy: 4.2, wall: "L", d: 0.6, z: 82 }] },
  flow: { ...counterFlow, orderIcons: ["bag"], carry: "bag", fast: (ok) => 1 + 0.3 * [...ok].filter((i) => /seller|stylist/.test(i)).length },
};

// ───────────────────────── Игровая студия ─────────────────────────
function GameScreen() {
  const [x, y] = P(3.3, 0, 76);
  const blocks: [number, number, string][] = [
    [-40, 12, C.g7],
    [-30, 12, C.g7],
    [-20, 12, C.g7],
    [-10, 4, C.g6],
    [0, 4, C.g6],
    [12, -4, C.g6],
    [22, 12, C.g7],
    [32, 12, C.g7],
  ];
  return (
    <g transform={`matrix(1 0.5 0 1 ${x} ${y})`}>
      <rect x={-50} y={-26} width={100} height={50} rx={3} fill={C.ink} />
      <rect x={-47} y={-23} width={94} height={44} fill={C.g9} />
      {blocks.map(([bx, by, c], i) => (
        <rect key={i} x={bx} y={by} width={10} height={6} fill={c} />
      ))}
      <rect x={-6} y={-6} width={6} height={10} fill={C.n1} className="bz-cut" />
      <circle cx={17} cy={-14} r={2.4} fill={C.g4} className="bz-blink" />
      <circle cx={27} cy={-8} r={2.4} fill={C.g4} className="bz-blink" />
      <text x={-42} y={-14} fontSize={6} fontWeight={800} fill={C.g4} style={{ fontFamily: "var(--font-sans, system-ui)" }}>
        LVL 1
      </text>
    </g>
  );
}
function GamedevBackground({ ctx }: { ctx: SceneCtx }) {
  return (
    <Room ctx={ctx} floor={[C.ink3, C.ink2]} wallTone={[C.ink3, C.ink2]} wainscot={null}>
      <DoorL />
      <GameScreen />
      <WallR gx0={0} gx1={9} z0={88} z1={90} fill={C.g5} className="bz-neon-strip" />
      <Desk gx={6.6} gy={1.9} monitors={0} />
      <Tile gx={5.2} gy={3.3} w={3.4} d={3.3} fill={C.g8} />
      <Tile gx={5.35} gy={3.45} w={3.1} d={3.0} fill={C.g7} opacity={0.5} />
      <WallText at={P(0, 2.2, 82)} side="L" size={6.5} fill={C.g4} spacing={1.4}>
        GAME STUDIO
      </WallText>
    </Room>
  );
}
function Arcade({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <Shadow gx={gx + 0.35} gy={gy + 0.35} rx={12} ry={5} />
      <Box gx={gx} gy={gy} w={0.7} d={0.6} h={52} top={C.ink} left={C.g8} right={C.ink2} />
      <polygon className="bz-screen" points={pts(P(gx + 0.08, gy + 0.6, 32), P(gx + 0.62, gy + 0.6, 32), P(gx + 0.62, gy + 0.6, 46), P(gx + 0.08, gy + 0.6, 46))} />
      <Box gx={gx} gy={gy + 0.6} w={0.7} d={0.2} h={2} z={26} top={C.ink3} left={C.ink2} right={C.ink} />
      {[0.25, 0.45].map((o) => {
        const [x, y] = P(gx + o, gy + 0.7, 28.5);
        return <circle key={o} cx={x} cy={y} r={1.4} fill={C.g4} />;
      })}
    </g>
  );
}
const gamedevSprites: SpriteDef[] = [
  {
    match: ["arcade"],
    slots: [{ gx: 8.2, gy: 0.4 }],
    layer: "back",
    draw: (s) => <Arcade gx={s.gx} gy={s.gy} />,
  },
  {
    match: ["gd-pc", "starter", "gd-console"],
    slots: [{ gx: 6.6, gy: 1.9, w: 1.3, d: 0.75 }, { gx: 1.5, gy: 1.9, w: 1.3, d: 0.75 }, { gx: 5.6, gy: 4.4, w: 1.6, d: 0.8 }],
    layer: "back",
    draw: (s, _c, id) =>
      id === "gd-console" ? (
        <g>
          <Box gx={s.gx} gy={s.gy} w={1.6} d={0.5} h={8} top={C.ink3} left={C.ink2} right={C.ink} />
          <Box gx={s.gx + 0.3} gy={s.gy + 0.1} w={1.0} d={0.1} h={18} z={8} top={C.ink} left={C.ink} right={C.ink} />
          <polygon className="bz-screen" points={pts(P(s.gx + 0.35, s.gy + 0.2, 10), P(s.gx + 1.25, s.gy + 0.2, 10), P(s.gx + 1.25, s.gy + 0.2, 25), P(s.gx + 0.35, s.gy + 0.2, 25))} />
          <Box gx={s.gx + 0.4} gy={s.gy + 1.4} w={1.4} d={0.6} h={8} top={C.g6} left={C.g8} right={C.g9} />
        </g>
      ) : (
        <Desk gx={s.gx} gy={s.gy} monitors={id === "starter" ? 0 : 2} laptop={id === "starter"} />
      ),
  },
  {
    match: ["gd-neon"],
    slots: [{ gx: 0, gy: 0, wall: "L", d: 7 }],
    layer: "back",
    draw: () => (
      <g className="bz-neon-on">
        <WallL gy0={0} gy1={7} z0={87} z1={89} fill={C.g4} className="bz-neon-strip" />
        <WallR gx0={0} gx1={9} z0={4} z1={5.5} fill={C.g5} className="bz-neon-strip" />
      </g>
    ),
  },
];
export const gamedevArt: Art = {
  key: "gamedev",
  visitors: "игроки",
  Background: ({ ctx }) => <GamedevBackground ctx={ctx} />,
  Fixtures: () => (
    <g>
      <OfficeFixtures />
      <Arcade gx={0.3} gy={0.4} />
    </g>
  ),
  sprites: [...gamedevSprites, ...officeSprites, ...rewardSprites(OFFICE_REWARDS)],
  extraSlots: DEFAULT_EXTRA,
  hints: { ...officeHints, screen: [0.9, 2.0, 3.1].map((gy) => ({ gx: 0, gy, wall: "L" as const, d: 0.9, z: 50 })), wall: [6.6, 7.4, 8.2].map((gx) => ({ gx, gy: 0, wall: "R" as const, w: 0.7, z: 60 })) },
  flow: { ...officeFlow, orderIcons: ["app", "chat", "happy"] },
};

// ───────────────────────── ИИ-стартап ─────────────────────────
function NeuralWall({ lit }: { lit: boolean }) {
  const [x, y] = P(3.6, 0, 70);
  const layers = [
    [-12, 0, 12],
    [-18, -6, 6, 18],
    [-12, 0, 12],
    [0],
  ];
  const nodes = layers.flatMap((col, i) => col.map((yy) => [-48 + i * 32, yy] as [number, number]));
  const edges: [number, number, number, number][] = [];
  layers.forEach((col, i) => {
    if (i === layers.length - 1) return;
    col.forEach((a) => layers[i + 1].forEach((b) => edges.push([-48 + i * 32, a, -48 + (i + 1) * 32, b])));
  });
  return (
    <g transform={`matrix(1 0.5 0 1 ${x} ${y})`}>
      <rect x={-60} y={-28} width={120} height={56} rx={4} fill={lit ? C.ink : C.n1} stroke={C.n4} strokeWidth={0.6} />
      {edges.map(([a, b, c, d], i) => (
        <line key={i} x1={a} y1={b} x2={c} y2={d} stroke={lit ? C.g5 : C.n5} strokeWidth={0.6} opacity={0.7} />
      ))}
      {nodes.map(([a, b], i) => (
        <circle key={i} cx={a} cy={b} r={3.4} fill={lit ? C.g4 : C.g6} className={i % 3 === 0 ? "bz-blink" : undefined} />
      ))}
    </g>
  );
}
function AiBackground({ ctx }: { ctx: SceneCtx }) {
  return (
    <Room ctx={ctx} floor={[C.n2, C.n1]} wainscot={null}>
      <WindowR gx0={6.4} gx1={8.8} z0={30} z1={82} bars={2} city />
      <DoorL />
      <NeuralWall lit={ctx.ok.has("ai-neon")} />
      <Desk gx={6.6} gy={1.9} monitors={0} />
      <Tile gx={5.2} gy={3.3} w={3.4} d={3.3} fill={C.g2} />
      <WallText at={P(0, 2.2, 82)} side="L" size={6.5} fill={C.n6} spacing={1.4}>
        AI LAB
      </WallText>
    </Room>
  );
}
function Rack({ gx, gy, h = 56 }: { gx: number; gy: number; h?: number }) {
  return (
    <g>
      <Shadow gx={gx + 0.4} gy={gy + 0.4} rx={14} ry={6} />
      <Box gx={gx} gy={gy} w={0.75} d={0.65} h={h} top={C.ink3} left={C.ink2} right={C.ink} />
      {Array.from({ length: Math.floor(h / 10) }, (_, i) => 6 + i * 10).map((z, i) => (
        <g key={z}>
          <polygon points={pts(P(gx + 0.06, gy + 0.65, z), P(gx + 0.69, gy + 0.65, z), P(gx + 0.69, gy + 0.65, z + 6), P(gx + 0.06, gy + 0.65, z + 6))} fill={C.ink} />
          <polygon points={pts(P(gx + 0.1, gy + 0.65, z + 2.5), P(gx + 0.6, gy + 0.65, z + 2.5), P(gx + 0.6, gy + 0.65, z + 3.5), P(gx + 0.1, gy + 0.65, z + 3.5))} fill={C.g5} className={`bz-led d${i % 3}`} />
        </g>
      ))}
    </g>
  );
}
const aiSprites: SpriteDef[] = [
  {
    match: ["gpu", "ai-backend", "cluster"],
    slots: [{ gx: 0.3, gy: 0.3 }, { gx: 0.3, gy: 1.2 }, { gx: 0.3, gy: 2.1 }],
    layer: "back",
    draw: (s) => <Rack gx={s.gx} gy={s.gy} />,
  },
  {
    match: ["starter"],
    slots: [{ gx: 6.6, gy: 1.9, w: 1.3, d: 0.75 }],
    layer: "back",
    draw: (s) => <Desk gx={s.gx} gy={s.gy} laptop />,
  },
  {
    match: ["dataset"],
    slots: [{ gx: 1.3, gy: 0.3 }],
    layer: "back",
    draw: (s) => (
      <g>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} gx={s.gx} gy={s.gy} w={0.6} d={0.45} h={5} z={i * 5.4} top={C.g3} left={i % 2 ? C.g6 : C.g7} right={C.g8} />
        ))}
      </g>
    ),
  },
];
export const aiArt: Art = {
  key: "ai",
  visitors: "клиенты",
  Background: ({ ctx }) => <AiBackground ctx={ctx} />,
  Fixtures: () => (
    <g>
      <OfficeFixtures />
      <Lamp gx={4.3} gy={2.0} z={70} />
    </g>
  ),
  sprites: [...aiSprites, ...officeSprites.filter((d) => !Array.isArray(d.match)), ...rewardSprites(OFFICE_REWARDS)],
  extraSlots: DEFAULT_EXTRA,
  hints: { ...officeHints, screen: [3.3, 4.2].map((gy) => ({ gx: 0, gy, wall: "L" as const, d: 0.8, z: 50 })), wall: [5.6].map((gx) => ({ gx, gy: 0, wall: "R" as const, w: 0.7, z: 74 })) },
  flow: { ...officeFlow, orderIcons: ["chat", "doc", "laptop"] },
};

