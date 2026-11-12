import { memo, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { WORLD, cameraAt, win } from './camera';
import { EXCH, Exchanger } from './Exchanger';
import { Walkers } from './Walkers';
import './film.css';

/* ------------------------------------------------------------------ helpers */

const COLD = '#7C8BFF';
const HOT = '#FF6B57';
const AMBER = '#FFB45C';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type P = [number, number];

/** Polyline with rounded corners (radius r). */
function roundedPath(pts: P[], r = 26): string {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(cx - px, cy - py);
    const l2 = Math.hypot(nx - cx, ny - cy);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ax = cx - ((cx - px) / l1) * rr;
    const ay = cy - ((cy - py) / l1) * rr;
    const bx = cx + ((nx - cx) / l2) * rr;
    const by = cy + ((ny - cy) / l2) * rr;
    d += ` L${ax} ${ay} Q${cx} ${cy} ${bx} ${by}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]} ${last[1]}`;
}

/** Glass pipe: halo, tinted jacket, bright core, flowing dashes. */
function Pipe({
  pts,
  color,
  width = 12,
  rev = false,
  r = 28,
  cls = '',
}: {
  pts: P[];
  color: string;
  width?: number;
  rev?: boolean;
  r?: number;
  cls?: string;
}) {
  const d = roundedPath(pts, r);
  return (
    <g className={`pipe ${cls}`}>
      <path d={d} className="pipe-halo" strokeWidth={width + 9} />
      <path d={d} stroke={color} strokeOpacity={0.3} strokeWidth={width} className="pipe-body" />
      <path d={d} stroke={color} strokeOpacity={0.95} strokeWidth={width * 0.3} className="pipe-core" />
      <path
        d={d}
        stroke="#fff"
        strokeWidth={width * 0.26}
        strokeDasharray="2 22"
        className={`flow${rev ? ' rev' : ''}`}
      />
      <path d={d} stroke="#fff" strokeOpacity={0.14} strokeWidth={2} transform={`translate(0 ${-width * 0.28})`} className="pipe-gloss" />
    </g>
  );
}

/* ------------------------------------------------------------------ geometry */

const GROUND = WORLD.groundY;
const RACK_W = 220;
const RACK_H = 560;
const RACK_XS = [150, 410, 670, 930, 1190];
const SUP_Y = 70;
const RET_Y = 104;
const PLANT = { x: 1520, y: 240, w: 940 };

function Rack() {
  const trays = Array.from({ length: 8 }, (_, i) => i);
  return (
    <g>
      <rect width={RACK_W} height={RACK_H} rx={10} fill="#171d27" stroke="#2f3a4a" strokeWidth={2} />
      <rect x={8} y={8} width={RACK_W - 16} height={22} rx={4} fill="#0f141b" />
      <text x={18} y={24} className="rack-brand">
        DATACOOL
      </text>
      <circle cx={RACK_W - 22} cy={19} r={3} fill="#35ff8a" className="led" />
      {trays.map((i) => {
        const y = 40 + i * 62;
        return (
          <g key={i} transform={`translate(0 ${y})`}>
            <rect x={10} width={178} height={54} rx={4} fill="#0e1218" stroke="#323f51" />
            <rect x={14} y={5} width={34} height={44} rx={3} fill="#1d2531" />
            <rect x={18} y={10} width={3} height={34} rx={1.5} fill="#2e3a4b" />
            <rect x={26} y={10} width={3} height={34} rx={1.5} fill="#2e3a4b" />
            <rect x={34} y={10} width={3} height={34} rx={1.5} fill="#2e3a4b" />
            <circle cx={42} cy={44} r={2.4} fill={i % 3 === 1 ? '#ffb020' : '#35ff8a'} className="led" style={{ animationDelay: `${i * 0.27}s` }} />
            {[78, 122].map((cx, k) => (
              <g key={cx} transform={`translate(${cx} 27)`}>
                <circle r={20} fill="#0b0f15" stroke="#3a4759" strokeWidth={1.5} />
                <g>
                  {/* SMIL rotation about the fan centre: constant speed, independent of scroll */}
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 0 0"
                    to="360 0 0"
                    dur={`${(0.9 + ((i + k) % 3) * 0.12).toFixed(2)}s`}
                    begin={`${-(i * 0.13 + k * 0.2).toFixed(2)}s`}
                    repeatCount="indefinite"
                  />
                  {[0, 72, 144, 216, 288].map((a) => (
                    <path key={a} d="M0 0 C 6 -4, 13 -9, 14 -17 C 6 -15, 1 -9, 0 0Z" fill="#56627a" transform={`rotate(${a})`} />
                  ))}
                  <circle r={4.5} fill="#8a97ae" />
                </g>
              </g>
            ))}
            <rect x={152} y={12} width={32} height={30} rx={3} fill="#a8642a" stroke="#d99a5b" />
            <rect x={155} y={15} width={26} height={24} rx={2} fill={HOT} fillOpacity={0.72} className="coldplate" />
            <path d="M184 20 H199" stroke={COLD} strokeWidth={3.4} strokeLinecap="round" />
            <path d="M184 34 H209" stroke={HOT} strokeWidth={3.4} strokeLinecap="round" />
          </g>
        );
      })}
      <rect x={196} y={36} width={7} height={RACK_H - 76} rx={3.5} fill={COLD} fillOpacity={0.55} />
      <rect x={207} y={36} width={7} height={RACK_H - 76} rx={3.5} fill={HOT} fillOpacity={0.6} />
      <rect x={14} y={RACK_H - 24} width={RACK_W - 28} height={10} rx={3} fill="#0f141b" />
      <rect x={10} y={RACK_H} width={20} height={9} rx={2} fill="#1d2531" />
      <rect x={RACK_W - 30} y={RACK_H} width={20} height={9} rx={2} fill="#1d2531" />
    </g>
  );
}

function Plant() {
  return (
    <g>
      {/* building shell */}
      <path d={`M${PLANT.x - 20} ${PLANT.y + 10} L${PLANT.x + 20} ${PLANT.y - 20} H${PLANT.x + PLANT.w - 20} L${PLANT.x + PLANT.w + 20} ${PLANT.y + 10} Z`} fill="#0d1218" stroke="#2a3443" strokeWidth={2} />
      <rect x={PLANT.x} y={PLANT.y + 10} width={PLANT.w} height={GROUND - PLANT.y - 10} fill="url(#plantWall)" stroke="#2a3443" strokeWidth={2} />
      <rect x={PLANT.x + 14} y={PLANT.y + 24} width={PLANT.w - 28} height={GROUND - PLANT.y - 38} rx={6} fill="#0a0e14" stroke="#1d2635" />
      {/* clerestory lights */}
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={PLANT.x + 50 + i * 98} y={PLANT.y + 36} width={60} height={9} rx={4} fill="#dfe6ff" fillOpacity={0.22} />
      ))}
      <rect x={PLANT.x + 14} y={GROUND - 20} width={PLANT.w - 28} height={6} fill="#ffd25c" fillOpacity={0.55} />
      {/* stacks */}
      {[2230, 2290, 2350, 2410].map((x) => (
        <g key={x}>
          <rect x={x} y={PLANT.y - 130} width={22} height={140} rx={3} fill="#1c2431" stroke="#34405a" />
          <rect x={x} y={PLANT.y - 130} width={22} height={9} rx={3} fill={AMBER} fillOpacity={0.9} />
          <circle cx={x + 11} cy={PLANT.y - 150} r={12} fill="#c5cde0" fillOpacity={0.09} className="steam" style={{ animationDelay: `${(x % 7) * 0.3}s` }} />
        </g>
      ))}
      <text x={PLANT.x + 28} y={PLANT.y + 78} className="plant-sign">
        DATACOOL · ENERGY PLANT
      </text>

      {/* ------- plate heat exchanger (peels away, see Exchanger.tsx) ------- */}
      <Exchanger />

      {/* pump */}
      <g transform={`translate(1584 ${GROUND - 54})`}>
        <rect x={-30} y={20} width={60} height={14} rx={3} fill="#222b38" />
        <circle r={26} fill="#141a23" stroke="#3a4759" strokeWidth={2} />
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="0.9s" repeatCount="indefinite" />
          {[0, 90, 180, 270].map((a) => (
            <path key={a} d="M0 0 C8 -2 18 -6 20 -16 C10 -18 2 -10 0 0Z" fill={COLD} fillOpacity={0.75} transform={`rotate(${a})`} />
          ))}
        </g>
        <circle r={5} fill="#c3cde4" />
      </g>
      {/* control cabinet */}
      <g transform={`translate(2260 ${GROUND - 160})`}>
        <rect width={150} height={150} rx={6} fill="#171d27" stroke="#323f51" strokeWidth={2} />
        <rect x={14} y={14} width={122} height={54} rx={4} fill="#06090e" stroke="#3b4a60" />
        <text x={24} y={36} className="scr-k">
          OUT
        </text>
        <text x={24} y={58} className="scr-v">
          84 °C
        </text>
        <text x={84} y={36} className="scr-k">
          IN
        </text>
        <text x={84} y={58} className="scr-v scr-c">
          41 °C
        </text>
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx={26 + i * 24} cy={92} r={4.5} fill={i === 3 ? '#ffb020' : '#35ff8a'} className="led" style={{ animationDelay: `${i * 0.4}s` }} />
        ))}
        <rect x={14} y={110} width={122} height={26} rx={3} fill="#0f141b" />
      </g>
    </g>
  );
}

