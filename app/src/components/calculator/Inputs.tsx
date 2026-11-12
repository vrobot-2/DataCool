import { type CalcInputs, type InputSpec } from '../../data/calc';

interface Preset {
  label: string;
  inputs: Partial<CalcInputs>;
}

const PRESETS: Preset[] = [
  {
    label: 'Edge site 2 MW',
    inputs: {
      itMW: 2,
      loadFactor: 0.75,
      captureFraction: 0.65,
      heatUtilisation: 0.7,
    },
  },
  {
    label: 'Enterprise 15 MW',
    inputs: {
      itMW: 15,
      loadFactor: 0.85,
      captureFraction: 0.7,
      heatUtilisation: 0.9,
    },
  },
  {
    label: 'Hyperscale 80 MW',
    inputs: {
      itMW: 80,
      loadFactor: 0.92,
      captureFraction: 0.75,
      heatUtilisation: 0.95,
    },
  },
];

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
  return (
    <div className="inputs-panel">
      <div className="inputs-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="preset-chip"
            onClick={() => onPreset(preset.inputs)}
          >
            {preset.label}
          </button>
        ))}
        <button type="button" className="preset-chip preset-reset" onClick={onReset}>
          Reset
        </button>
      </div>
      
      <div className="inputs-list">
        {specs.filter(s => s.control === 'slider').map((spec) => {
          const value = inputs[spec.key];
          const displayValue = value * spec.scale;
          const pct = ((value - spec.min) / (spec.max - spec.min)) * 100;
          
          return (
            <div key={spec.key} className="input-row">
              <label htmlFor={`input-${spec.key}`} className="input-label">
                {spec.label}
              </label>
              <div className="input-control">
                <input
                  id={`input-${spec.key}`}
                  type="range"
                  min={spec.min * spec.scale}
                  max={spec.max * spec.scale}
                  step={spec.step * spec.scale}
                  value={displayValue}
                  onChange={(e) => onUpdate(spec.key, parseFloat(e.target.value) / spec.scale)}
                  data-cursor="money"
                  aria-label={`${spec.label}: ${displayValue.toFixed(spec.decimals)} ${spec.unit}`}
                  style={{ '--pct': `${pct}%` } as React.CSSProperties}
                />
                <output className="input-value">
                  {displayValue.toFixed(spec.decimals)} <small>{spec.unit}</small>
                </output>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="inputs-horizon">
        <label className="input-label">Time horizon</label>
        <div className="horizon-segments">
          {[5, 10, 15].map((y) => (
            <button
              key={y}
              type="button"
              className={`horizon-btn${inputs.horizonYears === y ? ' is-active' : ''}`}
              onClick={() => onUpdate('horizonYears', y)}
              aria-pressed={inputs.horizonYears === y}
            >
              {y} years
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
