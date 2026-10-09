// Line-art café that fills up as upgrades are bought. Brand: ink lines + green accent only.
// Each upgrade is its own layer; broken ones render dashed and faded with a "ремонт" tag.

interface Props {
  owned: { itemId: string; status: string }[];
  level: number;
  guests: number;
  name: string;
}

function Layer({ id, owned, children, tag }: { id: string; owned: Props["owned"]; children: React.ReactNode; tag?: [number, number] }) {
  const o = owned.find((x) => x.itemId === id);
  if (!o) return null;
  const broken = o.status !== "ok";
  return (
    <g className={`bz-item bz-${id}${broken ? " is-broken" : ""}`} data-item={id} data-broken={broken || undefined}>
      {children}
      {broken && tag && (
        <g className="bz-tag" transform={`translate(${tag[0]} ${tag[1]})`}>
          <rect x={-26} y={-11} width={52} height={18} rx={9} />
          <text x={0} y={2} textAnchor="middle">
            ремонт
          </text>
        </g>
      )}
    </g>
  );
}

export function BizScene({ owned, level, guests, name }: Props) {
  const people = Math.max(1, Math.min(7, Math.ceil(guests / 12)));
  const wide = level >= 2;
  const L = wide ? 90 : 190;
  const R = wide ? 470 : 370;
  return (
    <svg className="bz-scene" viewBox="0 0 640 300" role="img" aria-label={`Иллюстрация бизнеса «${name}»: ${owned.length} улучшений`}>
      {/* sky details */}
      <g className="bz-sky">
        <circle cx={590} cy={44} r={16} />
        <path d="M40 60 q14 -14 28 0 q10 -10 22 0" />
        <path d="M500 90 q12 -12 24 0 q8 -8 18 0" />
      </g>

      {/* ground */}
      <line className="bz-ground" x1={10} y1={262} x2={630} y2={262} />

      {/* second hall (level 3 path) */}
      <Layer id="hall2" owned={owned} tag={[540, 120]}>
        <rect className="bz-wall" x={470} y={100} width={140} height={162} />
        <rect className="bz-glass" x={490} y={140} width={100} height={70} rx={4} />
        <line className="bz-thin" x1={540} y1={140} x2={540} y2={210} />
        <path className="bz-roof" d="M462 100 L540 70 L618 100" />
      </Layer>

      {/* main building: kiosk on level 1, café front from level 2 */}
      <g className="bz-building">
        <rect className="bz-wall" x={L} y={wide ? 90 : 130} width={R - L} height={wide ? 172 : 132} />
        <path className="bz-awning" d={`M${L - 10} ${wide ? 90 : 130} H${R + 10} l-12 26 H${L + 2} Z`} />
        {Array.from({ length: Math.floor((R - L) / 30) }, (_, i) => (
          <line key={i} className="bz-stripe" x1={L + 10 + i * 30} y1={wide ? 92 : 132} x2={L + 4 + i * 30} y2={wide ? 114 : 154} />
        ))}
        <rect className="bz-glass" x={L + 18} y={wide ? 132 : 166} width={wide ? 170 : 90} height={wide ? 70 : 40} rx={4} />
        {wide && <rect className="bz-door" x={R - 70} y={170} width={44} height={92} rx={3} />}
        {/* counter */}
        <rect className="bz-counter" x={L + 14} y={wide ? 212 : 214} width={wide ? 200 : 140} height={wide ? 50 : 48} />
      </g>

      <Layer id="renovation" owned={owned} tag={[L + 40, 82]}>
        <path className="bz-leaf" d={`M${L + 4} 262 v-26 m0 0 q-12 -10 -2 -24 m2 24 q12 -10 2 -24`} />
        <rect className="bz-pot" x={L - 6} y={246} width={20} height={16} rx={2} />
        <line className="bz-thin" x1={L + 70} y1={wide ? 90 : 130} x2={L + 70} y2={wide ? 118 : 150} />
        <path className="bz-lamp" d={`M${L + 60} ${wide ? 118 : 150} h20 l-4 8 h-12 Z`} />
      </Layer>

      <Layer id="sign" owned={owned} tag={[(L + R) / 2, 50]}>
        <rect className="bz-board" x={(L + R) / 2 - 60} y={wide ? 52 : 92} width={120} height={30} rx={4} />
        <text className="bz-sign-text" x={(L + R) / 2} y={wide ? 72 : 112} textAnchor="middle">
          КОФЕ
        </text>
      </Layer>
      <Layer id="neon" owned={owned} tag={[(L + R) / 2 + 90, 40]}>
        <text className="bz-neon" x={(L + R) / 2 + 92} y={wide ? 72 : 112} textAnchor="middle">
          OPEN
        </text>
      </Layer>

      <Layer id="menu" owned={owned} tag={[R - 40, 150]}>
        <rect className="bz-board" x={wide ? R - 120 : R - 60} y={wide ? 128 : 160} width={44} height={36} rx={3} />
        {[0, 1, 2].map((i) => (
          <line key={i} className="bz-thin" x1={(wide ? R - 114 : R - 54)} y1={(wide ? 138 : 170) + i * 8} x2={(wide ? R - 86 : R - 26)} y2={(wide ? 138 : 170) + i * 8} />
        ))}
      </Layer>

      <Layer id="machine" owned={owned} tag={[L + 52, 196]}>
        <rect className="bz-machine" x={L + 30} y={186} width={46} height={26} rx={3} />
        <circle className="bz-dot" cx={L + 42} cy={196} r={3} />
        <path className="bz-steam s1" d={`M${L + 50} 182 q-5 -8 0 -16`} />
        <path className="bz-steam s2" d={`M${L + 60} 182 q5 -8 0 -16`} />
      </Layer>
      <Layer id="grinder" owned={owned} tag={[L + 96, 186]}>
        <path className="bz-machine" d={`M${L + 86} 212 v-12 h16 v12 Z M${L + 84} 200 l6 -14 h8 l6 14`} />
      </Layer>
      <Layer id="latte" owned={owned} tag={[L + 122, 196]}>
        <path className="bz-cup" d={`M${L + 114} 202 h18 v6 a9 9 0 0 1 -18 0 Z`} />
        <path className="bz-heart" d={`M${L + 123} 206 l-3 -3 a2 2 0 0 1 3 -2 a2 2 0 0 1 3 2 Z`} />
      </Layer>
      <Layer id="vinyl" owned={owned} tag={[L + 160, 196]}>
        <rect className="bz-machine" x={L + 142} y={204} width={36} height={8} rx={2} />
        <g className="bz-disc" style={{ transformOrigin: `${L + 160}px 200px` }}>
          <ellipse cx={L + 160} cy={200} rx={14} ry={4} className="bz-record" />
          <circle cx={L + 160} cy={200} r={2} className="bz-dot" />
        </g>
      </Layer>

      <Layer id="showcase" owned={owned} tag={[wide ? L + 180 : L + 120, 236]}>
        <rect className="bz-glass" x={wide ? L + 150 : L + 100} y={224} width={56} height={30} rx={3} />
        {[0, 1, 2].map((i) => (
          <circle key={i} className="bz-cake" cx={(wide ? L + 162 : L + 112) + i * 16} cy={244} r={5} />
        ))}
      </Layer>

      <Layer id="barista" owned={owned} tag={[L + 100, 150]}>
        <g className="bz-person bz-barista">
          <circle cx={L + 100} cy={170} r={8} />
          <path d={`M${L + 100} 178 v26 M${L + 88} 190 h24`} />
          <path className="bz-apron" d={`M${L + 92} 186 h16 v18 h-16 Z`} />
        </g>
      </Layer>

      {/* seating */}
      <Layer id="tables" owned={owned} tag={[wide ? 330 : 420, 214]}>
        {(wide ? [300, 380] : [420]).map((x) => (
          <path key={x} className="bz-furn" d={`M${x - 18} 232 h36 M${x} 232 v30 M${x - 10} 262 h20`} />
        ))}
      </Layer>
      <Layer id="chairs" owned={owned} tag={[wide ? 260 : 460, 226]}>
        {(wide ? [272, 328, 352, 408] : [392, 448]).map((x, i) => (
          <path key={x} className="bz-furn" d={i % 2 ? `M${x} 222 v40 M${x} 244 h-14 v18` : `M${x} 222 v40 M${x} 244 h14 v18`} />
        ))}
      </Layer>

      <Layer id="terrace" owned={owned} tag={[wide ? 430 : 520, 150]}>
        <path className="bz-umbrella" d={`M${wide ? 390 : 480} 176 q40 -36 80 0 Z`} />
        <line className="bz-furn" x1={wide ? 430 : 520} y1={176} x2={wide ? 430 : 520} y2={262} />
        <path className="bz-furn" d={`M${wide ? 412 : 502} 236 h36`} />
      </Layer>

      <Layer id="delivery" owned={owned} tag={[48, 200]}>
        <g className="bz-scooter">
          <circle cx={26} cy={252} r={9} className="bz-wheel" />
          <circle cx={72} cy={252} r={9} className="bz-wheel" />
          <path className="bz-furn" d="M26 252 h30 l10 -26 h10 M56 252 l-6 -18 h-22" />
          <rect className="bz-box" x={26} y={214} width={24} height={20} rx={2} />
        </g>
      </Layer>

      {/* guests walk by: more upgrades → more people */}
      <g className="bz-guests" aria-hidden>
        {Array.from({ length: people }, (_, i) => (
          <g key={i} className="bz-guest" style={{ animationDelay: `${-i * 2.3}s`, animationDuration: `${14 + (i % 3) * 3}s` }}>
            <circle cx={0} cy={226} r={6} />
            <path d="M0 232 v16 M-7 238 h14 M0 248 l-5 14 M0 248 l5 14" />
          </g>
        ))}
      </g>
    </svg>
  );
}
