import { calc, DEFAULTS, fmtNum, fmtUsd, roundTens } from '../data/calc';

/** One hero figure per phase (same mapping as the 3D app). Derived from calc(DEFAULTS). */
const M = calc(DEFAULTS);

export interface HeroFigure {
  value: number;
  label: string;
  format: (v: number) => string;
  unit?: string;
}

export const HEROES: HeroFigure[] = [
  { value: M.operatorCashUsd, label: 'Operator cash benefit', format: (v) => fmtUsd(v), unit: 'per year' },
  { value: M.coolingSavedUsd, label: 'Cooling bill avoided', format: (v) => fmtUsd(v), unit: 'per year' },
  { value: M.flowLps, label: `Sealed flow carrying ${fmtNum(M.heatMWth, 1)} MW`, format: (v) => `${fmtNum(v, 1)} L/s` },
  { value: M.capturedMWth, label: 'Heat captured, not exhausted', format: (v) => `${fmtNum(v, 1)} MW` },
  { value: M.heatRevenueUsd, label: 'Heat revenue', format: (v) => fmtUsd(v), unit: 'per year' },
  { value: M.heatDeliveredMWh / 1000, label: 'Heat delivered', format: (v) => `${fmtNum(v, 1)} GWh`, unit: 'per year' },
  { value: M.gasAvoidedUsd, label: 'City gas bill avoided', format: (v) => fmtUsd(v), unit: 'per year' },
  { value: roundTens(M.homes), label: 'Homes heated', format: (v) => fmtNum(Math.round(v), 0) },
  { value: M.paybackYears, label: 'Payback', format: (v) => `${fmtNum(v, 1)} yr` },
];
