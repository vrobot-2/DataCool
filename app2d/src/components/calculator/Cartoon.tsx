import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtNum, fmtUsd, roundTens, type CalcOutputs, type YearPoint } from '../../data/calc';
import { CoinJar } from './CoinJar';

/** Value of the cumulative series at a fractional year (never indexes out of range). */
function pointAt(series: YearPoint[], year: number): YearPoint {
  if (!series.length) {
    return { year: 0, cumNetUsd: 0, cumCoolingBeforeUsd: 0, cumCoolingAfterUsd: 0, cumCarbonUsd: 0 };
  }
  const y = Math.min(Math.max(year, 0), series.length - 1);
  const i = Math.floor(y);
  const a = series[i];
  const b = series[Math.min(i + 1, series.length - 1)];
  const f = y - i;
  const mix = (k: keyof YearPoint) => (a[k] as number) + ((b[k] as number) - (a[k] as number)) * f;
  return {
    year: y,
    cumNetUsd: mix('cumNetUsd'),
    cumCoolingBeforeUsd: mix('cumCoolingBeforeUsd'),
    cumCoolingAfterUsd: mix('cumCoolingAfterUsd'),
    cumCarbonUsd: mix('cumCarbonUsd'),
  };
}

const HOUSES = 6;
const CONFETTI = ['#5ce0a0', '#ffb45c', '#7c8bff', '#ff6b57'];

/**
 * Friendly animated cartoon: a rack sends its heat down a pipe to a row of houses, coins
 * pile up in a 2.5D physics jar, and a "payback meter" fills as the years go by.
 * Play / pause / replay + a year slider.
 */