interface Building {
  x: number;
  w: number;
  h: number;
  thr: number;
  cols: number;
  rows: number;
  seed: number;
  tone: string;
}

function makeCity(): Building[] {
  const r = rng(7);
  const out: Building[] = [];
  let x = 2620;
  const tones = ['#10161f', '#131a25', '#0f141c', '#161d29'];
  while (x < 5150) {
    const w = 90 + r() * 80;
    const tall = r() < 0.32;
    const h = tall ? 320 + r() * 230 : 130 + r() * 170;
    out.push({
      x,
      w,
      h,
      thr: (x - 2620) / 2550,
      cols: Math.max(2, Math.floor((w - 16) / 22)),
      rows: Math.max(2, Math.floor((h - 24) / 28)),
      seed: Math.floor(r() * 1e6),
      tone: tones[Math.floor(r() * tones.length)],
    });
    x += w + 26 + r() * 40;
  }
  return out;
}

const CITY = makeCity();

function CityBuilding({ b, i }: { b: Building; i: number }) {
  const rand = useMemo(() => rng(b.seed), [b.seed]);
  const wins = useMemo(() => {
    const out: { x: number; y: number; w: number }[] = [];
    for (let row = 0; row < b.rows; row++) {
      for (let col = 0; col < b.cols; col++) {
        out.push({
          x: 12 + col * ((b.w - 24) / b.cols) + 3,
          y: 16 + row * 28,
          w: rand(),
        });
      }
    }
    return out;
  }, [b, rand]);
  return (
    <g transform={`translate(${b.x} ${GROUND - b.h})`} data-b={i} data-thr={b.thr.toFixed(3)}>
      <rect width={b.w} height={b.h} rx={3} fill={b.tone} stroke="#222c3b" strokeWidth={1.5} />
      <rect x={b.w * 0.18} y={-14} width={b.w * 0.3} height={14} fill="#222c3b" />
      {i % 3 === 0 && <rect x={b.w * 0.74} y={-34} width={3} height={34} fill="#3a4759" />}
      {wins.map((w, k) => (
        <g key={k}>
          <rect x={w.x} y={w.y} width={10} height={15} rx={1.5} fill="#1c2634" />
          <rect x={w.x} y={w.y} width={10} height={15} rx={1.5} className="win" style={{ ['--w' as string]: w.w * 0.55 }} />
        </g>
      ))}
      <rect x={b.w / 2 - 9} y={b.h - 26} width={18} height={26} rx={2} fill="#0a0e14" />
    </g>
  );
}

