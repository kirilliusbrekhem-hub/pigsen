// Isometric primitives for the /biz diorama. Grid units → screen px. Brand palette only: greens, inks, neutrals.
import type { ReactNode } from "react";

export const T = 18; // half tile width
export const H = 9; // half tile height
export const OX = 178;
export const OY = 112;
export const WH = 92; // wall height
export const ROOM = { w: 9, d: 7 };
export const VIEW = { w: 400, h: 320 };

export const C = {
  ink: "#0E1512",
  ink2: "#1B2621",
  ink3: "#2C3832",
  g9: "#0B3D2A",
  g8: "#0E5A3D",
  g7: "#0E7A52",
  g6: "#1F9465",
  g5: "#3FBD88",
  g4: "#7FD3AE",
  g3: "#B5E3CC",
  g2: "#DDF1E6",
  g1: "#EEF8F2",
  w: "#FFFFFF",
  n1: "#F7F6F2",
  n2: "#EEEDE7",
  n3: "#E2E0D8",
  n4: "#CFCCC2",
  n5: "#A9A69C",
  n6: "#77756D",
  skin: "#EFE5DA",
  skin2: "#D8CBBD",
} as const;

export type Pt = [number, number];
export const P = (gx: number, gy: number, z = 0): Pt => [OX + (gx - gy) * T, OY + (gx + gy) * H - z];
export const pts = (...p: Pt[]) => p.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ");
export const tf = (gx: number, gy: number, z = 0) => {
  const [x, y] = P(gx, gy, z);
  return `translate(${x.toFixed(1)} ${y.toFixed(1)})`;
};

/** Axis-aligned iso box: occupies gx..gx+w, gy..gy+d, z..z+h. Faces: top, left (front-left), right (front-right). */
export function Box({ gx, gy, w, d, h, z = 0, top, left, right, stroke, className }: { gx: number; gy: number; w: number; d: number; h: number; z?: number; top: string; left: string; right: string; stroke?: string; className?: string }) {
  const zt = z + h;
  return (
    <g className={className} stroke={stroke ?? "none"} strokeWidth={stroke ? 0.6 : 0} strokeLinejoin="round">
      <polygon points={pts(P(gx, gy + d, zt), P(gx + w, gy + d, zt), P(gx + w, gy + d, z), P(gx, gy + d, z))} fill={left} />
      <polygon points={pts(P(gx + w, gy, zt), P(gx + w, gy + d, zt), P(gx + w, gy + d, z), P(gx + w, gy, z))} fill={right} />
      <polygon points={pts(P(gx, gy, zt), P(gx + w, gy, zt), P(gx + w, gy + d, zt), P(gx, gy + d, zt))} fill={top} />
    </g>
  );
}

/** Soft contact shadow on the floor. */
export const Shadow = ({ gx, gy, rx = 14, ry = 6, o = 0.18 }: { gx: number; gy: number; rx?: number; ry?: number; o?: number }) => {
  const [x, y] = P(gx, gy);
  return <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={C.ink} opacity={o} />;
};

/** Quad on the back-right wall (gy = 0 plane). */
export const WallR = ({ gx0, gx1, z0, z1, fill, gy = 0, ...rest }: { gx0: number; gx1: number; z0: number; z1: number; fill: string; gy?: number; opacity?: number; className?: string }) => (
  <polygon points={pts(P(gx0, gy, z0), P(gx1, gy, z0), P(gx1, gy, z1), P(gx0, gy, z1))} fill={fill} {...rest} />
);
/** Quad on the back-left wall (gx = 0 plane). */
export const WallL = ({ gy0, gy1, z0, z1, fill, gx = 0, ...rest }: { gy0: number; gy1: number; z0: number; z1: number; fill: string; gx?: number; opacity?: number; className?: string }) => (
  <polygon points={pts(P(gx, gy0, z0), P(gx, gy1, z0), P(gx, gy1, z1), P(gx, gy0, z1))} fill={fill} {...rest} />
);
/** Floor diamond. */
export const Tile = ({ gx, gy, w = 1, d = 1, fill, z = 0, ...rest }: { gx: number; gy: number; w?: number; d?: number; fill: string; z?: number; opacity?: number; className?: string; stroke?: string; strokeDasharray?: string; strokeWidth?: number }) => (
  <polygon points={pts(P(gx, gy, z), P(gx + w, gy, z), P(gx + w, gy + d, z), P(gx, gy + d, z))} fill={fill} {...rest} />
);

/** Text lying on a wall plane. side R: along +gx; side L: along −gy (reads left→right). */
export const WallText = ({ at, side, children, size = 10, fill = C.w, weight = 700, className, spacing }: { at: Pt; side: "L" | "R"; children: ReactNode; size?: number; fill?: string; weight?: number; className?: string; spacing?: number }) => (
  <text
    transform={`matrix(1 ${side === "R" ? 0.5 : -0.5} 0 1 ${at[0].toFixed(1)} ${at[1].toFixed(1)})`}
    textAnchor="middle"
    fontSize={size}
    fontWeight={weight}
    fill={fill}
    letterSpacing={spacing}
    className={className}
    style={{ fontFamily: "var(--font-sans, system-ui)" }}
  >
    {children}
  </text>
);

