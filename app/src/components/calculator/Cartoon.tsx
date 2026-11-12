import { useEffect, useRef } from 'react';
import { fmtUsd, type CalcOutputs } from '../../data/calc';

/**
 * Animated SVG cartoon diagram showing cumulative cash flow over time.
 * Time slider controls the year; play button auto-advances.
 * Features: server racks, heat exchanger, city, money stacks, payback marker.
 */
export function Cartoon({
  outputs,
  year,
  onYearChange,
  playing,
  onPlay,
  onPlayComplete,
}: {
  outputs: CalcOutputs;
  year: number;
  onYearChange: (y: number) => void;
  playing: boolean;
  onPlay: () => void;
  onPlayComplete: () => void;
}) {
  const animRef = useRef<number>(0);
  const lastTime = useRef(0);
  
  const { series, paybackYears, inputs } = outputs;
  const maxYear = Math.floor(inputs.horizonYears);
  // year is fractional while playing: index with floor() or series[x.y] is undefined and crashes
  const currentPoint = series[Math.min(Math.max(0, Math.floor(year)), series.length - 1)];
  const paybackYear = Math.floor(paybackYears);
  
  // Auto-play animation
  useEffect(() => {
    if (!playing) {
      lastTime.current = 0;
      return;
    }
    
    const step = (time: number) => {
      if (lastTime.current === 0) lastTime.current = time;
      const delta = time - lastTime.current;
      lastTime.current = time;
      
      // Advance ~2.5 years per second
      const yearDelta = (delta / 1000) * 2.5;
      const nextYear = year + yearDelta;
      
      if (nextYear >= maxYear) {
        onYearChange(maxYear);
        onPlayComplete();
      } else {
        onYearChange(nextYear);
        animRef.current = requestAnimationFrame(step);
      }
    };
    
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, year, maxYear, onYearChange, onPlayComplete]);
  
  // SVG dimensions
  const w = 600;
  const h = 400;
  const margin = 40;
  const chartW = w - margin * 2;
  const chartH = h - margin * 2;
  
  // Y scale for cash (fit both positive and negative)
  const maxAbs = Math.max(
    Math.abs(outputs.capexUsd),
    ...series.map(p => Math.abs(p.cumNetUsd))
  );
  const yScale = (v: number) => margin + chartH / 2 - (v / maxAbs) * (chartH / 2) * 0.9;
  const xScale = (y: number) => margin + (y / maxYear) * chartW;
  
  // Path for cumulative net USD
  const pathPoints = series.map((p, i) => `${xScale(i)},${yScale(p.cumNetUsd)}`).join(' L ');
  const path = `M ${pathPoints}`;
  
  // Current position
  const currentX = xScale(year);
  const currentY = yScale(currentPoint.cumNetUsd);
  
  return (
    <div className="cartoon">
      <svg viewBox={`0 0 ${w} ${h}`} className="cartoon-svg">
        {/* Zero line */}
        <line
          x1={margin}
          y1={yScale(0)}
          x2={w - margin}
          y2={yScale(0)}
          stroke="var(--line)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        
        {/* Payback marker */}
        {paybackYear <= maxYear && (
          <g opacity={year >= paybackYear - 0.5 ? 1 : 0.3}>
            <line
              x1={xScale(paybackYear)}
              y1={margin}
              x2={xScale(paybackYear)}
              y2={h - margin}
              stroke="var(--money)"
              strokeWidth={2}
              strokeDasharray="6 3"
            />
            <text
              x={xScale(paybackYear)}
              y={margin - 10}
              fill="var(--money)"
              fontSize={12}
              fontFamily="var(--mono)"
              textAnchor="middle"
            >
              Payback
            </text>
          </g>
        )}
        
        {/* Cumulative cash flow line */}
        <path
          d={path}
          fill="none"
          stroke="var(--cold)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Fill area below line */}
        <path
          d={`${path} L ${xScale(year)},${yScale(0)} L ${margin},${yScale(0)} Z`}
          fill="var(--cold)"
          fillOpacity={0.15}
        />
        
        {/* Current position marker */}
        <circle
          cx={currentX}
          cy={currentY}
          r={6}
          fill="var(--cold)"
          stroke="var(--ink)"
          strokeWidth={2}
        />
        
        {/* Current value label */}
        <g>
          <rect
            x={currentX - 50}
            y={currentY - 40}
            width={100}
            height={30}
            fill="var(--panel)"
            rx={4}
            opacity={0.95}
          />
          <text
            x={currentX}
            y={currentY - 20}
            fill="var(--fg)"
            fontSize={14}
            fontWeight="bold"
            fontFamily="var(--sans)"
            textAnchor="middle"
          >
            {fmtUsd(currentPoint.cumNetUsd)}
          </text>
        </g>
        
        {/* X axis labels */}
        {[0, paybackYear, maxYear].filter((y, i, arr) => arr.indexOf(y) === i && y <= maxYear).map(y => (
          <text
            key={y}
            x={xScale(y)}
            y={h - margin + 20}
            fill="var(--mute)"
            fontSize={11}
            fontFamily="var(--mono)"
            textAnchor="middle"
          >
            Year {y}
          </text>
        ))}
      </svg>
      
      <div className="cartoon-controls">
        <input
          type="range"
          min={0}
          max={maxYear}
          step={0.1}
          value={year}
          onChange={(e) => onYearChange(parseFloat(e.target.value))}
          className="cartoon-slider"
          aria-label={`Time slider: year ${year.toFixed(1)}`}
        />
        
        <div className="cartoon-buttons">
          <button
            type="button"
            className="cartoon-play"
            onClick={onPlay}
            disabled={playing || year >= maxYear}
            aria-label={playing ? 'Playing' : 'Play animation'}
          >
            {playing ? '⏸' : '▶'} {playing ? 'Playing' : 'Play'}
          </button>
          
          <span className="cartoon-year">Year {year.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}