function Skyline({ seed, base, color, h0 }: { seed: number; base: number; color: string; h0: number }) {
  const d = useMemo(() => {
    const r = rng(seed);
    let x = -2400;
    let path = `M${x} ${base}`;
    while (x < 8400) {
      const w = 60 + r() * 120;
      const h = h0 * (0.4 + r() * 0.9);
      path += ` V${base - h} H${x + w}`;
      x += w;
    }
    return `${path} V${base} Z`;
  }, [seed, base, h0]);
  return <path d={d} fill={color} />;
}

function Stars() {
  const stars = useMemo(() => {
    const r = rng(31);
    return Array.from({ length: 260 }, () => ({
      x: -1800 + r() * 8200,
      y: -1400 + r() * 1700,
      r: 0.6 + r() * 1.6,
      o: 0.25 + r() * 0.65,
    }));
  }, []);
  return (
    <g>
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#dfe6ff" opacity={s.o} />
      ))}
    </g>
  );
}

function Trees() {
  const trees = useMemo(() => {
    const r = rng(11);
    return Array.from({ length: 34 }, (_, i) => ({ x: 2580 + i * 82 + r() * 40, s: 0.7 + r() * 0.7 }));
  }, []);
  return (
    <g>
      {trees.map((t, i) => (
        <g key={i} transform={`translate(${t.x} ${GROUND}) scale(${t.s})`}>
          <rect x={-3} y={-34} width={6} height={34} fill="#2a2018" />
          <circle cy={-48} r={22} fill="#143124" />
          <circle cx={9} cy={-40} r={15} fill="#1a3d2d" />
        </g>
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <g key={`l${i}`} transform={`translate(${2700 + i * 180} ${GROUND})`}>
          <rect x={-1.5} y={-60} width={3} height={60} fill="#3a4759" />
          <circle cy={-62} r={14} fill={AMBER} fillOpacity={0.18} />
          <circle cy={-62} r={4} fill="#ffe3b0" />
        </g>
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ world */

const World = memo(function World() {
  const supplyDrops = RACK_XS.map((x) => x + 199.5);
  const returnDrops = RACK_XS.map((x) => x + 210.5);
  const headerEnd = PLANT.x + 140;
  return (
    <>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05070b" />
          <stop offset="0.55" stopColor="#0d1220" />
          <stop offset="0.9" stopColor="#1b1a2b" />
          <stop offset="1" stopColor="#3a2326" />
        </linearGradient>
        <radialGradient id="horizon" cx="0.5" cy="1" r="0.8">
          <stop offset="0" stopColor="#ff8a4d" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#b8472f" stopOpacity="0.14" />
          <stop offset="1" stopColor="#b8472f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#20180f" />
          <stop offset="0.35" stopColor="#15100b" />
          <stop offset="1" stopColor="#0a0806" />
        </linearGradient>
        <linearGradient id="plantWall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#151c27" />
          <stop offset="1" stopColor="#0f151d" />
        </linearGradient>
        <linearGradient id="plateFlow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={HOT} stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor={COLD} stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="gapHot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={HOT} />
          <stop offset="1" stopColor="#b98ab0" />
        </linearGradient>
        <linearGradient id="gapCity" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={COLD} />
          <stop offset="1" stopColor={AMBER} />
        </linearGradient>
      </defs>

      {/* sky */}
      <rect x={-2600} y={-1600} width={9200} height={GROUND + 1600} fill="url(#sky)" />
      <g className="stars" data-layer="stars">
        <Stars />
      </g>
      <ellipse cx={2300} cy={GROUND} rx={3800} ry={900} fill="url(#horizon)" className="dusk" />

      {/* parallax skylines */}
      <g data-parallax="0.78">
        <Skyline seed={3} base={GROUND} color="#0b0f17" h0={380} />
      </g>
      <g data-parallax="0.58">
        <Skyline seed={9} base={GROUND} color="#0f1520" h0={250} />
      </g>

      {/* ground + underground */}
      <rect x={-2600} y={GROUND} width={9200} height={WORLD.bottomY - GROUND} fill="url(#soil)" />
      {[790, 860, 1010, 1120, 1210].map((y, i) => (
        <path key={y} d={`M-2600 ${y} C ${-400 + i * 300} ${y - 18}, 1800 ${y + 20}, 6600 ${y - 8}`} stroke="#fff" strokeOpacity={0.035} strokeWidth={2} fill="none" />
      ))}
      <rect x={-2600} y={GROUND - 4} width={9200} height={12} fill="#1b2430" />
      <rect x={-2600} y={GROUND - 4} width={9200} height={2} fill="#fff" fillOpacity={0.08} />

      {/* city */}
      <g data-layer="city">
        {CITY.map((b, i) => (
          <CityBuilding key={i} b={b} i={i} />
        ))}
        <Trees />
        <Walkers />
      </g>

      {/* heat-network branches into buildings (grade level) */}
      <g data-layer="branches">
        {CITY.filter((_, i) => i % 2 === 0).map((b, i) => (
          <Pipe key={i} pts={[[b.x + b.w / 2, 900], [b.x + b.w / 2, GROUND - 4]]} color={AMBER} width={9} r={0} cls="branch" />
        ))}
      </g>

      {/* plant + racks */}
      <Plant />
      {RACK_XS.map((x) => (
        <g key={x} transform={`translate(${x} ${GROUND - RACK_H})`}>
          <Rack />
        </g>
      ))}

      {/* heat waves that the loop captures (fade out by the first shot) */}
      <g className="heatwaves" fill="none" stroke={HOT} strokeLinecap="round">
        {RACK_XS.map((x, i) =>
          [0, 1, 2].map((k) => (
            <path
              key={`${i}-${k}`}
              className="heatwave"
              style={{ animationDelay: `${-(i * 0.5 + k * 0.7)}s` }}
              d={`M${x + 50 + k * 56} ${GROUND - RACK_H - 6} q 12 -22 0 -44 t 0 -44`}
              strokeWidth={4}
            />
          )),
        )}
      </g>

      {/* ------- overhead headers (rack loop) ------- */}
      <g data-layer="headers">
        <Pipe pts={[[headerEnd + 20, SUP_Y], [RACK_XS[0] + 199.5, SUP_Y]]} color={COLD} width={16} rev cls="hdr" />
        <Pipe pts={[[RACK_XS[0] + 210.5, RET_Y], [headerEnd + 20, RET_Y]]} color={HOT} width={16} cls="hdr" />
        {supplyDrops.map((x, i) => (
          <Pipe key={`s${i}`} pts={[[x, SUP_Y], [x, GROUND - RACK_H + 36]]} color={COLD} width={7} r={0} rev cls="drop" />
        ))}
        {returnDrops.map((x, i) => (
          <Pipe key={`r${i}`} pts={[[x, GROUND - RACK_H + 36], [x, RET_Y]]} color={HOT} width={7} r={0} cls="drop" />
        ))}
        {/* header into the plant, down to the exchanger */}
        <Pipe pts={[[headerEnd + 20, RET_Y], [1700, RET_Y], [1700, EXCH.y + 70], [EXCH.x - 8, EXCH.y + 70]]} color={HOT} width={16} cls="hdr" />
        <Pipe pts={[[EXCH.x - 8, EXCH.y + 250], [1650, EXCH.y + 250], [1650, SUP_Y], [headerEnd + 20, SUP_Y]]} color={COLD} width={16} rev cls="hdr" />
        {/* gauges */}
        {[[1700, 220], [1650, 560]].map(([x, y]) => (
          <g key={`${x}${y}`} transform={`translate(${x} ${y})`}>
            <circle r={15} fill="#0b0f15" stroke="#7b88a2" strokeWidth={2} />
            <path d="M0 0 L8 -8" stroke={HOT} strokeWidth={2} strokeLinecap="round" className="needle" />
          </g>
        ))}
      </g>

      {/* ------- city loop: exchanger -> out of the plant -> underground ------- */}
      <g data-layer="main">
        <Pipe pts={[[EXCH.x + EXCH.w + 8, EXCH.y + 70], [2520, EXCH.y + 70], [2520, 900], [5250, 900]]} color={AMBER} width={22} cls="main" />
        <Pipe pts={[[5250, 960], [2420, 960], [2420, EXCH.y + 250], [EXCH.x + EXCH.w + 8, EXCH.y + 250]]} color={COLD} width={16} rev cls="main" />
      </g>

      {/* duct bank + warning tape (underground detail) */}
      <g data-layer="duct" opacity={0.85}>
        <rect x={2380} y={872} width={2900} height={116} rx={22} fill="#20262f" fillOpacity={0.45} stroke="#3a4452" strokeWidth={2} />
        <path d={`M2380 800 H5280`} stroke="#ffd25c" strokeWidth={4} strokeDasharray="22 22" strokeOpacity={0.55} />
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={2700 + i * 300} y={846} width={8} height={26} fill="#3a4452" />
        ))}
      </g>
    </>
  );
});

/* ------------------------------------------------------------------ component */

const sm = (x: number) => x * x * (3 - 2 * x);
const c01 = (x: number) => Math.min(1, Math.max(0, x));
/** 0..1: opens as the camera settles on the plant (t=4), closes again before it leaves. */
function peelAt(t: number) {
  return sm(c01((t - 3.78) / 0.32)) * (1 - sm(c01((t - 4.3) / 0.32)));
}

export function Film({ cameraT }: { cameraT: MutableRefObject<number> }) {
  const svg = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const parallax = Array.from(el.querySelectorAll<SVGGElement>('[data-parallax]'));
    const buildings = Array.from(el.querySelectorAll<SVGGElement>('[data-b]'));
    const heat = el.querySelector<SVGGElement>('.heatwaves');
    const branches = el.querySelector<SVGGElement>('[data-layer="branches"]');
    const dusk = el.querySelector<SVGElement>('.dusk');
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += (cameraT.current - t) * 0.14;
      if (Math.abs(cameraT.current - t) < 0.0005) t = cameraT.current;
      const cam = cameraAt(t);
      // "peel away" window: the exchanger opens up while the camera rests on the plant (t≈4)
      const peel = peelAt(t);
      el.style.setProperty('--peel', peel.toFixed(3));
      document.documentElement.style.setProperty('--peel', peel.toFixed(3)); // lets the DOM overlay fade too
      cam.w *= 1 - 0.14 * peel; // slide in on the plate pack
      cam.y += 34 * peel;
      cam.x -= 10 * peel;
      const W = el.clientWidth || 1440;
      const H = el.clientHeight || 900;
      const aspect = W / H;
      // keep the landscape vertical framing; crop horizontally on tall screens
      const h = cam.w * 0.5625;
      const w = h * aspect;
      el.setAttribute('viewBox', `${(cam.x - w / 2).toFixed(2)} ${(cam.y - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);

      for (const g of parallax) {
        const k = Number(g.dataset.parallax);
        g.setAttribute('transform', `translate(${((cam.x - 2300) * (1 - k)).toFixed(1)} 0)`);
      }
      // flow and fan speeds are constant (CSS / SMIL): scrolling never speeds them up
      if (heat) heat.style.opacity = String(Math.max(0, 1 - t / 0.9) * 0.55);
      if (dusk) dusk.style.opacity = String(0.55 + 0.45 * win(t, 5.6, 9, 0.8));
      if (branches) branches.style.opacity = String(win(t, 5.2, 9, 0.8));
      const front = Math.max(0, (t - 5.9) / 2) * 1.2;
      for (const b of buildings) {
        const thr = Number(b.dataset.thr);
        b.style.setProperty('--on', String(Math.min(1, Math.max(0, (front - thr) * 5)).toFixed(3)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cameraT]);

  return (
    <svg ref={svg} className="film" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" role="img" aria-label="DataCool loop: rack to city">
      <World />
    </svg>
  );
}