export interface PersonLook {
  body: string;
  hair: string;
  legs: string;
  accent?: string;
}
export const LOOKS: PersonLook[] = [
  { body: C.g6, hair: C.ink, legs: C.ink3 },
  { body: C.n1, hair: C.ink2, legs: C.g9 },
  { body: C.ink3, hair: C.n6, legs: C.ink },
  { body: C.g4, hair: C.ink2, legs: C.ink3 },
  { body: C.g8, hair: C.ink, legs: C.n6 },
  { body: C.n4, hair: C.ink3, legs: C.g8 },
  { body: C.g3, hair: C.g9, legs: C.ink2 },
];

/** A small character, feet at (0,0), ~30px tall. Legs/arms animate via CSS when an ancestor has .is-walk. */
export function Person({ look, apron, hat, children }: { look: PersonLook; apron?: string; hat?: string; children?: ReactNode }) {
  return (
    <g className="bz-p">
      <ellipse cx={0} cy={0} rx={7} ry={2.6} fill={C.ink} opacity={0.2} />
      <g className="bz-legs">
        <rect className="bz-leg l" x={-3.6} y={-10} width={3} height={10} rx={1.5} fill={look.legs} />
        <rect className="bz-leg r" x={0.6} y={-10} width={3} height={10} rx={1.5} fill={look.legs} />
      </g>
      <g className="bz-torso">
        <path d="M-6 -9 v-8 a6 6 0 0 1 12 0 v8 q0 1.6 -1.6 1.6 h-8.8 q-1.6 0 -1.6 -1.6 Z" fill={look.body} />
        <path d="M-6 -12 v-5 a6 6 0 0 1 3 -5.2 v10.2 Z" fill={C.w} opacity={0.18} />
        {apron && <path d="M-3.6 -18 h7.2 v9.6 h-7.2 Z" fill={apron} />}
        <rect className="bz-arm l" x={-8} y={-19} width={2.6} height={9} rx={1.3} fill={look.body} />
        <rect className="bz-arm r" x={5.4} y={-19} width={2.6} height={9} rx={1.3} fill={look.body} />
        <circle cx={0} cy={-27} r={5.4} fill={C.skin} />
        <path d="M-5.4 -27.5 a5.4 5.4 0 0 1 10.8 0 q-2.5 -2.6 -5.4 -2.4 q-3.3 0 -5.4 2.4 Z" fill={look.hair} />
        <circle cx={1.6} cy={-26.6} r={0.8} fill={C.ink} />
        {hat && <path d="M-5.6 -30 h11.2 l-1.2 -4 h-8.8 Z" fill={hat} />}
      </g>
      {children}
    </g>
  );
}

/** Generic sprite for any item the art doesn't know yet: an iso crate with the item's initial. */
export function GenericTile({ gx, gy, title, reward }: { gx: number; gy: number; title: string; reward?: boolean }) {
  const [x, y] = P(gx + 0.4, gy + 0.4, 30);
  const letter = (title.trim()[0] ?? "?").toUpperCase();
  return (
    <g>
      <Shadow gx={gx + 0.4} gy={gy + 0.4} rx={16} ry={7} />
      <Box gx={gx} gy={gy} w={0.8} d={0.8} h={8} top={C.n2} left={C.n4} right={C.n5} />
      <Box gx={gx + 0.12} gy={gy + 0.12} w={0.56} d={0.56} h={14} z={8} top={reward ? C.g5 : C.g4} left={reward ? C.g7 : C.g6} right={reward ? C.g8 : C.g7} />
      <circle cx={x} cy={y - 6} r={8} fill={C.w} stroke={C.g7} strokeWidth={1.2} />
      <text x={x} y={y - 2.6} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={C.g8} style={{ fontFamily: "var(--font-sans, system-ui)" }}>
        {letter}
      </text>
      {reward && <RewardBadge x={x + 8} y={y - 13} />}
    </g>
  );
}

/** Tiny star medallion marking a challenge reward. */
export const RewardBadge = ({ x, y }: { x: number; y: number }) => (
  <g className="bz-badge" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
    <circle r={5.2} fill={C.ink} stroke={C.g5} strokeWidth={1.2} />
    <path d="M0 -3 l0.9 1.9 2 .2 -1.5 1.4 .4 2 -1.8 -1 -1.8 1 .4 -2 -1.5 -1.4 2 -.2 Z" fill={C.g4} />
  </g>
);

/** Repair state overlay: striped tape + traffic cone. */
export function RepairMark({ gx, gy, z = 0 }: { gx: number; gy: number; z?: number }) {
  const [x, y] = P(gx, gy, z);
  return (
    <g className="bz-repair" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <g transform="rotate(-18)">
        <rect x={-18} y={-22} width={36} height={6} rx={1} fill={C.ink} />
        {[-14, -6, 2, 10].map((s) => (
          <path key={s} d={`M${s} -22 h4 l-3 6 h-4 Z`} fill={C.g4} />
        ))}
      </g>
      <g transform="translate(14 4)">
        <ellipse cx={0} cy={0} rx={6} ry={2.4} fill={C.ink} opacity={0.25} />
        <path d="M-5 0 h10 l-3.4 -14 h-3.2 Z" fill={C.g5} />
        <path d="M-3.9 -4.5 h7.8 l-0.6 -2.6 h-6.6 Z" fill={C.w} />
        <rect x={-6} y={-1.2} width={12} height={2} rx={1} fill={C.ink} />
      </g>
    </g>
  );
}
