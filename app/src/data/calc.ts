/**
 * The ONE business model for the whole site. The scroll story (phases.ts), the hero
 * figures (scene/Hero.tsx), the spec strip and the end-of-page calculator all call
 * `calc()`; nothing else computes a dollar figure. Pure, synchronous, no imports.
 *
 * Fixes over the original derive() (docs/numbers-and-calculator.md §1):
 *   1. Operator cash benefit = cooling saved + heat revenue − pumping (cash only).
 *      Societal value = carbon value. City benefit = gas bill avoided. Never summed.
 *   2. Pumping cost is netted and scales with IT capacity (85 kW at 15 MW).
 *   3. Capex = $/MW × MW + fixed plant/pipeline cost.
 *   4. Heat demand utilisation caps how much captured heat the city actually takes.
 *   5. Payback uses the operator cash benefit.
 * Modelled · assumptions editable.
 */

export interface CalcInputs {
  /** IT capacity, MW. */
  itMW: number;
  /** Average IT load / capacity, 0..1. */
  loadFactor: number;
  /** $/kWh electricity. */
  electricityUsdPerKWh: number;
  /** Cooling electricity today, kW per kW of IT (air-cooled baseline). */
  coolingKWperKWBefore: number;
  /** Share of IT heat captured in liquid at the cold plates, 0..1. */
  captureFraction: number;
  /** Heat sold to the district operator, $/MWh-th. */
  heatUsdPerMWh: number;
  /** Share of the captured heat the city actually takes, 0..1. */
  heatUtilisation: number;
  /** Boiler gas displaced, $/kWh-th (fuel + efficiency + O&M). */
  gasUsdPerKWhTh: number;
  /** Carbon price, $/t CO₂. */
  carbonUsdPerT: number;
  /** Capex per MW of IT, $. */
  capexUsdPerMW: number;
  /** Fixed plant / pipeline cost, $. */
  capexFixedUsd: number;
  /** Horizon for the cumulative view, years. */
  horizonYears: number;
}

/** Engineering constants the calculator does not expose. */
export const CONSTANTS = {
  hoursPerYear: 8760,
  /** Pumps + dry coolers with DataCool, kW per kW IT. */
  coolingKWperKWAfter: 0.08,
  exchangerEffectiveness: 0.964,
  /** Loop delta-T across the exchanger, K. */
  supplyDeltaK: 40,
  /** Loop pumping, kW per MW of IT capacity (85 kW at 15 MW). */
  pumpKWPerMWIT: 85 / 15,
  gasTCO2PerMWhTh: 0.202,
  homeMWhPerYear: 12,
  /** Water, kJ/(kg·K). */
  cpWater: 4.186,
} as const;

export const DEFAULTS: CalcInputs = {
  itMW: 15,
  loadFactor: 0.85,
  electricityUsdPerKWh: 0.09,
  coolingKWperKWBefore: 0.3,
  captureFraction: 0.7,
  heatUsdPerMWh: 38,
  heatUtilisation: 0.9,
  gasUsdPerKWhTh: 0.045,
  carbonUsdPerT: 85,
  capexUsdPerMW: 26e6 / 15,
  capexFixedUsd: 0,
  horizonYears: 10,
};

export type InputKey = keyof CalcInputs;

export interface InputSpec {
  key: InputKey;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Display multiplier (e.g. 100 for fractions shown as %). */
  scale: number;
  unit: string;
  decimals: number;
  /** Short query-string / hash key (docs §6). */
  param: string;
  control: 'slider' | 'number' | 'segmented';
}

