import { useState, useCallback, useMemo, useEffect } from 'react';
import { calc, DEFAULTS, INPUT_SPECS, type CalcInputs } from '../../data/calc';
import { Inputs } from './Inputs';
import { Cartoon } from './Cartoon';
import { Charts } from './Charts';
import { Results } from './Results';

/**
 * End-of-page calculator with inputs, cartoon diagram, graphs and headline figures.
 * Numbers derive from calc() so they match the scroll story exactly. State is kept
 * in the URL hash for sharing. Lazy-loaded when the section nears viewport.
 * 
 * Layout: left = inputs, centre = cartoon, right = results; graphs below; mobile stacked.
 */

// URL hash state encoding/decoding
function hashToInputs(hash: string): Partial<CalcInputs> {
  const partial: Partial<CalcInputs> = {};
  const params = new URLSearchParams(hash.slice(1));
  
  for (const spec of INPUT_SPECS) {
    const value = params.get(spec.param);
    if (value !== null) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        partial[spec.key] = num / spec.scale;
      }
    }
  }
  
  return partial;
}

function inputsToHash(inputs: CalcInputs): string {
  const params = new URLSearchParams();
  
  for (const spec of INPUT_SPECS) {
    const value = inputs[spec.key];
    if (value !== DEFAULTS[spec.key]) {
      params.set(spec.param, (value * spec.scale).toFixed(spec.decimals));
    }
  }
  
  const str = params.toString();
  return str ? `#${str}` : '';
}

export function Calculator() {
  const [inputs, setInputs] = useState<CalcInputs>(() => {
    // Load from URL hash on mount
    if (typeof window !== 'undefined' && window.location.hash) {
      const partial = hashToInputs(window.location.hash);
      return { ...DEFAULTS, ...partial };
    }
    return DEFAULTS;
  });
  
  const [year, setYear] = useState(0);
  const [playing, setPlaying] = useState(false);
  
  const outputs = useMemo(() => calc(inputs), [inputs]);
  
  // Update URL hash when inputs change
  useEffect(() => {
    const hash = inputsToHash(inputs);
    if (hash !== window.location.hash) {
      window.history.replaceState(null, '', hash || window.location.pathname);
    }
  }, [inputs]);
  
  // Auto-play animation on first intersection
  const [hasPlayed, setHasPlayed] = useState(false);
  
  const updateInput = useCallback((key: keyof CalcInputs, value: number) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  }, []);
  
  const loadPreset = useCallback((preset: Partial<CalcInputs>) => {
    setInputs(prev => ({ ...prev, ...preset }));
  }, []);
  
  const reset = useCallback(() => {
    setInputs(DEFAULTS);
    setYear(0);
    setPlaying(false);
  }, []);
  
  const onPlayComplete = useCallback(() => {
    setPlaying(false);
    if (!hasPlayed) setHasPlayed(true);
  }, [hasPlayed]);
  
  return (
    <section className="calculator" id="calculator">
      <header className="calc-header">
        <h2>Model your numbers</h2>
        <p className="calc-lede">
          Every figure on this page is modelled from these assumptions. Adjust them to see your
          case.
        </p>
      </header>
      
      <div className="calc-grid">
        <div className="calc-inputs">
          <Inputs
            inputs={inputs}
            specs={INPUT_SPECS}
            onUpdate={updateInput}
            onPreset={loadPreset}
            onReset={reset}
          />
        </div>
        
        <div className="calc-cartoon">
          <Cartoon
            outputs={outputs}
            year={year}
            onYearChange={setYear}
            playing={playing}
            onPlay={() => setPlaying(true)}
            onPlayComplete={onPlayComplete}
          />
        </div>
        
        <div className="calc-results">
          <Results outputs={outputs} />
        </div>
      </div>
      
      <div className="calc-charts">
        <Charts outputs={outputs} />
      </div>
      
      <footer className="calc-footer">
        <small>
          Modelled · assumptions editable above · results are estimates for planning purposes
        </small>
      </footer>
    </section>
  );
}
