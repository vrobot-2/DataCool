import { useEffect, useRef } from 'react';
import { PHASES, type Metric } from '../data/phases';

const nf = (value: number, decimals: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function Ticker({ value, decimals, reducedMotion }: { value: number; decimals: number; reducedMotion: boolean }) {
  const node = useRef<HTMLElement | null>(null);
  const from = useRef(0);

  useEffect(() => {
    const el = node.current;
    if (!el) return;
    const start = from.current;
    from.current = value;
    if (reducedMotion || start === value) {
      el.textContent = nf(value, decimals);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 820);
      el.textContent = nf(start + (value - start) * (1 - Math.pow(1 - t, 3)), decimals);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, decimals, reducedMotion]);

  return (
    <b
      ref={(el) => {
        node.current = el;
      }}
    >
      {nf(value, decimals)}
    </b>
  );
}

function Cell({ metric, usd, reducedMotion }: { metric: Metric; usd?: boolean; reducedMotion: boolean }) {
  const decimals = metric.decimals ?? 0;
  return (
    <div className={usd ? 'usd' : undefined}>
      <span className="k">{metric.label}</span>
      <span className="v">
        {metric.prefix && <small className="pre">{metric.prefix}</small>}
        <Ticker value={metric.value} decimals={decimals} reducedMotion={reducedMotion} />
        {metric.unit && <small>{metric.unit}</small>}
      </span>
    </div>
  );
}

export function SpecStrip({ active, reducedMotion }: { active: number; reducedMotion: boolean }) {
  const last = PHASES.length - 1;
  const phase = PHASES[Math.min(active, last)];
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <footer className="strip" aria-label="Current phase specification">
      <div>
        <span className="k">Phase {pad(Math.min(active, last))} / {pad(last)}</span>
        <span className="t" aria-live="polite">
          {phase.stripTitle}
        </span>
      </div>
      <Cell metric={phase.metrics[0]} reducedMotion={reducedMotion} />
      <Cell metric={phase.metrics[1]} usd reducedMotion={reducedMotion} />
      <div className="sec">
        <span className="foot">Modelled · assumptions in source</span>
        <span className="track" aria-hidden="true">
          <i style={{ width: `${((Math.min(active, last) + 1) / PHASES.length) * 100}%` }} />
        </span>
      </div>
    </footer>
  );
}