/** Ranges from docs/numbers-and-calculator.md §3. Order = UI order. */
export const INPUT_SPECS: InputSpec[] = [
  { key: 'itMW', label: 'IT capacity', min: 1, max: 100, step: 1, scale: 1, unit: 'MW', decimals: 0, param: 'it_mw', control: 'slider' },
  { key: 'loadFactor', label: 'Average load', min: 0.4, max: 1, step: 0.01, scale: 100, unit: '%', decimals: 0, param: 'load', control: 'slider' },
  { key: 'electricityUsdPerKWh', label: 'Electricity price', min: 0.03, max: 0.3, step: 0.005, scale: 1, unit: '$/kWh', decimals: 3, param: 'elec', control: 'slider' },
  { key: 'coolingKWperKWBefore', label: 'Cooling today', min: 0.15, max: 0.6, step: 0.01, scale: 1, unit: 'kW / kW IT', decimals: 2, param: 'cooling_before', control: 'slider' },
  { key: 'captureFraction', label: 'Heat captured in liquid', min: 0.4, max: 0.9, step: 0.01, scale: 100, unit: '%', decimals: 0, param: 'capture', control: 'slider' },
  { key: 'heatUsdPerMWh', label: 'Heat sale price', min: 0, max: 120, step: 1, scale: 1, unit: '$/MWh', decimals: 0, param: 'heat_price', control: 'slider' },
  { key: 'heatUtilisation', label: 'Heat demand utilisation', min: 0.3, max: 1, step: 0.01, scale: 100, unit: '%', decimals: 0, param: 'util', control: 'slider' },
  { key: 'gasUsdPerKWhTh', label: 'Gas price displaced', min: 0.02, max: 0.12, step: 0.005, scale: 1, unit: '$/kWh-th', decimals: 3, param: 'gas', control: 'slider' },
  { key: 'carbonUsdPerT', label: 'Carbon price', min: 0, max: 200, step: 5, scale: 1, unit: '$/t', decimals: 0, param: 'carbon', control: 'slider' },
  { key: 'capexUsdPerMW', label: 'Capex per MW', min: 0.2e6, max: 6e6, step: 0.01e6, scale: 1e-6, unit: '$M/MW', decimals: 2, param: 'capex_per_mw', control: 'number' },
  { key: 'capexFixedUsd', label: 'Fixed plant + pipeline', min: 0, max: 100e6, step: 0.1e6, scale: 1e-6, unit: '$M', decimals: 1, param: 'capex_fixed', control: 'number' },
  { key: 'horizonYears', label: 'Horizon', min: 5, max: 15, step: 5, scale: 1, unit: 'yr', decimals: 0, param: 'years', control: 'segmented' },
];

export interface Preset {
  id: string;
  label: string;
  patch: Partial<CalcInputs>;
}

export const PRESETS: Preset[] = [
  { id: 'edge', label: 'Edge site 2 MW', patch: { itMW: 2, loadFactor: 0.7, capexFixedUsd: 1.5e6 } },
  { id: 'enterprise', label: 'Enterprise 15 MW', patch: {} },
  { id: 'hyperscale', label: 'Hyperscale 80 MW', patch: { itMW: 80, loadFactor: 0.9, heatUtilisation: 0.75, capexUsdPerMW: 1.4e6 } },
];

export interface YearPoint {
  year: number;
  /** Cumulative operator cash − capex ("with DataCool"). */
  cumNetUsd: number;
  /** Cumulative cooling electricity spend with air cooling ("without"). */
  cumCoolingBeforeUsd: number;
  /** Cumulative cooling electricity spend with DataCool. */
  cumCoolingAfterUsd: number;
  /** Cumulative societal (carbon) value. */
  cumCarbonUsd: number;
}

export interface Sensitivity {
  key: InputKey;
  label: string;
  /** Payback years at −20 % of the input. */
  low: number;
  /** Payback years at +20 % of the input. */
  high: number;
}

