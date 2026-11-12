import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Cursor } from './components/Cursor';
import { Header } from './components/Header';
import { PhaseSection } from './components/PhaseSection';
import { Preloader } from './components/Preloader';
import { SpecStrip } from './components/SpecStrip';
import { ScrollHint, Stepper } from './components/Stepper';
import { setDone, setProgress } from './data/loadStore';
import { PHASES } from './data/phases';
import { Film } from './film/Film';
import { PixiFilm } from './film/pixi/PixiFilm';
import { FilmUI } from './film/FilmUI';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { useScrollDriver } from './hooks/useScrollDriver';

const Calculator = lazy(() =>
  import('./components/calculator/Calculator').then((m) => ({ default: m.Calculator })),
);

/** 2D rewrite: same shell and styles as the 3D app, scroll-driven SVG film instead of WebGL. */
export function App() {
  const barRef = useRef<HTMLElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const { active, cameraT, scrollToPhase } = useScrollDriver(barRef, reducedMotion, !revealed);
  const [scrolled, setScrolled] = useState(false);
  const phase = PHASES[Math.min(active, PHASES.length - 1)];
  const onReveal = useCallback(() => setRevealed(true), []);
  // WebGL (Pixi + bloom) by default; ?renderer=svg forces the SVG film, and it is the fallback
  const [useSvg, setUseSvg] = useState(() => new URLSearchParams(window.location.search).get('renderer') === 'svg');
  const onPixiFail = useCallback(() => setUseSvg(true), []);

  useEffect(() => {
    document.documentElement.style.setProperty('--a', phase.accent);
  }, [phase.accent]);

  // nothing heavy to load: report ready right away (the preloader still shows its minimum time)
  useEffect(() => {
    setProgress(0.6);
    const id = requestAnimationFrame(() => setDone());
    return () => cancelAnimationFrame(id);
  }, []);

  // hide the film copy + hero number once the calculator takes over the screen
  useEffect(() => {
    const onScroll = () => {
      const calc = document.getElementById('calculator');
      const on = !!calc && calc.getBoundingClientRect().top < window.innerHeight * 0.55;
      document.documentElement.classList.toggle('in-calc', on);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <Header onHome={() => scrollToPhase(0)} />
      {useSvg ? <Film cameraT={cameraT} /> : <PixiFilm cameraT={cameraT} onFail={onPixiFail} />}
      <div className="vignette" aria-hidden="true" />
      <FilmUI active={active} reducedMotion={reducedMotion} />
      <main id="main">
        {PHASES.map((p) => (
          <PhaseSection key={p.id} phase={p} />
        ))}
      </main>
      <Suspense fallback={null}>
        <Calculator />
      </Suspense>
      <Stepper active={active} onSelect={scrollToPhase} />
      <ScrollHint show={revealed && !scrolled && active === 0} />
      <div className="bar" aria-hidden="true">
        <i
          ref={(el) => {
            barRef.current = el;
          }}
        />
      </div>
      <SpecStrip active={active} reducedMotion={reducedMotion} />
      <Cursor reducedMotion={reducedMotion} />
      <Preloader reducedMotion={reducedMotion} onReveal={onReveal} />
    </>
  );
}
