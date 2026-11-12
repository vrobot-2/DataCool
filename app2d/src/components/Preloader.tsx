import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getLoad, subscribeLoad } from '../data/loadStore';
import { Logo } from './Logo';
import './preloader.css';

const STATUS = ['Loading geometry', 'Baking light', 'Spinning up loop'];
const MIN_MS = 900;
const TIMEOUT_MS = 12000;
const SOLIDIFY_MS = 700; // logo fills + flashes
const DISSOLVE_MS = 900; // whole overlay fades / blurs / scales away

type Phase = 'loading' | 'solidify' | 'dissolve' | 'gone';

/**
 * Full-screen loader. Waits for the scene (loadStore), web fonts and a minimum display
 * time, gives up after 12 s (the app has a procedural fallback).
 * loading -> solidify (bar hits 100 %, outline logo fills with an accent flash)
 * -> dissolve (overlay fades; `onReveal` fires at its START so the page already runs behind it) -> gone.
 */
export function Preloader({ reducedMotion, onReveal }: { reducedMotion: boolean; onReveal: () => void }) {
  const load = useSyncExternalStore(subscribeLoad, getLoad, getLoad);
  const [fonts, setFonts] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState(0);
  const [minElapsed, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const fill = useRef<HTMLElement | null>(null);
  const pct = useRef<HTMLElement | null>(null);
  const shown = useRef(0);
  const target = useRef(0);
  const reveal = useRef(onReveal);
  reveal.current = onReveal;

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

  // smoothed progress bar + mono percentage (imperative: no re-render per frame).
  // The frame the bar actually reaches 100 % flips loading -> solidify.
  useEffect(() => {
    let raf = 0;
    let full = false;
    const tick = () => {
      shown.current += (target.current - shown.current) * 0.12;
      if (Math.abs(target.current - shown.current) < 0.002) shown.current = target.current;
      const p = shown.current;
      if (fill.current) fill.current.style.transform = `scaleX(${p.toFixed(4)})`;
      if (pct.current) pct.current.textContent = `${String(Math.round(p * 100)).padStart(3, '0')}`;
      root.current?.style.setProperty('--pl-p', p.toFixed(3));
      if (!full && target.current >= 1 && p >= 1) {
        full = true;
        setPhase((ph) => (ph === 'loading' ? 'solidify' : ph));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (phase !== 'solidify') return;
    const t = window.setTimeout(
      () => {
        setPhase('dissolve');
        reveal.current(); // page underneath starts at the beginning of the fade
      },
      reducedMotion ? 0 : SOLIDIFY_MS,
    );
    return () => clearTimeout(t);
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (phase !== 'dissolve') return;
    const t = window.setTimeout(() => setPhase('gone'), reducedMotion ? 350 : DISSOLVE_MS + 60);
    return () => clearTimeout(t);
  }, [phase, reducedMotion]);

  if (phase === 'gone') return null;

  const solid = phase === 'solidify' || phase === 'dissolve';

  return (
    <div
      ref={root}
      className={`preloader${phase === 'solidify' ? ' is-solidify' : ''}${phase === 'dissolve' ? ' is-dissolve' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="preloader-inner">
        <Logo className="preloader-logo" animated solid={solid} />
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
