import { useMemo } from 'react';

const GROUND = 700;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SILHOUETTE = '#05070b';
const RIM = '#46546f';

/** A swinging limb pivoting at (0,0). Constant-speed SMIL, independent of scroll. */
function Limb({ w, h, swing, dur, begin }: { w: number; h: number; swing: number; dur: number; begin: number }) {
  return (
    <g>
      <animateTransform
        attributeName="transform"
        type="rotate"
        values={`${-swing} 0 0;${swing} 0 0;${-swing} 0 0`}
        dur={`${dur}s`}
        begin={`${begin}s`}
        repeatCount="indefinite"
      />
      <rect x={-w / 2} y={0} width={w} height={h} rx={w / 2} fill={SILHOUETTE} stroke={RIM} strokeWidth={0.5} strokeOpacity={0.55} />
    </g>
  );
}

/** One silhouette (feet at the origin, facing +x). */
function Person({ kind, phase }: { kind: number; phase: number }) {
  const dur = 0.9; // one full stride cycle
  return (
    <g>
      {/* back arm + back leg */}
      <g transform="translate(0 -36)">
        <Limb w={3.4} h={14} swing={-24} dur={dur} begin={-phase - dur / 2} />
      </g>
      <g transform="translate(0 -20)">
        <Limb w={4.4} h={20} swing={-26} dur={dur} begin={-phase} />
      </g>
      {/* torso + head */}
      <rect x={-5.2} y={-38} width={10.4} height={19} rx={4.6} fill={SILHOUETTE} stroke={RIM} strokeWidth={0.5} strokeOpacity={0.55} />
      <circle cx={0.8} cy={-43.5} r={5} fill={SILHOUETTE} stroke={RIM} strokeWidth={0.5} strokeOpacity={0.55} />
      {kind === 1 && <rect x={-9} y={-37} width={5} height={13} rx={2.2} fill={SILHOUETTE} stroke={RIM} strokeWidth={0.5} strokeOpacity={0.55} />}
      {kind === 2 && <path d="M-4.5 -46 Q0 -53 5 -46 Z" fill={SILHOUETTE} />}
      {kind === 3 && <path d="M-3 -47 q-6 3 -5 12" stroke={SILHOUETTE} strokeWidth={3} fill="none" strokeLinecap="round" />}
      {/* front leg + front arm */}
      <g transform="translate(0 -20)">
        <Limb w={4.4} h={20} swing={26} dur={dur} begin={-phase} />
      </g>
      <g transform="translate(0 -36)">
        <Limb w={3.4} h={14} swing={24} dur={dur} begin={-phase - dur / 2} />
      </g>
    </g>
  );
}

interface Walker {
  x: number;
  dx: number;
  dur: number;
  delay: number;
  scale: number;
  kind: number;
  phase: number;
}

/** People walking along the city street, looping with a fade at each end. */
export function Walkers() {
  const walkers = useMemo<Walker[]>(() => {
    const r = rng(23);
    const out: Walker[] = [];
    for (let i = 0; i < 22; i++) {
      const dir = r() < 0.5 ? 1 : -1;
      const len = 260 + r() * 240;
      const speed = 22 + r() * 12; // world units per second (constant)
      const baseX = 2640 + (i / 22) * 2480 + (r() - 0.5) * 80;
      const scale = i % 7 === 3 ? 0.68 : 0.92 + r() * 0.2; // a few children
      out.push({
        x: dir === 1 ? baseX : baseX + len,
        dx: dir * len,
        dur: len / speed,
        delay: -r() * (len / speed),
        scale,
        kind: Math.floor(r() * 4),
        phase: r() * 0.9,
      });
    }
    return out;
  }, []);

  return (
    <g data-layer="walkers">
      {walkers.map((w, i) => (
        <g key={i} transform={`translate(${w.x.toFixed(1)} ${GROUND - 3})`}>
          <g
            className="walker"
            style={
              {
                '--dx': `${w.dx.toFixed(1)}px`,
                animationDuration: `${w.dur.toFixed(2)}s`,
                animationDelay: `${w.delay.toFixed(2)}s`,
              } as React.CSSProperties
            }
          >
            <g transform={`scale(${w.dx < 0 ? -w.scale : w.scale} ${w.scale})`}>
              <Person kind={w.kind} phase={w.phase} />
            </g>
          </g>
        </g>
      ))}
    </g>
  );
}
