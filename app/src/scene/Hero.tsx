import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { calc, DEFAULTS, fmtUsd, fmtNum, roundTens } from '../data/calc';
import { SHOTS, getCurrentShot } from './shots';

/**
 * Hero figures: one huge number per shot, pinned in 3D with a count-up animation.
 * Numbers derive from calc(DEFAULTS) so they match the calculator.
 * 
 * Shot-to-figure mapping (from docs/numbers-and-calculator.md §2):
 *   0 intro:       Operator cash benefit / yr
 *   1 rack:        Cooling bill avoided / yr
 *   2 manifold:    Sealed flow carrying X MW
 *   3 hall:        Heat captured, not exhausted
 *   4 plant:       Heat revenue / yr
 *   5 follow:      Heat delivered / yr (GWh)
 *   6 underground: City gas bill avoided / yr
 *   7 city:        Homes heated
 *   8 close:       Payback
 */

const M = calc(DEFAULTS);

interface HeroFigure {
  shotIndex: number;
  value: number;
  label: string;
  format: (v: number) => string;
  unit?: string;
}

const HERO_FIGURES: HeroFigure[] = [
  {
    shotIndex: 0,
    value: M.operatorCashUsd,
    label: 'Operator cash benefit',
    format: fmtUsd,
    unit: '/ yr',
  },
  {
    shotIndex: 1,
    value: M.coolingSavedUsd,
    label: 'Cooling bill avoided',
    format: fmtUsd,
    unit: '/ yr',
  },
  {
    shotIndex: 2,
    value: M.flowLps,
    label: `Sealed flow carrying ${fmtNum(M.heatMWth, 1)} MW`,
    format: (v) => `${fmtNum(v, 1)} L/s`,
  },
  {
    shotIndex: 3,
    value: M.capturedMWth,
    label: 'Heat captured, not exhausted',
    format: (v) => `${fmtNum(v, 1)} MW`,
  },
  {
    shotIndex: 4,
    value: M.heatRevenueUsd,
    label: 'Heat revenue',
    format: fmtUsd,
    unit: '/ yr',
  },
  {
    shotIndex: 5,
    value: M.heatDeliveredMWh / 1000,
    label: 'Heat delivered',
    format: (v) => `${fmtNum(v, 1)} GWh`,
    unit: '/ yr',
  },
  {
    shotIndex: 6,
    value: M.gasAvoidedUsd,
    label: 'City gas bill avoided',
    format: fmtUsd,
    unit: '/ yr',
  },
  {
    shotIndex: 7,
    value: roundTens(M.homes),
    label: 'Homes heated',
    format: (v) => fmtNum(Math.round(v), 0),
  },
  {
    shotIndex: 8,
    value: M.paybackYears,
    label: 'Payback',
    format: (v) => `${fmtNum(v, 1)} yr`,
  },
];

/** 1 when in hold zone, 0 outside it. */
function holdWeight(t: number, shotIndex: number): number {
  const { shot, fraction } = getCurrentShot(t);
  if (shot.id !== SHOTS[shotIndex].id) return 0;
  
  const hold = shot.hold ?? [0.3, 0.7];
  if (fraction < hold[0] || fraction > hold[1]) return 0;
  
  // Fade in at start of hold, fade out at end
  const fadeIn = Math.min(1, (fraction - hold[0]) / 0.1);
  const fadeOut = Math.min(1, (hold[1] - fraction) / 0.1);
  return Math.min(fadeIn, fadeOut);
}

function HeroNumber({
  figure,
  cameraT,
  reducedMotion,
}: {
  figure: HeroFigure;
  cameraT: MutableRefObject<number>;
  reducedMotion: boolean;
}) {
  const shot = SHOTS[figure.shotIndex];
  const root = useRef<HTMLDivElement>(null);
  const countRef = useRef(0);
  const targetRef = useRef(figure.value);
  const inHoldRef = useRef(false);
  const anchor = useMemo(() => new THREE.Vector3(...shot.heroAnchor), [shot]);

  useFrame(({ size }) => {
    const el = root.current;
    if (!el) return;

    const w = holdWeight(cameraT.current, figure.shotIndex);
    const inHold = w > 0.5;

    // Trigger count-up when entering hold zone
    if (inHold && !inHoldRef.current && !reducedMotion) {
      inHoldRef.current = true;
      countRef.current = 0;
      targetRef.current = figure.value;
    } else if (!inHold) {
      inHoldRef.current = false;
    }

    // Count up over ~1.2s
    if (inHoldRef.current && countRef.current < targetRef.current) {
      countRef.current = Math.min(
        targetRef.current,
        countRef.current + targetRef.current * 0.025
      );
    }

    const displayValue = reducedMotion || !inHoldRef.current 
      ? figure.value 
      : countRef.current;

    el.style.opacity = w.toFixed(3);
    el.style.visibility = w > 0.01 ? 'visible' : 'hidden';
    
    // Scale based on viewport
    const narrow = size.width < 700;
    const scale = narrow ? 0.6 : 0.85;
    el.style.setProperty('--hero-scale', scale.toFixed(2));

    // Update the number
    const valueEl = el.querySelector('.hero-value');
    if (valueEl) {
      valueEl.textContent = figure.format(displayValue);
    }
  });

  return (
    <Html
      position={anchor}
      center
      distanceFactor={8}
      zIndexRange={[100, 0]}
      className="hero-container"
    >
      <div ref={root} className="hero" style={{ visibility: 'hidden', opacity: 0 }}>
        <div className="hero-value" aria-live="polite">
          {figure.format(figure.value)}
        </div>
        {figure.unit && <div className="hero-unit">{figure.unit}</div>}
        <div className="hero-label">{figure.label}</div>
      </div>
    </Html>
  );
}

/**
 * Render all hero figures. Each one is visible only when its shot is in the hold zone.
 */
export function Hero({
  cameraT,
  reducedMotion,
}: {
  cameraT: MutableRefObject<number>;
  reducedMotion: boolean;
}) {
  return (
    <>
      {HERO_FIGURES.map((fig) => (
        <HeroNumber
          key={fig.shotIndex}
          figure={fig}
          cameraT={cameraT}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  );
}
