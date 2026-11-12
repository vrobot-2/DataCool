import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { Cursor } from './components/Cursor';
import { Header } from './components/Header';
import { PhaseSection } from './components/PhaseSection';
import { Preloader } from './components/Preloader';
import { SpecStrip } from './components/SpecStrip';
import { ScrollHint, Stepper } from './components/Stepper';
import { setDone } from './data/loadStore';
import { PHASES } from './data/phases';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { useScrollDriver } from './hooks/useScrollDriver';

const Stage = lazy(() => import('./components/Stage').then((m) => ({ default: m.Stage })));
const Calculator = lazy(() => import('./components/calculator/Calculator').then((m) => ({ default: m.Calculator })));

/** Keeps the Spec Sheet usable if WebGL, the scene chunk or the scene itself throws. */
class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[DataCool] 3D stage disabled:', error, info.componentStack);
    setDone(); // never leave the preloader waiting on a scene that will not come
  }

  render() {
    if (this.state.failed) {
      return <div className="stage-fallback" role="img" aria-label="3D view unavailable" />;
    }
    return this.props.children;
  }
}

export function App() {
  const barRef = useRef<HTMLElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const { active, cameraT, scrollToPhase } = useScrollDriver(barRef, reducedMotion, !revealed);
  const [scrolled, setScrolled] = useState(false);
  const phase = PHASES[Math.min(active, PHASES.length - 1)];
  const onReveal = useCallback(() => setRevealed(true), []);

  useEffect(() => {
    document.documentElement.style.setProperty('--a', phase.accent);
  }, [phase.accent]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <Header onHome={() => scrollToPhase(0)} />
      <div className="stage" aria-hidden="true">
        <StageBoundary>
          <Suspense fallback={null}>
            <Stage cameraT={cameraT} accent={phase.accent} reducedMotion={reducedMotion} />
          </Suspense>
        </StageBoundary>
      </div>
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
