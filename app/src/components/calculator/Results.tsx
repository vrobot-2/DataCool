import { useEffect, useRef } from 'react';
import { fmtUsd, fmtNum, fmtYears, roundTens, type CalcOutputs } from '../../data/calc';

function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    
    const start = from.current;
    from.current = value;
    
    if (start === value) {
      el.textContent = format(value);
      return;
    }
    
    let raf = 0;
    const t0 = performance.now();
    const duration = 600;
    
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const current = start + (value - start) * (1 - Math.pow(1 - t, 3));
      el.textContent = format(current);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, format]);
  
  return <span ref={ref}>{format(value)}</span>;
}

function Card({ title, value, subtitle, accent }: { 
  title: string; 
  value: React.ReactNode; 
  subtitle?: string;
  accent?: boolean;
}) {
  return (
    <div className={`result-card${accent ? ' accent' : ''}`}>
      <h3 className="card-title">{title}</h3>
      <div className="card-value">{value}</div>
      {subtitle && <p className="card-subtitle">{subtitle}</p>}
    </div>
  );
}

export function Results({ outputs }: { outputs: CalcOutputs }) {
  return (
    <div className="results-panel">
      <Card
        title="Operator cash benefit"
        value={<CountUp value={outputs.operatorCashUsd} format={fmtUsd} />}
        subtitle="/ yr"
        accent
      />
      
      <Card
        title="Payback"
        value={<CountUp value={outputs.paybackYears} format={fmtYears} />}
        subtitle={`${outputs.inputs.horizonYears}-year net: ${fmtUsd(outputs.horizonNetUsd)}`}
      />
      
      <Card
        title="Heat delivered"
        value={<CountUp value={outputs.heatDeliveredMWh / 1000} format={(v) => `${fmtNum(v, 1)} GWh`} />}
        subtitle={`${fmtNum(roundTens(outputs.homes))} homes heated / yr`}
      />
      
      <Card
        title="CO₂ avoided"
        value={<CountUp value={outputs.co2Tonnes} format={(v) => `${fmtNum(v, 0)} t`} />}
        subtitle={`Carbon value: ${fmtUsd(outputs.carbonUsd)} / yr (societal)`}
      />
      
      <Card
        title="City gas bill avoided"
        value={<CountUp value={outputs.gasAvoidedUsd} format={fmtUsd} />}
        subtitle="/ yr (city benefit)"
      />
      
      <div className="result-summary">
        <p>
          A {outputs.inputs.itMW} MW site at {(outputs.inputs.loadFactor * 100).toFixed(0)}% load
          pays back in <strong>{fmtYears(outputs.paybackYears)}</strong> and keeps{' '}
          <strong>{fmtNum(roundTens(outputs.homes))}</strong> homes warm.
        </p>
      </div>
    </div>
  );
}
