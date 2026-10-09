// IT businesses (веб-студия, мобильное приложение, SaaS): an open-space office. Item ids are matched by keyword
// so the art keeps up with the catalog; anything unmatched falls back to a generic tile.
import { Box, C, LOOKS, P, Shadow, Tile, WallL, WallR, WallText, pts, type Pt } from "./iso";
import { Chair, DEFAULT_EXTRA, Desk, DoorL, Lamp, Plant, Room, Staff, WindowR, Worker } from "./room";
import { DEFAULT_REWARDS, isReward, rewardSprites, type RewardPlaces } from "./generic";
import type { Art, SceneCtx, Slot, SpriteDef } from "./types";

const has = (re: RegExp) => (id: string) => !isReward(id) && re.test(id);

function OfficeBackground({ ctx, variant }: { ctx: SceneCtx; variant: string }) {
  return (
    <Room ctx={ctx} floor={[C.n3, C.n2]} wainscot={null}>
      <WindowR gx0={0.5} gx1={5.6} z0={30} z1={82} bars={4} city />
      <DoorL />
      <Desk gx={6.6} gy={1.9} monitors={0} />
      {/* carpet zone */}
      <Tile gx={5.2} gy={3.3} w={3.4} d={3.3} fill={C.g2} />
      <Tile gx={5.35} gy={3.45} w={3.1} d={3.0} fill={C.g3} opacity={0.6} />
      <WallText at={P(0, 2.2, 82)} side="L" size={6.5} fill={C.n6} spacing={1.4}>
        {variant}
      </WallText>
    </Room>
  );
}

function OfficeFixtures() {
  return (
    <g>
      <Worker gx={7.3} gy={3.05} look={LOOKS[4]} />
      <Staff gx={1.85} gy={2.75} look={LOOKS[2]} className="bz-idle" />
      <Shadow gx={1.9} gy={3.6} rx={34} ry={10} o={0.12} />
      <Box gx={1.0} gy={3.2} w={1.8} d={0.6} h={24} top={C.n1} left={C.ink2} right={C.ink} />
      <polygon points={pts(P(1.0, 3.8, 20), P(2.8, 3.8, 20), P(2.8, 3.8, 18), P(1.0, 3.8, 18))} fill={C.g5} />
      <Box gx={1.25} gy={3.3} w={0.5} d={0.3} h={1} z={24} top={C.n5} left={C.n6} right={C.ink3} />
      <polygon className="bz-screen" points={pts(P(1.3, 3.3, 25), P(1.7, 3.3, 25), P(1.7, 3.3, 33), P(1.3, 3.3, 33))} />
    </g>
  );
}

const TEAM: Pt[] = [
  [3.4, 1.9],
  [5.0, 1.9],
  [2.9, 0.3],
  [4.5, 0.3],
  [6.1, 0.3],
  [1.2, 0.3],
  [1.5, 1.9],
];
const MEET: Pt = [5.8, 4.3];

function Sofa({ gx, gy }: { gx: number; gy: number }) {
  return (
    <g>
      <Shadow gx={gx + 0.8} gy={gy + 0.4} rx={30} ry={10} />
      <Box gx={gx} gy={gy} w={1.6} d={0.7} h={10} top={C.g6} left={C.g8} right={C.g9} />
      <Box gx={gx} gy={gy} w={1.6} d={0.2} h={10} z={10} top={C.g5} left={C.g7} right={C.g8} />
      <Box gx={gx + 0.2} gy={gy + 0.25} w={0.4} d={0.35} h={3} z={10} top={C.g3} left={C.g5} right={C.g6} />
    </g>
  );
}

