// Барбершоп и онлайн-магазин: simpler rooms with keyword-matched sprites + generic fallback.
import { Box, C, LOOKS, P, Shadow, Tile, WallL, WallR, WallText, pts, type Pt } from "./iso";
import { Chair, DEFAULT_EXTRA, DoorL, Plant, Room, Staff, WindowL, WindowR } from "./room";
import { DEFAULT_REWARDS, isReward, rewardSprites } from "./generic";
import type { Art, SpriteDef } from "./types";


// ── Барбершоп ──
function BarberChair({ gx, gy, gold }: { gx: number; gy: number; gold?: boolean }) {
  return (
    <g>
      <Shadow gx={gx + 0.35} gy={gy + 0.35} rx={14} ry={6} />
      <Box gx={gx + 0.28} gy={gy + 0.28} w={0.14} d={0.14} h={10} top={C.n4} left="url(#bz-metal)" right={C.n5} />
      <Box gx={gx} gy={gy} w={0.7} d={0.7} h={5} z={10} top={gold ? C.g5 : C.ink3} left={gold ? C.g7 : C.ink2} right={gold ? C.g8 : C.ink} />
      <Box gx={gx} gy={gy} w={0.7} d={0.18} h={18} z={14} top={gold ? C.g5 : C.ink3} left={gold ? C.g7 : C.ink2} right={gold ? C.g8 : C.ink} />
      <Box gx={gx} gy={gy + 0.1} w={0.12} d={0.6} h={4} z={15} top={C.g5} left={C.g7} right={C.g8} />
      <Box gx={gx + 0.58} gy={gy + 0.1} w={0.12} d={0.6} h={4} z={15} top={C.g5} left={C.g7} right={C.g8} />
    </g>
  );
}
const STATIONS: Pt[] = [
  [2.6, 0.9],
  [4.4, 0.9],
  [6.2, 0.9],
];
const barberSprites: SpriteDef[] = [
  {
    match: ["mirror"],
    slots: [{ gx: 2.5, gy: 0, wall: "R", w: 4.6 }],
    layer: "back",
    draw: () => (
      <g>
        {STATIONS.map(([gx]) => (
          <g key={gx}>
            <WallR gx0={gx - 0.15} gx1={gx + 0.95} z0={30} z1={74} fill={C.ink} />
            <WallR gx0={gx - 0.08} gx1={gx + 0.88} z0={33} z1={71} fill="url(#bz-sky)" />
            <WallR gx0={gx - 0.08} gx1={gx + 0.88} z0={33} z1={71} fill="url(#bz-glass)" opacity={0.8} />
            <WallR gx0={gx - 0.08} gx1={gx + 0.88} z0={71} z1={73} fill={C.g4} className="bz-neon-strip" />
            <Box gx={gx - 0.1} gy={0} w={1} d={0.35} h={3} z={26} top={C.n1} left={C.n4} right={C.n5} />
          </g>
        ))}
      </g>
    ),
  },
  {
    match: (id) => !isReward(id) && /chair|кресл/.test(id),
    slots: STATIONS.map(([gx, gy]) => ({ gx, gy })),
    layer: "back",
    draw: (s, _c, id) => <BarberChair gx={s.gx} gy={s.gy} gold={id === "gold-chair"} />,
    seats: (s) => [[s.gx + 0.35, s.gy + 0.4]],
  },
  {
    match: ["barber", "barber-academy"],
    slots: STATIONS.map(([gx, gy]) => ({ gx: gx + 1.0, gy: gy + 0.6 })),
    layer: "back",
    draw: (s, _c, _id, n) => <Staff gx={s.gx} gy={s.gy} look={LOOKS[(n + 2) % LOOKS.length]} apron={C.ink} className="bz-cut" />,
  },
  {
    match: ["sofa"],
    slots: [{ gx: 6.2, gy: 5.8, w: 1.6, d: 0.7 }],
    layer: "front",
    draw: (s) => (
      <g>
        <Shadow gx={s.gx + 0.8} gy={s.gy + 0.4} rx={30} ry={10} />
        <Box gx={s.gx} gy={s.gy} w={1.6} d={0.7} h={10} top={C.ink3} left={C.ink2} right={C.ink} />
        <Box gx={s.gx} gy={s.gy} w={1.6} d={0.2} h={10} z={10} top={C.ink3} left={C.ink2} right={C.ink} />
      </g>
    ),
  },
  {
    match: ["barber-neon"],
    slots: [{ gx: 0, gy: 0.9, wall: "L", d: 1.4 }],
    layer: "back",
    draw: () => (
      <WallText at={P(0, 1.5, 78)} side="L" size={11} weight={800} className="bz-neon-text" spacing={2}>
        FADE
      </WallText>
    ),
  },
  {
    match: ["barber-sign"],
    slots: [{ gx: 0, gy: 4.0, wall: "L" }],
    layer: "back",
    draw: () => (
      <g>
        <WallL gy0={4.1} gy1={4.4} z0={30} z1={74} fill={C.ink} />
        {[0, 1, 2, 3, 4].map((i) => (
          <WallL key={i} gy0={4.12} gy1={4.38} z0={32 + i * 8} z1={36 + i * 8} fill={i % 2 ? C.w : C.g6} className="bz-pole" />
        ))}
        <WallText at={P(0, 3.2, 80)} side="L" size={10} weight={800} fill={C.ink} spacing={1.5}>
          BARBER
        </WallText>
      </g>
    ),
  },
  {
    match: ["cosmetics"],
    slots: [{ gx: 8.3, gy: 1.2 }],
    layer: "back",
    draw: (s) => (
      <g>
        <Box gx={s.gx} gy={s.gy} w={0.5} d={1.4} h={48} top={C.ink3} left={C.ink2} right={C.ink} />
        {[12, 26, 40].map((z) =>
          [0.25, 0.6, 0.95, 1.25].map((o, i) => {
            const [x, y] = P(s.gx + 0.5, s.gy + o, z);
            return <rect key={`${z}${o}`} x={x - 2} y={y - 7} width={4} height={7} rx={1} fill={i % 2 ? C.g5 : C.n1} />;
          }),
        )}
      </g>
    ),
  },
];

