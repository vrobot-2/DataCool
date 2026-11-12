import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getLoad, subscribeLoad } from '../data/loadStore';
import { Logo } from './Logo';

const STATUS = ['Loading geometry', 'Baking light', 'Spinning up loop'];
const MIN_MS = 900;
const TIMEOUT_MS = 12000;
const REVEAL_MS = 1000;

/**
 * Full-screen loader. Waits for the scene (loadStore), web fonts and a minimum display
 * time, gives up after 12 s (the app has a procedural fallback), then wipes away.
 * `onReveal` fires as the wipe starts so scrolling can unlock.
 */
export function Preloader({ reducedMotion, onReveal }: { reducedMotion: boolean; onReveal: () => void }) {
  const load = useSyncExternalStore(subscribeLoad, getLoad, getLoad);
  const [fonts, setFonts] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'leaving' | 'gone'>('loading');
  const [status, setStatus] = useState(0);
  const [minElapsed, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const fill = useRef<HTMLElement | null>(null);
  const pct = useRef<HTMLElement | null>(null);
  const shown = useRef(0);
  const target = useRef(0);

  useEffect(() => {
    let alive = true;
    const ready = document.fonts?.ready ?? Promise.resolve();
    ready.then(() => alive && setFonts(true), () => alive && setFonts(true));
    const min = window.setTimeout(() => setMinElapsed(true), MIN_MS);
    const max = window.setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    const cycle = window.setInterval(() => setStatus((s) => (s + 1) % STATUS.length), 1100);
    return () => {
      alive = false;
      clearTimeout(min);
      clearTimeout(max);
      clearInterval(cycle);
    };
  }, []);

  const complete = (load.done && fonts && minElapsed) || timedOut;
  target.current = complete ? 1 : Math.min(0.96, 0.08 * Number(fonts) + 0.9 * load.progress);

  // smoothed progress bar + mono percentage (imperative: no re-render per frame)
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      shown.current += (target.current - shown.current) * 0.12;
      if (Math.abs(target.current - shown.current) < 0.002) shown.current = target.current;
      if (fill.current) fill.current.style.transform = `scaleX(${shown.current.toFixed(4)})`;
      if (pct.current) pct.current.textContent = `${String(Math.round(shown.current * 100)).padStart(3, '0')}`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!complete || phase !== 'loading') return;
    // let the bar visibly reach 100 first
    const lead = window.setTimeout(() => {
      setPhase('leaving');
      onReveal();
    }, reducedMotion ? 0 : 260);
    return () => clearTimeout(lead);
  }, [complete, phase, reducedMotion, onReveal]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const t = window.setTimeout(() => setPhase('gone'), reducedMotion ? 350 : REVEAL_MS + 60);
    return () => clearTimeout(t);
  }, [phase, reducedMotion]);

  if (phase === 'gone') return null;

  return (
    <div
      className={`preloader${phase === 'leaving' ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="preloader-inner">
        <Logo className="preloader-logo" animated />
        <div className="preloader-bar" aria-hidden="true">
          <i
            ref={(el) => {
              fill.current = el;
            }}
          />
        </div>
        <div className="preloader-meta">
          <span key={status} className="preloader-status">
            {STATUS[status]}
          </span>
          <span className="preloader-pct">
            <b
              ref={(el) => {
                pct.current = el;
              }}
            >
              000
            </b>
            %
          </span>
        </div>
      </div>
    </div>
  );
}
