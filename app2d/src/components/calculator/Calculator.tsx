import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calc, DEFAULTS, INPUT_SPECS, type CalcInputs } from '../../data/calc';
import { ctaHref } from '../../data/site';
import { Cartoon } from './Cartoon';
import { Charts } from './Charts';
import { Inputs } from './Inputs';
import { Results } from './Results';
import './friendly.css';

/**
 * End-of-page calculator, friendly version: pick a size, answer three questions, watch
 * the savings play out. Everything derives from calc(); state lives in the URL hash.
 */

function hashToInputs(hash: string): Partial<CalcInputs> {
  const partial: Partial<CalcInputs> = {};
  const params = new URLSearchParams(hash.slice(1));
  for (const spec of INPUT_SPECS) {
    const value = params.get(spec.param);
    if (value === null) continue;
    const num = parseFloat(value);
    if (Number.isFinite(num)) partial[spec.key] = num / spec.scale;
  }
  return partial;
}

function inputsToParams(inputs: CalcInputs): URLSearchParams {
  const params = new URLSearchParams();
  for (const spec of INPUT_SPECS) {
    const value = inputs[spec.key];
    if (value !== DEFAULTS[spec.key]) params.set(spec.param, (value * spec.scale).toFixed(spec.decimals));
  }
  return params;
}

export function Calculator() {
  const [inputs, setInputs] = useState<CalcInputs>(() =>
    typeof window !== 'undefined' && window.location.hash ? { ...DEFAULTS, ...hashToInputs(window.location.hash) } : DEFAULTS,
  );
  const [year, setYear] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [isIn, setIsIn] = useState(false);
  const section = useRef<HTMLElement | null>(null);
  const autoPlayed = useRef(false);

  const outputs = useMemo(() => calc(inputs), [inputs]);

  // keep the shareable link in the URL hash
  useEffect(() => {
    const str = inputsToParams(inputs).toString();
    const hash = str ? `#${str}` : '';
    if (hash !== window.location.hash) window.history.replaceState(null, '', hash || window.location.pathname + window.location.search);
  }, [inputs]);

  // play once, the first time the diagram scrolls into view
  useEffect(() => {
    const el = section.current;
    if (!el || autoPlayed.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !autoPlayed.current) {
          autoPlayed.current = true;
          setIsIn(true);
          setYear(0);
          setPlaying(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const updateInput = useCallback((key: keyof CalcInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }, []);
  const loadPreset = useCallback((patch: Partial<CalcInputs>) => {
    setInputs({ ...DEFAULTS, ...patch });
    setYear(0);
    setPlaying(true);
  }, []);
  const reset = useCallback(() => {
    setInputs(DEFAULTS);
    setYear(0);
    setPlaying(false);
  }, []);
  const onPlay = useCallback(() => setPlaying(true), []);
  const onPause = useCallback(() => setPlaying(false), []);
  const onPlayComplete = useCallback(() => setPlaying(false), []);

  // keep the year inside the horizon when it changes
  useEffect(() => {
    setYear((y) => Math.min(y, inputs.horizonYears));
  }, [inputs.horizonYears]);

  const ctaParams = Object.fromEntries(inputsToParams(inputs));
  const href = ctaHref(ctaParams);

  return (
    <section className={`calculator${isIn ? ' is-in' : ''}`} id="calculator" ref={section}>
      <header className="calc-header">
        <p className="fc-eyebrow">
          <i>00</i> Your numbers
        </p>
        <h2>What could you save?</h2>
        <p className="calc-lede">
          Pick a starting point, answer three quick questions, and watch the money add up. No spreadsheet needed.
        </p>
      </header>

      <div className="fc-grid">
        <Inputs inputs={inputs} specs={INPUT_SPECS} onUpdate={updateInput} onPreset={loadPreset} onReset={reset} />

        <div className="fc-main">
          <p className="fc-eyebrow">
            <i>03</i> Watch it add up
          </p>
          <Results outputs={outputs} />
          <Cartoon
            outputs={outputs}
            year={year}
            onYearChange={setYear}
            playing={playing}
            onPlay={onPlay}
            onPause={onPause}
            onPlayComplete={onPlayComplete}
          />
        </div>
      </div>

      <div className="fc-details">
        <h3>The details, if you like graphs</h3>
        <Charts outputs={outputs} />
      </div>

      <div className="fc-cta">
        <h3>Customise your solution</h3>
        <p>Turn these numbers into a plan for your site. We will pre-fill what you chose here.</p>
        {href ? (
          <a className="fc-cta-btn" href={href} target="_blank" rel="noopener noreferrer">
            Customise your solution →
          </a>
        ) : (
          <button type="button" className="fc-cta-btn is-pending" disabled title="Link not set yet (VITE_CTA_URL)">
            Customise your solution →
          </button>
        )}
      </div>

      <footer className="calc-footer">
        <small>Modelled · every assumption is editable above · estimates for planning, not guarantees</small>
      </footer>
    </section>
  );
}