export function Cartoon({
  outputs,
  year,
  onYearChange,
  playing,
  onPlay,
  onPause,
  onPlayComplete,
}: {
  outputs: CalcOutputs;
  year: number;
  onYearChange: (y: number) => void;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPlayComplete: () => void;
}) {
  const { series, paybackYears, inputs, capexUsd, operatorCashUsd } = outputs;
  const maxYear = Math.max(1, Math.floor(inputs.horizonYears));
  const point = useMemo(() => pointAt(series, year), [series, year]);

  // keep the latest values in refs so the animation loop never restarts mid-play
  const yearRef = useRef(year);
  yearRef.current = year;
  const cb = useRef({ onYearChange, onPlayComplete });
  cb.current = { onYearChange, onPlayComplete };

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    const step = (time: number) => {
      if (!last) last = time;
      const dt = Math.min(0.1, (time - last) / 1000);
      last = time;
      const next = yearRef.current + dt * 1.6; // ~1.6 years per second
      if (next >= maxYear) {
        cb.current.onYearChange(maxYear);
        cb.current.onPlayComplete();
        return;
      }
      yearRef.current = next;
      cb.current.onYearChange(next);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, maxYear]);

  const earned = point.cumNetUsd + capexUsd; // cash earned back so far
  const meter = capexUsd > 0 ? Math.max(0, earned / capexUsd) : 0; // 1 = paid back
  const paid = meter >= 1;
  const profit = Math.max(0, point.cumNetUsd);
  const lit = Math.min(HOUSES, Math.round(HOUSES * (0.35 + 0.65 * Math.min(1, year / 2))));
  const smoke = Math.max(0, 1 - year / Math.max(1, Math.min(maxYear, 4)));
  const finished = year >= maxYear - 0.001;
  const payYear = Number.isFinite(paybackYears) ? paybackYears : Infinity;

  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const [burst, setBurst] = useState(0);
  const wasPaid = useRef(false);
  useEffect(() => {
    // confetti only when the meter crosses 100 % while the years are playing
    if (paid && !wasPaid.current && playing && !reduced) {
      wasPaid.current = true;
      setBurst((b) => b + 1);
      const id = window.setTimeout(() => setBurst(0), 1800);
      return () => clearTimeout(id);
    }
    if (!paid) wasPaid.current = false;
  }, [paid, playing, reduced]);

  // 40 coins = paid back (about two thirds of the jar); extra profit fills it to the rim
  const coinCount = Math.min(64, Math.round((Math.max(0, earned) / Math.max(1, capexUsd)) * 40));
  const jarLabel = `${coinCount} coins · 1 coin ≈ ${fmtUsd(capexUsd / 40)}`;

  const mood = !Number.isFinite(payYear)
    ? "Hmm, at these numbers it doesn't pay back. Try cheaper power or a higher heat price."
    : year < 0.05
      ? `Press play. Let's watch ${fmtUsd(operatorCashUsd)} a year roll in.`
      : paid
        ? `Paid back! Now ${fmtUsd(profit)} of pure profit.`
        : `Still paying it back… ${Math.round(Math.min(meter, 1) * 100)}% there.`;

  const label = `Year ${year.toFixed(1)} of ${maxYear}`;
  const markPct = Number.isFinite(payYear) ? Math.min(100, (payYear / maxYear) * 100) : null;

  return (
    <div className="fc-cartoon">
      <div className="fc-stage-row">
        <svg viewBox="0 0 640 330" className="fc-scene" role="img" aria-label={`Animated savings diagram. ${label}. ${mood}`}>
          <defs>
            <linearGradient id="fcSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#141a2c" />
              <stop offset="1" stopColor="#241f31" />
            </linearGradient>
            <linearGradient id="fcPipe" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ff6b57" />
              <stop offset="1" stopColor="#ffb45c" />
            </linearGradient>
          </defs>
          <rect width="640" height="330" rx="4" fill="url(#fcSky)" />
          {[40, 120, 260, 340, 470, 590].map((x, i) => (
            <circle key={x} cx={x} cy={22 + ((i * 29) % 46)} r={1.6} fill="#fff" opacity={0.5} />
          ))}
          <rect y="238" width="640" height="92" fill="#10141c" />
          <rect y="238" width="640" height="3" fill="#232b3a" />

          {/* rack */}
          <g transform="translate(34 78)">
            <rect width="104" height="170" rx="6" fill="#1b2230" stroke="#3a4760" strokeWidth="2" />
            {[0, 1, 2, 3].map((i) => (
              <g key={i} transform={`translate(10 ${14 + i * 36})`}>
                <rect width="84" height="28" rx="4" fill="#10141c" />
                <circle cx="16" cy="14" r="4.5" fill="#35ff8a" className="fc-blink" style={{ animationDelay: `${i * 0.3}s` }} />
                <rect x="30" y="9" width="30" height="10" rx="3" fill="#ff8a3c" />
                <circle cx="72" cy="14" r="4.5" fill="#ffb020" className="fc-blink" style={{ animationDelay: `${i * 0.3 + 0.5}s` }} />
              </g>
            ))}
            {/* happy face on top */}
            <circle cx="36" cy="-12" r="3" fill="#fff" />
            <circle cx="68" cy="-12" r="3" fill="#fff" />
            <path d="M38 -2 Q52 8 66 -2" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
            {/* heat squiggles that get captured */}
            <g opacity={0.35 + 0.65 * Math.max(0, 1 - year / 1.2)} stroke="#ff6b57" strokeWidth="4" fill="none" strokeLinecap="round">
              <path className="fc-heat" d="M20 -28 q8 -12 0 -24 t0 -24" />
              <path className="fc-heat" style={{ animationDelay: '-0.8s' }} d="M52 -28 q8 -12 0 -24 t0 -24" />
              <path className="fc-heat" style={{ animationDelay: '-1.6s' }} d="M84 -28 q8 -12 0 -24 t0 -24" />
            </g>
            <text x="52" y="194" textAnchor="middle" className="fc-label">
              your servers
            </text>
          </g>

          {/* pipe with dots (constant speed) */}
          <path d="M138 196 H300" stroke="url(#fcPipe)" strokeWidth="14" strokeLinecap="round" opacity="0.35" fill="none" />
          <path d="M138 196 H300" stroke="url(#fcPipe)" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="M138 196 H300" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 20" className="fc-flow" fill="none" />

          {/* exchanger */}
          <g transform="translate(300 142)">
            <rect width="78" height="108" rx="8" fill="#ff8a3c" />
            {Array.from({ length: 7 }, (_, i) => (
              <rect key={i} x={12 + i * 9} y="14" width="5" height="80" rx="2" fill="#fff" opacity="0.8" />
            ))}
            <text x="39" y="130" textAnchor="middle" className="fc-label">
              heat swap
            </text>
          </g>

          {/* pipe to houses */}
          <path d="M378 196 H430" stroke="#ffb45c" strokeWidth="14" strokeLinecap="round" opacity="0.35" fill="none" />
          <path d="M378 196 H430" stroke="#ffb45c" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="M378 196 H430" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 20" className="fc-flow" fill="none" />

          {/* houses */}
          {Array.from({ length: HOUSES }, (_, i) => {
            const x = 430 + (i % 3) * 66;
            const y = i < 3 ? 160 : 204;
            const on = i < lit;
            return (
              <g key={i} transform={`translate(${x} ${y})`}>
                <path d="M2 24 L26 4 L50 24 Z" fill="#46506a" />
                <rect x="6" y="24" width="40" height={i < 3 ? 52 : 34} rx="2" fill="#2a3346" />
                <rect x="14" y="32" width="10" height="12" rx="1.5" fill={on ? '#ffd08a' : '#1a2130'} className={on ? 'fc-window' : undefined} />
                <rect x="30" y="32" width="10" height="12" rx="1.5" fill={on ? '#ffd08a' : '#1a2130'} className={on ? 'fc-window' : undefined} />
                <circle cx="38" cy="2" r="6" fill="#9aa4b6" opacity={smoke * 0.6} className="fc-smoke" />
              </g>
            );
          })}
          <text x="528" y="298" textAnchor="middle" className="fc-label">
            homes kept warm
          </text>

          {/* speech bubble (pops in each time the mood changes) */}
          <g transform="translate(150 34)" key={mood.slice(0, 14)} className="fc-pop">
            <rect width="340" height="42" rx="3" fill="#10141b" stroke="var(--a, #7c8bff)" strokeOpacity="0.7" />
            <path d="M20 42 l-8 14 l20 -14Z" fill="#10141b" stroke="var(--a, #7c8bff)" strokeOpacity="0.7" />
            <text x="170" y="26" textAnchor="middle" className="fc-bubble">
              {mood.length > 52 ? `${mood.slice(0, 50)}…` : mood}
            </text>
          </g>
        </svg>

        <div className="fc-jar-wrap">
          <CoinJar count={coinCount} paid={paid} label={jarLabel} />
          {burst > 0 && (
            <div className="fc-confetti" key={burst} aria-hidden="true">
              {Array.from({ length: 22 }, (_, i) => {
                const a = (i / 22) * Math.PI * 2;
                const d = 70 + (i % 4) * 22;
                return (
                  <i
                    key={i}
                    style={
                      {
                        background: CONFETTI[i % 4],
                        '--dx': `${Math.cos(a) * d}px`,
                        '--dy': `${Math.sin(a) * d - 40}px`,
                        '--r': `${i * 47}deg`,
                      } as React.CSSProperties
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="fc-meter" aria-hidden="true">
        <div className="fc-meter-top">
          <span>Pay-back meter</span>
          <b className={paid ? 'is-paid' : ''}>{paid ? `Profit ${fmtUsd(profit)}` : `${fmtUsd(Math.max(0, earned))} of ${fmtUsd(capexUsd)}`}</b>
        </div>
        <div className="fc-meter-bar">
          <i className={paid ? 'is-paid' : ''} style={{ width: `${Math.min(100, meter * 100)}%` }} />
          {markPct !== null && <u style={{ left: `${markPct}%` }} />}
        </div>
        {markPct !== null && (
          <div className="fc-meter-flag" style={{ left: `${markPct}%` }}>
            payback ≈ year {fmtNum(payYear, 1)}
          </div>
        )}
      </div>

      <div className="fc-controls">
        <button
          type="button"
          className="fc-play"
          onClick={() => {
            if (playing) onPause();
            else {
              if (finished) onYearChange(0);
              onPlay();
            }
          }}
        >
          {playing ? '❚❚ Pause' : finished ? '↺ Replay' : '▶ Play the years'}
        </button>
        <input
          type="range"
          min={0}
          max={maxYear}
          step={0.1}
          value={Math.min(year, maxYear)}
          onChange={(e) => {
            onPause();
            onYearChange(parseFloat(e.target.value));
          }}
          className="fc-slider"
          aria-label={`Time slider. ${label}`}
        />
        <span className="fc-year">{label}</span>
      </div>
      <p className="fc-note">
        {fmtNum(roundTens(outputs.homes))} homes warmed · {fmtUsd(operatorCashUsd)} a year to you · modelled, not guaranteed
      </p>
    </div>
  );
}