export interface CalcOutputs {
  inputs: CalcInputs;
  avgITMW: number;
  /* cooling */
  coolingBeforeMWh: number;
  coolingAfterMWh: number;
  coolingSavedMWh: number;
  coolingBeforeUsd: number;
  coolingAfterUsd: number;
  coolingSavedUsd: number;
  /** 1 − after/before, 0..1 (0.73 by default). */
  coolingCut: number;
  /* heat */
  /** Heat captured at the cold plates, MW-th (avg). */
  capturedMWth: number;
  /** Heat crossing the exchanger, MW-th (avg). */
  heatMWth: number;
  /** Heat crossing the exchanger, MWh-th / yr. */
  heatMWh: number;
  /** Heat the city takes, MW-th (avg) and MWh-th / yr. */
  deliveredMWth: number;
  heatDeliveredMWh: number;
  flowLps: number;
  /* pumping */
  pumpKW: number;
  pumpUsd: number;
  /** Pumping cost / heat revenue. */
  pumpShare: number;
  /* value */
  heatRevenueUsd: number;
  gasAvoidedUsd: number;
  co2Tonnes: number;
  carbonUsd: number;
  /** Cooling saved + heat revenue − pumping. Cash to the operator. */
  operatorCashUsd: number;
  /** Carbon value. Not cash. */
  societalUsd: number;
  /** City gas bill avoided. The city's saving. */
  cityUsd: number;
  /* capex + time */
  capexUsd: number;
  paybackYears: number;
  horizonNetUsd: number;
  homes: number;
  /** km of mains, rough: 0.9 km per 1,000 homes + 1.5 km trunk. */
  mainsKm: number;
  series: YearPoint[];
  sensitivity: Sensitivity[];
  energy: {
    itMW: number;
    capturedMW: number;
    exchangedMW: number;
    deliveredMW: number;
    lossAirMW: number;
    lossExchangerMW: number;
    lossDemandMW: number;
  };
}

const C = CONSTANTS;

function core(a: CalcInputs) {
  const avgITMW = a.itMW * a.loadFactor;
  const coolingBeforeMWh = avgITMW * a.coolingKWperKWBefore * C.hoursPerYear;
  const coolingAfterMWh = avgITMW * C.coolingKWperKWAfter * C.hoursPerYear;
  const coolingSavedMWh = coolingBeforeMWh - coolingAfterMWh;
  const coolingBeforeUsd = coolingBeforeMWh * a.electricityUsdPerKWh * 1000;
  const coolingAfterUsd = coolingAfterMWh * a.electricityUsdPerKWh * 1000;
  const coolingSavedUsd = coolingBeforeUsd - coolingAfterUsd;
  const capturedMWth = avgITMW * a.captureFraction;
  const heatMWth = capturedMWth * C.exchangerEffectiveness;
  const heatMWh = heatMWth * C.hoursPerYear;
  const deliveredMWth = heatMWth * a.heatUtilisation;
  const heatDeliveredMWh = heatMWh * a.heatUtilisation;
  const flowLps = (heatMWth * 1000) / (C.cpWater * C.supplyDeltaK);
  const pumpKW = C.pumpKWPerMWIT * a.itMW;
  const pumpUsd = pumpKW * C.hoursPerYear * a.electricityUsdPerKWh;
  const heatRevenueUsd = heatDeliveredMWh * a.heatUsdPerMWh;
  const gasAvoidedUsd = heatDeliveredMWh * a.gasUsdPerKWhTh * 1000;
  const co2Tonnes = heatDeliveredMWh * C.gasTCO2PerMWhTh;
  const carbonUsd = co2Tonnes * a.carbonUsdPerT;
  const operatorCashUsd = coolingSavedUsd + heatRevenueUsd - pumpUsd;
  const capexUsd = a.capexUsdPerMW * a.itMW + a.capexFixedUsd;
  const paybackYears = operatorCashUsd > 0 ? capexUsd / operatorCashUsd : Infinity;
  return {
    avgITMW,
    coolingBeforeMWh,
    coolingAfterMWh,
    coolingSavedMWh,
    coolingBeforeUsd,
    coolingAfterUsd,
    coolingSavedUsd,
    coolingCut: 1 - C.coolingKWperKWAfter / a.coolingKWperKWBefore,
    capturedMWth,
    heatMWth,
    heatMWh,
    deliveredMWth,
    heatDeliveredMWh,
    flowLps,
    pumpKW,
    pumpUsd,
    pumpShare: heatRevenueUsd > 0 ? pumpUsd / heatRevenueUsd : Infinity,
    heatRevenueUsd,
    gasAvoidedUsd,
    co2Tonnes,
    carbonUsd,
    operatorCashUsd,
    societalUsd: carbonUsd,
    cityUsd: gasAvoidedUsd,
    capexUsd,
    paybackYears,
    homes: heatDeliveredMWh / C.homeMWhPerYear,
  };
}

