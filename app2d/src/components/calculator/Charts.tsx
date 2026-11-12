import { fmtUsd, fmtNum, type CalcOutputs } from '../../data/calc';

/**
 * Five hand-rolled SVG charts:
 * 1. Cumulative cash flow (line)
 * 2. Annual benefit stack (stacked bar)
 * 3. Energy flow (Sankey-style simplified)
 * 4. Cooling energy per kW IT (comparison bars)
 * 5. Sensitivity (tornado)
 */
export function Charts({ outputs }: { outputs: CalcOutputs }) {
  return (
    <div className="charts-grid">
      <CumulativeCashFlow outputs={outputs} />
      <AnnualBenefitStack outputs={outputs} />
      <EnergyFlow outputs={outputs} />
      <CoolingComparison outputs={outputs} />
      <Sensitivity outputs={outputs} />
    </div>
  );
}

function CumulativeCashFlow({ outputs }: { outputs: CalcOutputs }) {
  const { series } = outputs;
  const w = 400;
  const h = 200;
  const margin = { top: 20, right: 20, bottom: 30, left: 60 };
  const chartW = w - margin.left - margin.right;
  const chartH = h - margin.top - margin.bottom;
  
  const maxY = Math.max(...series.map(p => p.cumNetUsd), 0);
  const minY = Math.min(...series.map(p => p.cumNetUsd), -outputs.capexUsd);
  
  const xScale = (i: number) => margin.left + (i / (series.length - 1)) * chartW;
  const yScale = (v: number) => margin.top + chartH - ((v - minY) / (maxY - minY)) * chartH;
  
  const points = series.map((p, i) => `${xScale(i)},${yScale(p.cumNetUsd)}`).join(' ');
  const path = `M ${points}`;
  
  return (
    <div className="chart">
      <h3 className="chart-title">Cumulative cash flow</h3>
      <svg viewBox={`0 0 ${w} ${h}`}>
        <line
          x1={margin.left}
          y1={yScale(0)}
          x2={w - margin.right}
          y2={yScale(0)}
          stroke="var(--line)"
          strokeWidth={1}
        />
        <path d={path} fill="none" stroke="var(--cold)" strokeWidth={2} />
        <text x={margin.left} y={margin.top - 5} fontSize={10} fill="var(--mute)" fontFamily="var(--mono)">
          {fmtUsd(maxY)}
        </text>
      </svg>
    </div>
  );
}

function AnnualBenefitStack({ outputs }: { outputs: CalcOutputs }) {
  const w = 400;
  const h = 200;
  const { coolingSavedUsd, heatRevenueUsd, pumpUsd } = outputs;
  
  const total = coolingSavedUsd + heatRevenueUsd;
  const net = total - pumpUsd;
  const max = total * 1.2;
  
  const barW = 80;
  const x = (w - barW) / 2;
  const yScale = (v: number) => h - 30 - (v / max) * (h - 60);
  
  return (
    <div className="chart">
      <h3 className="chart-title">Annual benefit</h3>
      <svg viewBox={`0 0 ${w} ${h}`}>
        <rect x={x} y={yScale(coolingSavedUsd)} width={barW} height={h - 30 - yScale(coolingSavedUsd)} fill="var(--cold)" />
        <rect x={x} y={yScale(coolingSavedUsd + heatRevenueUsd)} width={barW} height={yScale(coolingSavedUsd) - yScale(coolingSavedUsd + heatRevenueUsd)} fill="var(--hot)" />
        <rect x={x} y={yScale(total)} width={barW} height={4} fill="var(--amber)" />
        <text x={w / 2} y={h - 10} fontSize={11} fill="var(--mute)" textAnchor="middle" fontFamily="var(--mono)">
          Net: {fmtUsd(net)} / yr
        </text>
      </svg>
    </div>
  );
}