// ── Онлайн-магазин: warehouse / pickup point ──
function Shelf({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <Shadow gx={gx + 0.7} gy={gy + 0.3} rx={26} ry={8} o={0.14} />
      {[0, 1.3].map((o) => (
        <Box key={o} gx={gx + o} gy={gy} w={0.08} d={0.55} h={56} top={C.ink} left={C.ink2} right={C.ink} />
      ))}
      {[4, 22, 40].map((z, r) => (
        <g key={z}>
          <Box gx={gx} gy={gy} w={1.38} d={0.55} h={2} z={z} top={C.n4} left={C.n5} right={C.n6} />
          {[0.1, 0.55, 0.95].map((o, i) =>
            (r + i) % 3 !== 2 ? <Box key={o} gx={gx + o} gy={gy + 0.08} w={0.36} d={0.4} h={12} z={z + 2} top={C.n1} left={(r + i) % 2 ? C.n3 : C.g3} right={(r + i) % 2 ? C.n4 : C.g4} /> : null,
          )}
        </g>
      ))}
    </g>
  );
}
const shopSprites: SpriteDef[] = [
  {
    match: ["stock", "warehouse"],
    slots: [{ gx: 2.6, gy: 0.2, w: 3 }, { gx: 6.0, gy: 0.2, w: 3 }],
    layer: "back",
    draw: (s) => (
      <g>
        <Shelf gx={s.gx} gy={s.gy} />
        <Shelf gx={s.gx + 1.7} gy={s.gy} />
      </g>
    ),
  },
  {
    match: ["packaging"],
    slots: [{ gx: 5.6, gy: 3.6, w: 1.6, d: 0.8 }],
    layer: "front",
    draw: (s) => (
      <g>
        <Shadow gx={s.gx + 0.8} gy={s.gy + 0.4} rx={30} ry={10} />
        <Box gx={s.gx} gy={s.gy} w={1.6} d={0.8} h={20} top={C.n1} left={C.n4} right={C.n5} />
        <Box gx={s.gx + 0.2} gy={s.gy + 0.15} w={0.5} d={0.45} h={9} z={20} top={C.g3} left={C.g4} right={C.g5} />
        <Box gx={s.gx + 0.9} gy={s.gy + 0.2} w={0.4} d={0.35} h={6} z={20} top={C.n2} left={C.n3} right={C.n4} />
      </g>
    ),
  },
  {
    match: ["shop-courier"],
    slots: [{ gx: 4.5, gy: 7.4, w: 2, d: 1 }],
    layer: "front",
    draw: (s) => (
      <g className="bz-scooter">
        <Shadow gx={s.gx + 1} gy={s.gy + 0.6} rx={40} ry={12} />
        <Box gx={s.gx} gy={s.gy} w={1.4} d={0.9} h={30} z={6} top={C.n1} left={C.n3} right={C.n4} />
        <Box gx={s.gx + 1.4} gy={s.gy} w={0.6} d={0.9} h={20} z={6} top={C.g5} left={C.g6} right={C.g7} />
        <polygon points={pts(P(s.gx + 2, s.gy + 0.15, 22), P(s.gx + 2, s.gy + 0.75, 22), P(s.gx + 2, s.gy + 0.75, 14), P(s.gx + 2, s.gy + 0.15, 14))} fill={C.ink3} />
        <polygon points={pts(P(s.gx + 0.2, s.gy + 0.9, 28), P(s.gx + 1.2, s.gy + 0.9, 28), P(s.gx + 1.2, s.gy + 0.9, 18), P(s.gx + 0.2, s.gy + 0.9, 18))} fill={C.g7} />
        {[[0.3, 0.9], [1.6, 0.9]].map(([a, b]) => {
          const [x, y] = P(s.gx + a, s.gy + b, 4);
          return <circle key={a} cx={x} cy={y} r={5} fill={C.ink} />;
        })}
      </g>
    ),
  },
  {
    match: ["manager"],
    slots: [{ gx: 6.4, gy: 3.2 }],
    layer: "back",
    draw: (s, _c, _id, n) => <Staff gx={s.gx} gy={s.gy} look={LOOKS[(n + 1) % LOOKS.length]} apron={C.g7} className={n ? "bz-route" : "bz-cut"} />,
  },
];

