import { useEffect, useRef, useState } from 'react';
import { PRESETS, type CalcInputs, type InputSpec } from '../../data/calc';

const MAIN: Partial<Record<keyof CalcInputs, { title: string; hint: string }>> = {
  itMW: { title: 'How big is your data centre?', hint: 'Total IT capacity. Bigger sites recover more heat.' },
  electricityUsdPerKWh: { title: 'What do you pay for electricity?', hint: 'Cooling is mostly electricity, so this drives your savings.' },
  heatUsdPerMWh: { title: 'What will the city pay for your heat?', hint: 'Set to $0 if you would give it away for free.' },
};

const SIZE_BLURB: Record<string, string> = {
  edge: 'A small local site. Quick to build.',
  enterprise: 'A typical campus. Our starting point.',
  hyperscale: 'A very large site. Biggest heat output.',
};

const MAIN_KEYS = Object.keys(MAIN) as (keyof CalcInputs)[];

/** Eases a displayed number toward `target` (rAF), so values roll instead of jumping. */
function useTween(target: number, ms = 320): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const cur = useRef(target);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cur.current = target;
      setShown(target);
      return;
    }
    from.current = cur.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      cur.current = from.current + (target - from.current) * e;
      setShown(cur.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

function Slider({ spec, inputs, onUpdate, title, hint, index }: {
  spec: InputSpec;
  inputs: CalcInputs;
  onUpdate: (key: keyof CalcInputs, value: number) => void;
  title?: string;
  hint?: string;
  index: number;
}) {
  const value = inputs[spec.key];
  const display = value * spec.scale;
  const pct = Math.min(100, Math.max(0, ((value - spec.min) / (spec.max - spec.min)) * 100));
  const rolling = useTween(display);
  const [dragging, setDragging] = useState(false);
  const [pulse, setPulse] = useState(0);
  const first = useRef(true);

  // retrigger the thumb ring whenever the value changes
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPulse((p) => p + 1);
  }, [value]);

  return (
    <div className="fc-field" style={{ ['--i' as string]: index } as React.CSSProperties}>
      <label htmlFor={`in-${spec.key}`} className="fc-field-title">
        {title ?? spec.label}
      </label>
      {hint && <p className="fc-field-hint">{hint}</p>}
      <div className={`fc-slider-box${dragging ? ' is-dragging' : ''}`} style={{ ['--pct' as string]: `${pct}%` } as React.CSSProperties}>
        <div className="fc-track" aria-hidden="true">
          {Array.from({ length: 11 }, (_, i) => (
            <u key={i} style={{ left: `${i * 10}%` }} className={i * 10 <= pct ? 'is-lit' : ''} />
          ))}
          <i className="fc-fill" />
          <b className="fc-thumb">
            <span key={pulse} className="fc-ring" />
            <em className="fc-bubble-val">
              {rolling.toFixed(spec.decimals)}
              <small>{spec.unit}</small>
            </em>
          </b>
        </div>
        <input
          id={`in-${spec.key}`}
          type="range"
          min={spec.min * spec.scale}
          max={spec.max * spec.scale}
          step={spec.step * spec.scale}
          value={display}
          onChange={(e) => onUpdate(spec.key, parseFloat(e.target.value) / spec.scale)}
          onPointerDown={() => setDragging(true)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onBlur={() => setDragging(false)}
          data-cursor="money"
          aria-label={`${title ?? spec.label}: ${display.toFixed(spec.decimals)} ${spec.unit}`}
        />
      </div>
      <div className="fc-range-ends" aria-hidden="true">
        <span>
          {(spec.min * spec.scale).toFixed(spec.decimals)} {spec.unit}
        </span>
        <span>
          {(spec.max * spec.scale).toFixed(spec.decimals)} {spec.unit}
        </span>
      </div>
    </div>
  );
}

export function Inputs({
  inputs,
  specs,
  onUpdate,
  onPreset,
  onReset,
}: {
  inputs: CalcInputs;
  specs: InputSpec[];
  onUpdate: (key: keyof CalcInputs, value: number) => void;
  onPreset: (preset: Partial<CalcInputs>) => void;
  onReset: () => void;
}) {
  const sliders = specs.filter((s) => s.control === 'slider');
  const main = MAIN_KEYS.map((k) => sliders.find((s) => s.key === k)).filter(Boolean) as InputSpec[];
  const more = sliders.filter((s) => !MAIN_KEYS.includes(s.key));
  const sizeId = PRESETS.find((p) => (p.patch.itMW ?? 15) === inputs.itMW)?.id;

  return (
    <div className="fc-inputs">
      <p className="fc-eyebrow">
        <i>01</i> Starting point
      </p>
      <div className="fc-sizes" role="group" aria-label="Site size presets">
        {PRESETS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className={`fc-size${sizeId === p.id ? ' is-on' : ''}`}
            style={{ ['--i' as string]: i } as React.CSSProperties}
            onClick={() => onPreset({ ...p.patch })}
            aria-pressed={sizeId === p.id}
          >
            <b>{p.label.replace(/ \d+ MW/, '')}</b>
            <span>{p.label.match(/\d+ MW/)?.[0]}</span>
            <small>{SIZE_BLURB[p.id]}</small>
          </button>
        ))}
      </div>

      <p className="fc-eyebrow">
        <i>02</i> Three questions
      </p>
      {main.map((spec, i) => (
        <Slider key={spec.key} spec={spec} inputs={inputs} onUpdate={onUpdate} title={MAIN[spec.key]?.title} hint={MAIN[spec.key]?.hint} index={i} />
      ))}

      <details className="fc-more">
        <summary>
          <span>Fine-tune more assumptions</span>
          <small>optional</small>
        </summary>
        <div className="fc-more-body">
          <div className="fc-more-inner">
            {more.map((spec, i) => (
              <Slider key={spec.key} spec={spec} inputs={inputs} onUpdate={onUpdate} index={i} />
            ))}
            <div className="fc-field">
              <span className="fc-field-title">How many years to look ahead?</span>
              <div className="fc-years">
                {[5, 10, 15].map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={inputs.horizonYears === y ? 'is-on' : ''}
                    onClick={() => onUpdate('horizonYears', y)}
                    aria-pressed={inputs.horizonYears === y}
                  >
                    {y} years
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </details>

      <button type="button" className="fc-reset" onClick={onReset}>
        ↺ Start over
      </button>
    </div>
  );
}
