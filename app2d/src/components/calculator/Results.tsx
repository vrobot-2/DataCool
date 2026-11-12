import { useEffect, useRef } from 'react';
import { fmtNum, fmtUsd, fmtYears, roundTens, type CalcOutputs } from '../../data/calc';

function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = Number.isFinite(from.current) ? from.current : 0;
    from.current = value;
    if (start === value || !Number.isFinite(value)) {
      el.textContent = format(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 600);
      el.textContent = format(start + (value - start) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, format]);

  return <span ref={ref}>{format(value)}</span>;
}

function Stat({ icon, title, value, text, tone, i }: { icon: string; title: string; value: React.ReactNode; text: string; tone: 'money' | 'heat' | 'cool' | 'earth'; i: number }) {
  return (
    <div className={`fc-stat fc-stat--${tone}`} style={{ ['--i' as string]: i } as React.CSSProperties}>
      <span className="fc-stat-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <h4>{title}</h4>
        <div className="fc-stat-value">{value}</div>
        <p>{text}</p>
      </div>
    </div>
  );
}

const gwh = (v: number) => `${fmtNum(v / 1000, 1)} GWh`;

export function Results({ outputs }: { outputs: CalcOutputs }) {
  const o = outputs;
  const pays = Number.isFinite(o.paybackYears);
  return (
    <div className="fc-results">
      <p className="fc-headline" aria-live="polite">
        A <b>{o.inputs.itMW} MW</b> data centre could keep <b className="fc-money">{fmtUsd(o.operatorCashUsd)}</b> a year
        {pays ? (
          <>
            {' '}
            and <b>pay itself back in {fmtYears(o.paybackYears)}</b>.
          </>
        ) : (
          <>. At these numbers it does not pay back, so try the sliders.</>
        )}
      </p>

      <div className="fc-stats">
        <Stat
          i={0}
          icon="$"
          tone="money"
          title="You save on cooling"
          value={<CountUp value={o.coolingSavedUsd} format={(v) => fmtUsd(v)} />}
          text="a year in electricity you stop buying"
        />
        <Stat
          i={1}
          icon="♨"
          tone="heat"
          title="You earn from heat"
          value={<CountUp value={o.heatRevenueUsd} format={(v) => fmtUsd(v)} />}
          text={`a year selling ${gwh(o.heatDeliveredMWh)} of warmth`}
        />
        <Stat
          i={2}
          icon="⌂"
          tone="cool"
          title="Homes kept warm"
          value={<CountUp value={roundTens(o.homes)} format={(v) => fmtNum(Math.round(v))} />}
          text={`and the city saves ${fmtUsd(o.cityUsd)} a year on gas`}
        />
        <Stat
          i={3}
          icon="♻"
          tone="earth"
          title="Carbon avoided"
          value={<CountUp value={o.co2Tonnes} format={(v) => `${fmtNum(v)} t`} />}
          text="of CO₂ a year (not counted as cash)"
        />
      </div>

      <p className="fc-fine">
        Over {o.inputs.horizonYears} years: <b>{fmtUsd(o.horizonNetUsd)}</b> net after the build cost of {fmtUsd(o.capexUsd)}. All figures are
        modelled estimates.
      </p>
    </div>
  );
}