const officeSprites: SpriteDef[] = [
  {
    match: ["laptops", "app-laptops", "saas-laptops"],
    slots: [{ gx: 6.6, gy: 1.9, w: 1.3, d: 0.75 }],
    layer: "back",
    draw: (s) => <Desk gx={s.gx} gy={s.gy} laptop />,
  },
  {
    match: ["dark-office"],
    slots: [{ gx: 5.9, gy: 0, wall: "R", w: 2.9 }],
    layer: "back",
    draw: () => (
      <g className="bz-neon-on">
        <WallR gx0={0} gx1={9} z0={87} z1={89} fill={C.g4} className="bz-neon-strip" />
        <WallL gy0={0} gy1={7} z0={87} z1={89} fill={C.g4} className="bz-neon-strip" />
        <WallR gx0={0} gx1={9} z0={4} z1={5.5} fill={C.g5} className="bz-neon-strip" />
        <WallL gy0={0} gy1={7} z0={4} z1={5.5} fill={C.g5} className="bz-neon-strip" />
      </g>
    ),
  },
  {
    match: has(/server|cloud|hosting|devops|infra|сервер|backup|database|^db|gpu|cluster/),
    slots: [{ gx: 7.9, gy: 0.25 }, { gx: 8.3, gy: 1.3 }],
    layer: "back",
    draw: (s) => (
      <g>
        <Shadow gx={s.gx + 0.4} gy={s.gy + 0.4} rx={14} ry={6} />
        <Box gx={s.gx} gy={s.gy} w={0.75} d={0.65} h={56} top={C.ink3} left={C.ink2} right={C.ink} />
        {[8, 18, 28, 38, 48].map((z, i) => (
          <g key={z}>
            <polygon points={pts(P(s.gx + 0.06, s.gy + 0.65, z), P(s.gx + 0.69, s.gy + 0.65, z), P(s.gx + 0.69, s.gy + 0.65, z + 6), P(s.gx + 0.06, s.gy + 0.65, z + 6))} fill={C.ink} />
            {[0.15, 0.25].map((o, j) => {
              const [x, y] = P(s.gx + o, s.gy + 0.65, z + 3);
              return <circle key={o} cx={x} cy={y} r={1.1} fill={(i + j) % 3 ? C.g5 : C.g3} className={`bz-led d${(i + j) % 3}`} />;
            })}
          </g>
        ))}
      </g>
    ),
  },
  {
    match: (id) => ["office", "app-office", "saas-office"].includes(id) || has(/meet|conference|переговор/)(id),
    slots: [{ gx: MEET[0], gy: MEET[1], w: 1.8, d: 1 }],
    layer: "front",
    draw: () => (
      <g>
        <Sofa gx={6.3} gy={6.0} />
        <Chair gx={MEET[0] + 0.2} gy={MEET[1] - 0.7} />
        <Chair gx={MEET[0] + 1.1} gy={MEET[1] - 0.7} />
        <Chair gx={MEET[0] - 0.7} gy={MEET[1] + 0.25} />
        <Shadow gx={MEET[0] + 0.9} gy={MEET[1] + 0.5} rx={34} ry={12} o={0.14} />
        <Box gx={MEET[0] + 0.85} gy={MEET[1] + 0.4} w={0.12} d={0.12} h={20} top={C.ink} left={C.ink2} right={C.ink} />
        <Box gx={MEET[0]} gy={MEET[1]} w={1.8} d={1.0} h={2.5} z={20} top={C.w} left={C.n4} right={C.n5} />
        <Box gx={MEET[0] + 0.4} gy={MEET[1] + 0.3} w={0.4} d={0.3} h={1} z={22.5} top={C.n5} left={C.n6} right={C.ink3} />
        <Box gx={MEET[0] + 1.1} gy={MEET[1] + 0.5} w={0.3} d={0.4} h={0.6} z={22.5} top={C.g3} left={C.g5} right={C.g6} />
      </g>
    ),
    seats: () => [
      [MEET[0] + 0.46, MEET[1] - 0.44],
      [MEET[0] + 1.36, MEET[1] - 0.44],
      [MEET[0] - 0.44, MEET[1] + 0.51],
    ],
  },
  {
    match: has(/coffee|kitchen|snack|кофе|кухн|food|lunch|cooler/),
    slots: [{ gx: 0.25, gy: 0.3 }],
    layer: "back",
    draw: (s) => (
      <g>
        <Box gx={s.gx} gy={s.gy} w={0.7} d={1.2} h={22} top={C.n1} left={C.ink2} right={C.ink} />
        <Box gx={s.gx + 0.1} gy={s.gy + 0.2} w={0.45} d={0.4} h={14} z={22} top={C.n4} left="url(#bz-metal)" right={C.n5} />
        {(() => {
          const [x, y] = P(s.gx + 0.3, s.gy + 0.6, 40);
          return <path className="bz-steam" d={`M${x} ${y} q-4 -6 0 -12`} />;
        })()}
      </g>
    ),
  },
  {
    match: has(/plant|green|растен|flower/),
    slots: [{ gx: 8.3, gy: 2.6 }, { gx: 0.4, gy: 4.3 }],
    layer: "back",
    draw: (s) => <Plant gx={s.gx + 0.3} gy={s.gy + 0.3} big />,
  },
  {
    match: has(/lamp|light|свет|renov|ремонт|interior/),
    slots: [{ gx: 4.0, gy: 1.4 }],
    layer: "front",
    draw: () => (
      <g>
        <Lamp gx={3.9} gy={1.6} z={70} />
        <Lamp gx={5.6} gy={1.6} z={70} />
        <Lamp gx={6.7} gy={4.8} z={74} />
      </g>
    ),
  },
];

