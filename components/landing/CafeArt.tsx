/** Line-art café that grows with savings: stage 1 = bare counter, 2 = coffee machine, 3 = chairs + barista. */
export function CafeArt({ stage = 3, className = "" }: { stage?: 1 | 2 | 3; className?: string }) {
  return (
    <svg className={`lp-cafe ${className}`} viewBox="0 0 240 160" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* awning + walls */}
      <path d="M20 40h200l-10-22H30z" />
      <path className="lp-cafe-acc" d="M50 18 44 40M80 18l-4 22M110 18l-2 22M140 18v22M170 18l2 22M200 18l6 22" />
      <path d="M28 40v104M212 40v104M14 144h212" />
      {/* counter */}
      <path d="M40 104h96v40M40 104v40" />
      <path d="M40 112h96" />
      {/* piggy coin on the counter */}
      <circle className="lp-cafe-acc" cx="60" cy="96" r="7" />
      <path className="lp-cafe-acc" d="M60 92v8" />
      {stage >= 2 && (
        <g>
          <rect x="92" y="74" width="30" height="30" rx="3" />
          <path d="M98 82h18M104 90v6M112 90v6" />
          <path className="lp-cafe-acc" d="M104 66c0-4 3-4 3-8M112 66c0-4 3-4 3-8" />
        </g>
      )}
      {stage >= 3 && (
        <g>
          {/* barista */}
          <circle cx="70" cy="66" r="7" />
          <path d="M58 104c0-14 5-24 12-24s12 10 12 24" />
          <path className="lp-cafe-acc" d="M64 88h12" />
          {/* table + chairs */}
          <path d="M160 112h36M178 112v32M168 144h20" />
          <path d="M150 144v-26h-8M206 144v-26h8" />
          <path className="lp-cafe-acc" d="M172 104h10v8h-10zM182 106h3a2 2 0 0 1 0 4h-3" />
        </g>
      )}
    </svg>
  );
}
