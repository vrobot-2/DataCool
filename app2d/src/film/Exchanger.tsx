const HOT = '#FF6B57';
const AMBER = '#FFB45C';

export const EXCH = { x: 1760, y: 370, w: 360, h: 320 };

const PLATES = 34;
const STEP = 8.6;
const px = (i: number) => 34 + i * STEP;

/**
 * Plate heat exchanger. `--peel` (0..1, set on the <svg> by the film loop) drives the
 * "peel away": the moving frame slides off and ghosts, the plate pack lights up as
 * alternating hot / city channels with counter-flow arrows and heat crossing the plates.
 */
export function Exchanger() {
  const plates = Array.from({ length: PLATES }, (_, i) => i);
  const gaps = Array.from({ length: PLATES - 1 }, (_, i) => i);
  const top = 20;
  const bottom = EXCH.h - 20;
  return (
    <g transform={`translate(${EXCH.x} ${EXCH.y})`}>
      <rect x={-24} y={EXCH.h + 8} width={EXCH.w + 48} height={14} rx={3} fill="#222b38" />

      {/* frame + rods: fade as the pack is revealed */}
      <g className="ex-ghost">
        <rect x={-10} y={-18} width={EXCH.w + 20} height={10} rx={3} fill="#9aa4b6" />
        <rect x={0} y={0} width={30} height={EXCH.h} rx={8} fill="#ff8a3c" stroke="#ffb27a" />
        {[34, EXCH.h - 34].map((y) => (
          <g key={y}>
            <rect x={-8} y={y - 4} width={EXCH.w + 16} height={8} rx={4} fill="#d4dbe8" />
            <rect x={-18} y={y - 9} width={14} height={18} rx={3} fill="#58637a" />
          </g>
        ))}
        {[70, 250].map((y) => (
          <g key={y}>
            <rect x={-7} y={y - 20} width={14} height={40} rx={3} fill="#d4dbe8" />
            {[-14, 0, 14].map((o) => (
              <circle key={o} cx={0} cy={y + o} r={2.2} fill="#58637a" />
            ))}
          </g>
        ))}
      </g>

      {/* moving frame peels away to the right */}
      <g className="ex-peel-frame">
        <rect x={EXCH.w - 30} y={0} width={30} height={EXCH.h} rx={8} fill="#ff8a3c" stroke="#ffb27a" />
        {[34, EXCH.h - 34].map((y) => (
          <rect key={y} x={EXCH.w + 4} y={y - 9} width={14} height={18} rx={3} fill="#58637a" />
        ))}
        {[70, 250].map((y) => (
          <g key={y}>
            <rect x={EXCH.w - 7} y={y - 20} width={14} height={40} rx={3} fill="#d4dbe8" />
            {[-14, 0, 14].map((o) => (
              <circle key={o} cx={EXCH.w} cy={y + o} r={2.2} fill="#58637a" />
            ))}
          </g>
        ))}
      </g>

      {/* plates */}
      {plates.map((i) => (
        <rect key={i} x={px(i)} y={14} width={5} height={EXCH.h - 28} rx={1.5} fill={i % 2 ? '#8794ae' : '#bfc7d6'} />
      ))}
      <rect x={34} y={14} width={EXCH.w - 68} height={EXCH.h - 28} fill="url(#plateFlow)" className="plate-flow ex-ghost-flow" />

      <g className="ex-nameplate">
        <rect x={EXCH.w / 2 - 54} y={EXCH.h / 2 - 22} width={108} height={44} rx={4} fill="#10151d" stroke="#d9e0ee" strokeOpacity={0.5} />
        <text x={EXCH.w / 2} y={EXCH.h / 2 - 4} textAnchor="middle" className="plate-name">
          DATACOOL
        </text>
        <text x={EXCH.w / 2} y={EXCH.h / 2 + 12} textAnchor="middle" className="plate-sub">
          PHE-72 · 96.4 %
        </text>
      </g>

      {/* ---------------- the explanation layer (opacity = --peel) ---------------- */}
      <g className="ex-explain">
        {gaps.map((i) => {
          const hot = i % 2 === 0;
          const x = px(i) + 5 + (STEP - 5) / 2;
          return (
            <g key={i}>
              <rect x={px(i) + 5} y={top} width={STEP - 5} height={bottom - top} fill={hot ? 'url(#gapHot)' : 'url(#gapCity)'} opacity={0.72} />
              <path
                d={`M${x} ${top + 4} V${bottom - 4}`}
                stroke="#fff"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeDasharray="2 11"
                className={`gapflow${hot ? '' : ' rev'}`}
              />
            </g>
          );
        })}

        {/* heat crossing each plate, hot channel -> city channel */}
        {plates.slice(1, -1).map((i) =>
          [90, 160, 230].map((y) => {
            const right = i % 2 === 1; // gap i-1 is hot when i is odd
            const x = px(i) + 2.5;
            const d = right ? `M${x - 4} ${y} h8 m-3 -3 l3 3 l-3 3` : `M${x + 4} ${y} h-8 m3 -3 l-3 3 l3 3`;
            return <path key={`${i}-${y}`} d={d} className="heatx" fill="none" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />;
          }),
        )}

        {/* labels */}
        <g className="ex-label">
          <path d={`M${px(1)} ${-6} V${top - 4}`} stroke={HOT} strokeWidth={2} />
          <circle cx={px(1)} cy={top - 4} r={3.4} fill={HOT} />
          <text x={px(1) - 4} y={-46} className="ex-k">
            HOT LOOP · from the racks
          </text>
          <text x={px(1) - 4} y={-18} className="ex-v ex-v--hot">
            84 °C in → 41 °C out
          </text>
        </g>
        <g className="ex-label">
          <path d={`M${px(PLATES - 2)} ${-6} V${top - 4}`} stroke={AMBER} strokeWidth={2} />
          <circle cx={px(PLATES - 2)} cy={top - 4} r={3.4} fill={AMBER} />
          <text x={px(PLATES - 2) + 4} y={-46} textAnchor="end" className="ex-k">
            CITY LOOP · to the homes
          </text>
          <text x={px(PLATES - 2) + 4} y={-18} textAnchor="end" className="ex-v ex-v--city">
            38 °C in → 78 °C out
          </text>
        </g>
        <text x={EXCH.w / 2} y={EXCH.h + 52} textAnchor="middle" className="ex-cap">
          Counter-flow: two loops share a wall,
        </text>
        <text x={EXCH.w / 2} y={EXCH.h + 78} textAnchor="middle" className="ex-cap">
          not the water.
        </text>
      </g>
    </g>
  );
}