function EnergyFlow({ outputs }: { outputs: CalcOutputs }) {
  const w = 400;
  const h = 200;
  const { energy } = outputs;
  
  const max = energy.itMW;
  const widthScale = (v: number) => (v / max) * 120;
  
  return (
    <div className="chart">
      <h3 className="chart-title">Energy flow (MW)</h3>
      <svg viewBox={`0 0 ${w} ${h}`}>
        <g transform="translate(20, 40)">
          <rect x={0} y={0} width={widthScale(energy.itMW)} height={20} fill="var(--cold)" />
          <text x={widthScale(energy.itMW) + 5} y={15} fontSize={10} fill="var(--fg)">{fmtNum(energy.itMW, 1)} IT</text>
          
          <rect x={20} y={40} width={widthScale(energy.capturedMW)} height={18} fill="var(--hot)" />
          <text x={widthScale(energy.capturedMW) + 25} y={53} fontSize={10} fill="var(--fg)">{fmtNum(energy.capturedMW, 1)} captured</text>
          
          <rect x={40} y={80} width={widthScale(energy.deliveredMW)} height={16} fill="var(--money)" />
          <text x={widthScale(energy.deliveredMW) + 45} y={91} fontSize={10} fill="var(--fg)">{fmtNum(energy.deliveredMW, 1)} delivered</text>
        </g>
      </svg>
    </div>
  );
}

function CoolingComparison({ outputs }: { outputs: CalcOutputs }) {
  const w = 400;
  const h = 200;
  const before = outputs.inputs.coolingKWperKWBefore;
  const after = 0.08;
  const reduction = ((before - after) / before) * 100;
  
  const max = before * 1.1;
  const barH = 40;
  const y1 = 50;
  const y2 = 120;
  const xScale = (v: number) => 100 + (v / max) * 200;
  
  return (
    <div className="chart">
      <h3 className="chart-title">Cooling energy per kW IT</h3>
      <svg viewBox={`0 0 ${w} ${h}`}>
        <rect x={100} y={y1} width={xScale(before) - 100} height={barH} fill="var(--mute)" opacity={0.5} />
        <text x={90} y={y1 + barH / 2 + 5} fontSize={11} fill="var(--mute)" textAnchor="end">Before</text>
        <text x={xScale(before) + 5} y={y1 + barH / 2 + 5} fontSize={11} fill="var(--fg)">{before.toFixed(2)}</text>
        
        <rect x={100} y={y2} width={xScale(after) - 100} height={barH} fill="var(--cold)" />
        <text x={90} y={y2 + barH / 2 + 5} fontSize={11} fill="var(--mute)" textAnchor="end">DataCool</text>
        <text x={xScale(after) + 5} y={y2 + barH / 2 + 5} fontSize={11} fill="var(--fg)">{after.toFixed(2)}</text>
        
        <text x={w / 2} y={h - 10} fontSize={12} fill="var(--money)" textAnchor="middle" fontWeight="bold">
          −{reduction.toFixed(0)}%
        </text>
      </svg>
    </div>
  );
}

function Sensitivity({ outputs }: { outputs: CalcOutputs }) {
  const w = 400;
  const h = 200;
  const { sensitivity, paybackYears } = outputs;
  
  const baseline = paybackYears;
  const allYears = sensitivity.flatMap(s => [s.low, s.high]);
  const minY = Math.min(baseline, ...allYears) * 0.9;
  const maxY = Math.max(baseline, ...allYears) * 1.1;
  
  // labels need ~130 units on the left, so the bars live in x = 150..370
  const xScale = (v: number) => 150 + ((v - minY) / (maxY - minY)) * 220;
  const baseX = xScale(baseline);
  
  return (
    <div className="chart">
      <h3 className="chart-title">Sensitivity (±20% on inputs)</h3>
      <svg viewBox={`0 0 ${w} ${h}`}>
        <line x1={baseX} y1={20} x2={baseX} y2={h - 20} stroke="var(--line)" strokeWidth={1} strokeDasharray="4 2" />
        
        {sensitivity.map((s, i) => {
          const y = 30 + i * 35;
          return (
            <g key={s.key}>
              <line
                x1={xScale(s.low)}
                y1={y}
                x2={xScale(s.high)}
                y2={y}
                stroke="var(--cold)"
                strokeWidth={6}
                strokeLinecap="round"
              />
              <text x={138} y={y + 4} fontSize={10} fill="var(--mute)" textAnchor="end" fontFamily="var(--mono)">
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