function SimpleFixtures({ tone }: { tone: "barber" | "shop" }) {
  return (
    <g>
      <Staff gx={1.85} gy={2.75} look={LOOKS[tone === "shop" ? 4 : 2]} apron={tone === "shop" ? C.g7 : C.ink} className="bz-idle" />
      <Shadow gx={1.9} gy={3.6} rx={34} ry={10} o={0.12} />
      <Box gx={1.0} gy={3.2} w={1.8} d={0.6} h={24} top={C.n1} left={C.ink2} right={C.ink} />
      <polygon points={pts(P(1.0, 3.8, 20), P(2.8, 3.8, 20), P(2.8, 3.8, 18), P(1.0, 3.8, 18))} fill={C.g5} />
      {tone === "shop" && <Box gx={2.1} gy={3.25} w={0.5} d={0.45} h={10} z={24} top={C.g3} left={C.g4} right={C.g5} />}
    </g>
  );
}

const counterFlow = {
  door: [0.15, 5.7] as Pt,
  inside: [1.2, 5.75] as Pt,
  queueHead: [1.9, 4.45] as Pt,
  queueStep: [0.7, 0.45] as Pt,
  pickup: [3.3, 4.05] as Pt,
  done: "mood" as const,
};

export const barberArt: Art = {
  key: "barber",
  visitors: "клиенты",
  Background: ({ ctx }) => (
    <Room ctx={ctx} floor={[C.n4, C.n2]} wallTone={[C.n1, C.n2]} wainscot={ctx.has.has("barber-renovation") ? C.ink2 : null}>
      <WindowL gy0={0.9} gy1={3.0} z0={34} z1={70} />
      <DoorL />
      <Plant gx={8.5} gy={3.2} />
    </Room>
  ),
  Fixtures: () => <SimpleFixtures tone="barber" />,
  sprites: [...barberSprites, ...rewardSprites({ ...DEFAULT_REWARDS, neon: [{ gx: 7.3, gy: 0, wall: "R", w: 1.5, z: 86 }] })],
  extraSlots: DEFAULT_EXTRA,
  hints: {
    counter: [{ gx: 2.7, gy: 0.05, z: 29 }, { gx: 4.5, gy: 0.05, z: 29 }, { gx: 6.3, gy: 0.05, z: 29 }, { gx: 1.3, gy: 3.3, z: 24 }],
    screen: [{ gx: 0, gy: 3.3, wall: "L", d: 0.8, z: 52 }, { gx: 0.05, gy: 0, wall: "R", w: 0.8, z: 56 }],
    wall: [{ gx: 7.3, gy: 0, wall: "R", w: 0.8, z: 74 }, { gx: 8.1, gy: 0, wall: "R", w: 0.8, z: 74 }],
    annex: [{ gx: 9.6, gy: 0.4 }, { gx: 9.6, gy: 2.6 }],
    staff: [{ gx: 7.2, gy: 1.6 }],
    street: [{ gx: 6.2, gy: 7.6 }],
    cloud: [{ gx: 4.5, gy: 3.5, z: 150 }],
  },
  flow: { ...counterFlow, orderIcons: ["scissors"], carry: null, fast: (ok) => 1 + 0.3 * [...ok].filter((i) => /barber|master|staff|мастер/.test(i)).length, baseSeats: [] },
};