const officeFlow = {
  door: [0.15, 5.7] as Pt,
  inside: [1.2, 5.75] as Pt,
  queueHead: [1.9, 4.45] as Pt,
  queueStep: [0.7, 0.45] as Pt,
  pickup: [3.3, 4.05] as Pt,
  orderIcons: ["laptop", "doc", "chat", "app"] as Art["flow"]["orderIcons"],
  done: "check" as const,
  carry: null,
  fast: (ok: Set<string>) => 1 + 0.25 * Math.min(4, [...ok].filter((i) => /dev|design|manag|sales|pm|team|hire|lead/.test(i)).length),
};

const OFFICE_REWARDS: RewardPlaces = { ...DEFAULT_REWARDS, floor: [{ gx: 4.0, gy: 6.3 }, { gx: 8.4, gy: 3.9 }, { gx: 2.6, gy: 6.4 }, { gx: 5.0, gy: 6.4 }], frames: [{ gx: 6.1, gy: 0, wall: "R", w: 0.7, z: 52 }, { gx: 6.9, gy: 0, wall: "R", w: 0.7, z: 52 }, { gx: 0, gy: 4.5, wall: "L", d: 0.6, z: 82 }] as Slot[], neon: [{ gx: 3.0, gy: 0, wall: "R", w: 2, z: 88 }] };

export const officeArt = (variant: string): Art => ({
  key: "office",
  visitors: "клиенты",
  Background: ({ ctx }) => <OfficeBackground ctx={ctx} variant={variant} />,
  Fixtures: () => <OfficeFixtures />,
  sprites: [...officeSprites, ...rewardSprites(OFFICE_REWARDS)],
  extraSlots: DEFAULT_EXTRA,
  hints: {
    staff: TEAM.map(([gx, gy]) => ({ gx, gy, w: 1.3, d: 0.75, desk: true })),
    desk: [{ gx: 1.5, gy: 1.9, w: 1.3, d: 0.75 }],
    screen: [0.35, 1.45, 2.55, 3.65].flatMap((gy) => [{ gx: 0, gy, wall: "L" as const, d: 0.9, z: 48 }]).concat([0.35, 1.45, 2.55].map((gy) => ({ gx: 0, gy, wall: "L" as const, d: 0.9, z: 74 }))),
    wall: [6.1, 6.9, 7.7].map((gx) => ({ gx, gy: 0, wall: "R" as const, w: 0.7, z: 74 })),
    cloud: [[0, 6, 128], [1.5, 4, 138], [3.5, 2.5, 140], [5.5, 1, 138], [7.5, 0, 130], [9.5, -0.5, 120]].map(([gx, gy, z]) => ({ gx, gy, z })),
    annex: [{ gx: 9.6, gy: 0.4 }, { gx: 9.6, gy: 2.6 }, { gx: 9.6, gy: 4.8 }],
    counter: [{ gx: 2.2, gy: 3.3, z: 24 }, { gx: 7.4, gy: 2.0, z: 22.5 }],
    street: [{ gx: 6.2, gy: 7.6 }],
  },
  flow: officeFlow,
});