const SENSITIVITY_KEYS: { key: InputKey; label: string }[] = [
  { key: 'electricityUsdPerKWh', label: 'Electricity price' },
  { key: 'heatUsdPerMWh', label: 'Heat price' },
  { key: 'captureFraction', label: 'Capture fraction' },
  { key: 'capexUsdPerMW', label: 'Capex' },
];

export function calc(partial: Partial<CalcInputs> = {}): CalcOutputs {
  const inputs: CalcInputs = { ...DEFAULTS, ...partial };
  const k = core(inputs);
  const years = Math.max(1, Math.round(inputs.horizonYears));
  const series: YearPoint[] = [];
  for (let y = 0; y <= years; y++) {
    series.push({
      year: y,
      cumNetUsd: -k.capexUsd + y * k.operatorCashUsd,
      cumCoolingBeforeUsd: y * k.coolingBeforeUsd,
      cumCoolingAfterUsd: y * k.coolingAfterUsd,
      cumCarbonUsd: y * k.carbonUsd,
    });
  }
  const sensitivity: Sensitivity[] = SENSITIVITY_KEYS.map(({ key, label }) => ({
    key,
    label,
    low: core({ ...inputs, [key]: inputs[key] * 0.8 }).paybackYears,
    high: core({ ...inputs, [key]: inputs[key] * 1.2 }).paybackYears,
  }));
  return {
    inputs,
    ...k,
    horizonNetUsd: years * k.operatorCashUsd - k.capexUsd,
    mainsKm: 1.5 + (k.homes / 1000) * 0.9,
    series,
    sensitivity,
    energy: {
      itMW: k.avgITMW,
      capturedMW: k.capturedMWth,
      exchangedMW: k.heatMWth,
      deliveredMW: k.deliveredMWth,
      lossAirMW: k.avgITMW - k.capturedMWth,
      lossExchangerMW: k.capturedMWth - k.heatMWth,
      lossDemandMW: k.heatMWth - k.deliveredMWth,
    },
  };
}

/** Clamp every input to its spec range (used by URL-hash parsing). */
export function clampInputs(partial: Partial<CalcInputs>): Partial<CalcInputs> {
  const out: Partial<CalcInputs> = {};
  for (const s of INPUT_SPECS) {
    const v = partial[s.key];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    out[s.key] = Math.min(s.max, Math.max(s.min, v));
  }
  return out;
}

/* ---------- formatting (shared by phases.ts, Hero, calculator) ---------- */

const rnd = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

export const fmtNum = (v: number, d = 0) =>
  v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

/** $4.7M / $67k / $850 — compact money for hero figures and cards. */
export function fmtUsd(v: number, decimals?: number): string {
  if (!Number.isFinite(v)) return '—';
  const sign = v < 0 ? '−' : '';
  const x = Math.abs(v);
  if (x >= 1e9) return `${sign}$${fmtNum(x / 1e9, decimals ?? 2)}B`;
  if (x >= 1e6) return `${sign}$${fmtNum(x / 1e6, decimals ?? (x < 1e7 ? 1 : 0))}M`;
  if (x >= 1e3) return `${sign}$${fmtNum(x / 1e3, decimals ?? 0)}k`;
  return `${sign}$${fmtNum(x, decimals ?? 0)}`;
}

/** Dollars as millions with `d` decimals, e.g. usdM(2.2e6) -> 2.2. */
export const usdM = (v: number, d = 1) => rnd(v / 1e6, d);

/** Round to the nearest 10 for "about N homes". */
export const roundTens = (v: number) => Math.round(v / 10) * 10;

export const fmtYears = (v: number) => (Number.isFinite(v) ? `${fmtNum(v, 1)} yr` : 'never');
