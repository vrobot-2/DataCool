import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import Lenis from 'lenis';
import { PHASES } from '../data/phases';

interface ScrollDriver {
  active: number;
  cameraT: MutableRefObject<number>;
  progress: MutableRefObject<number>;
  scrollToPhase: (index: number) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Lenis smooth scrolling plus a single rAF-throttled scroll listener that
 * publishes (a) overall page progress and (b) a continuous camera parameter
 * (0..PHASES.length-1) derived from the centre of each section.
 *
 * `locked` freezes scrolling (preloader). DOM writes for the progress bar are
 * imperative so scrolling does not re-render the React tree every frame.
 */
export function useScrollDriver(
  barRef: RefObject<HTMLElement | null>,
  reducedMotion: boolean,
  locked: boolean,
): ScrollDriver {
  const cameraT = useRef(0);
  const progress = useRef(0);
  const anchorsRef = useRef<number[]>([]);
  const lenisRef = useRef<Lenis | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('section[data-phase]'));
    if (!sections.length) return;

    const measure = () => {
      const vh = window.innerHeight;
      anchorsRef.current = sections.map((el) => {
        const rect = el.getBoundingClientRect();
        return Math.max(0, rect.top + window.scrollY + rect.height / 2 - vh / 2);
      });
      update();
    };

    const update = () => {
      const anchors = anchorsRef.current;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      progress.current = max > 0 ? clamp(y / max, 0, 1) : 0;
      if (barRef.current) barRef.current.style.width = `${(progress.current * 100).toFixed(3)}%`;

      if (anchors.length > 1) {
        if (y <= anchors[0]) {
          cameraT.current = 0;
        } else if (y >= anchors[anchors.length - 1]) {
          // last section (PHASE_COUNT-1); cameraT runs 0..8 for 9 scroll sections
          cameraT.current = PHASES.length - 1;
        } else {
          for (let i = 0; i < anchors.length - 1; i++) {
            if (y < anchors[i + 1]) {
              cameraT.current = i + (y - anchors[i]) / (anchors[i + 1] - anchors[i] || 1);
              break;
            }
          }
        }
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) {
            best = entry;
          }
        }
        if (best) setActive(Number((best.target as HTMLElement).dataset.phase ?? 0));
      },
      { threshold: [0.5] },
    );
    sections.forEach((el) => observer.observe(el));

    let raf = 0;
    if (!reducedMotion) {
      const lenis = new Lenis({
        duration: 1.15,
        smoothWheel: true,
        wheelMultiplier: 0.92,
        touchMultiplier: 1.2,
      });
      lenisRef.current = lenis;
      const loop = (time: number) => {
        lenis.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', measure);
    measure();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, [barRef, reducedMotion]);

  // preloader lock
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('is-locked', locked);
    if (locked) {
      lenisRef.current?.stop();
      window.scrollTo(0, 0);
    } else {
      lenisRef.current?.start();
    }
  }, [locked, reducedMotion]);

  const scrollToPhase = useCallback((index: number) => {
    const y = anchorsRef.current[clamp(index, 0, anchorsRef.current.length - 1)] ?? 0;
    const lenis = lenisRef.current;
    if (lenis) lenis.scrollTo(y, { duration: 1.6 });
    else window.scrollTo({ top: y, behavior: 'auto' });
  }, []);

  return { active, cameraT, progress, scrollToPhase };
}