export const shopArt: Art = {
  key: "shop",
  visitors: "покупатели",
  Background: ({ ctx }) => (
    <Room ctx={ctx} floor={[C.n3, C.n2]}>
      <WindowR gx0={2.4} gx1={8.6} z0={60} z1={84} bars={5} />
      <DoorL />
      <Tile gx={4.4} gy={2.8} w={3.6} d={0.12} fill={C.g5} />
      <Tile gx={4.4} gy={5.4} w={3.6} d={0.12} fill={C.g5} />
      <Chair gx={0.4} gy={0.8} />
    </Room>
  ),
  Fixtures: () => <SimpleFixtures tone="shop" />,
  sprites: [...shopSprites, ...rewardSprites({ ...DEFAULT_REWARDS, frames: [{ gx: 0, gy: 4.5, wall: "L", d: 0.6, z: 82 }, { gx: 0, gy: 0.2, wall: "L", d: 0.6, z: 82 }] })],
  extraSlots: DEFAULT_EXTRA,
  hints: {
    screen: [0.5, 1.6, 2.7, 3.8].flatMap((gy) => [{ gx: 0, gy, wall: "L" as const, d: 0.9, z: 46 }, { gx: 0, gy, wall: "L" as const, d: 0.9, z: 70 }]),
    counter: [{ gx: 1.3, gy: 3.3, z: 24 }, { gx: 5.9, gy: 3.75, z: 20 }],
    annex: [{ gx: 9.6, gy: 0.4 }, { gx: 9.6, gy: 2.6 }],
    staff: [{ gx: 3.6, gy: 1.4 }],
    cloud: [{ gx: 1.5, gy: 4, z: 138 }, { gx: 5.5, gy: 1, z: 138 }],
    street: [{ gx: 7.4, gy: 7.6 }],
    floor: [{ gx: 7.6, gy: 4.6 }, { gx: 4.2, gy: 6.3 }, { gx: 7.6, gy: 6.0 }],
  },
  flow: { ...counterFlow, orderIcons: ["box", "bag", "laptop"], carry: "box", fast: (ok) => 1 + 0.3 * [...ok].filter((i) => /staff|packer|manager|operator/.test(i)).length },
};
