import { useEffect, useRef } from 'react';

/**
 * Custom cursor: dot + lagging ring + soft accent glow, magnetic [data-magnetic] elements.
 * The ring grows over links, buttons and [data-magnetic] elements, and turns --money over
 * calculator sliders ([data-cursor="money"]). Fine pointers only, off under
 * prefers-reduced-motion. The native cursor is hidden only after the first real pointer
 * move, so if anything here fails to mount the native cursor stays.
 */
export function Cursor({ reducedMotion }: { reducedMotion: boolean }) {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dotEl = dot.current;
    const ringEl = ring.current;
    const glowEl = glow.current;
    if (reducedMotion || !dotEl || !ringEl || !glowEl) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const root = document.documentElement;
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let gx = mx;
    let gy = my;
    let seen = false;
    let pressed = false;
    let raf = 0;
    const offsets = new Map<HTMLElement, { x: number; y: number }>();

    const show = (on: boolean) => root.classList.toggle('has-cursor', on);

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX;
      my = e.clientY;
      if (!seen) {
        seen = true;
        rx = gx = mx;
        ry = gy = my;
        show(true);
      }
      const target = e.target as Element | null;
      const over = target?.closest?.('a,button,[data-magnetic],input[type="range"]');
      ringEl.classList.toggle('is-link', !!over);
      ringEl.classList.toggle('is-money', !!target?.closest?.('[data-cursor="money"]'));
    };
    const onLeave = () => seen && show(false);
    const onEnter = () => seen && show(true);
    const onDown = () => {
      pressed = true;
      ringEl.classList.add('is-down');
    };
    const onUp = () => {
      pressed = false;
      ringEl.classList.remove('is-down');
    };

    const tick = () => {
      rx += (mx - rx) * 0.17;
      ry += (my - ry) * 0.17;
      gx += (mx - gx) * 0.07;
      gy += (my - gy) * 0.07;
      dotEl.style.transform = `translate3d(${mx}px,${my}px,0) scale(${pressed ? 0.6 : 1})`;
      ringEl.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      glowEl.style.transform = `translate3d(${gx}px,${gy}px,0)`;

      document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
        const off = offsets.get(el) ?? { x: 0, y: 0 };
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2 - off.x;
        const cy = r.top + r.height / 2 - off.y;
        const near = Math.hypot(mx - cx, my - cy) < Math.max(r.width, r.height) / 2 + 36;
        off.x += ((near ? (mx - cx) * 0.3 : 0) - off.x) * 0.2;
        off.y += ((near ? (my - cy) * 0.3 : 0) - off.y) * 0.2;
        offsets.set(el, off);
        el.style.translate = Math.abs(off.x) + Math.abs(off.y) < 0.05 ? '' : `${off.x.toFixed(2)}px ${off.y.toFixed(2)}px`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.documentElement.addEventListener('mouseleave', onLeave);
    document.documentElement.addEventListener('mouseenter', onEnter);

    return () => {
      cancelAnimationFrame(raf);
      show(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.documentElement.removeEventListener('mouseenter', onEnter);
      offsets.forEach((_, el) => (el.style.translate = ''));
    };
  }, [reducedMotion]);

  return (
    <div className="cursor" aria-hidden="true">
      <div ref={glow} className="cursor-glow" />
      <div ref={ring} className="cursor-ring" />
      <div ref={dot} className="cursor-dot" />
    </div>
  );
}
