import { describe, expect, test } from 'bun:test';
import { CONSTANTS, DEFAULTS, INPUT_SPECS, PRESETS, calc, clampInputs, fmtUsd } from './calc';

/** The original derive() (pre-polish phases.ts), kept here as the reconciliation oracle. */
function legacyDerive() {
  const a = {
    itMW: 15,
    loadFactor: 0.85,
    hoursPerYear: 8760,
    electricityUsdPerKWh: 0.09,
    coolingKWperKWBefore: 0.3,
    coolingKWperKWAfter: 0.08,
    captureFraction: 0.7,
    exchangerEffectiveness: 0.964,
    supplyDeltaK: 40,
    pumpKW: 85,
    heatUsdPerMWh: 38,
    gasUsdPerKWhTh: 0.045,
    gasTCO2PerMWhTh: 0.202,
    carbonUsdPerT: 85,
    homeMWhPerYear: 12,
    capexUsdM: 26,
  };
  const avgITMW = a.itMW * a.loadFactor;
  const coolingSavedMWh = avgITMW * (a.coolingKWperKWBefore - a.coolingKWperKWAfter) * a.hoursPerYear;
  const coolingSavedUsd = coolingSavedMWh * a.electricityUsdPerKWh * 1000;
  const heatMWth = avgITMW * a.captureFraction * a.exchangerEffectiveness;
  const heatMWh = heatMWth * a.hoursPerYear;
  const flowLps = (heatMWth * 1000) / (4.186 * a.supplyDeltaK);
  const pumpUsd = a.pumpKW * a.hoursPerYear * a.electricityUsdPerKWh;
  const heatRevenueUsd = heatMWh * a.heatUsdPerMWh;
  const gasAvoidedUsd = heatMWh * a.gasUsdPerKWhTh * 1000;
  const co2Tonnes = heatMWh * a.gasTCO2PerMWhTh;
  const carbonUsd = co2Tonnes * a.carbonUsdPerT;
  return { heatMWth, heatMWh, flowLps, coolingSavedMWh, coolingSavedUsd, pumpUsd, heatRevenueUsd, gasAvoidedUsd, co2Tonnes, carbonUsd, capexUsd: a.capexUsdM * 1e6 };
}

const close = (a: number, b: number, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));

describe('calc() defaults reconcile with the legacy derive() where the model is unchanged', () => {
  const L = legacyDerive();
  const M = calc();

  test('cooling, heat, flow and pumping are unchanged', () => {
    expect(close(M.coolingSavedMWh, L.coolingSavedMWh)).toBe(true);
    expect(close(M.coolingSavedUsd, L.coolingSavedUsd)).toBe(true);
    expect(close(M.heatMWth, L.heatMWth)).toBe(true);
    expect(close(M.heatMWh, L.heatMWh)).toBe(true);
    expect(close(M.flowLps, L.flowLps)).toBe(true);
    expect(close(M.pumpUsd, L.pumpUsd)).toBe(true);
    expect(close(M.capexUsd, L.capexUsd)).toBe(true);
  });

  test('utilisation (new, 90 %) scales the heat-side figures and nothing else', () => {
    const u = DEFAULTS.heatUtilisation;
    expect(u).toBe(0.9);
    expect(close(M.heatRevenueUsd, L.heatRevenueUsd * u)).toBe(true);
    expect(close(M.gasAvoidedUsd, L.gasAvoidedUsd * u)).toBe(true);
    expect(close(M.co2Tonnes, L.co2Tonnes * u)).toBe(true);
    expect(close(M.carbonUsd, L.carbonUsd * u)).toBe(true);
    expect(close(M.homes, (L.heatMWh * u) / CONSTANTS.homeMWhPerYear)).toBe(true);
    // at 100 % utilisation the heat side is exactly the legacy model
    const F = calc({ heatUtilisation: 1 });
    expect(close(F.heatRevenueUsd, L.heatRevenueUsd)).toBe(true);
    expect(close(F.gasAvoidedUsd, L.gasAvoidedUsd)).toBe(true);
    expect(close(F.carbonUsd, L.carbonUsd)).toBe(true);
  });

  test('headline numbers at defaults (rounded as shown on the page)', () => {
    expect(Math.round(M.coolingSavedUsd / 1e5) / 10).toBe(2.2);
    expect(Math.round(M.heatRevenueUsd / 1e5) / 10).toBe(2.6);
    expect(Math.round(M.gasAvoidedUsd / 1e5) / 10).toBe(3.1);
    expect(Math.round(M.carbonUsd / 1e5) / 10).toBe(1.2);
    expect(Math.round(M.operatorCashUsd / 1e5) / 10).toBe(4.7);
    expect(Math.round(M.paybackYears * 10) / 10).toBe(5.5);
    expect(Math.round(M.homes / 10) * 10).toBe(5650);
    expect(Math.round(M.flowLps * 10) / 10).toBe(51.4);
    expect(Math.round(M.heatMWth * 10) / 10).toBe(8.6);
  });
});

describe('the new split', () => {
  const M = calc();

  test('operator cash = cooling saved + heat revenue − pumping; societal = carbon; city = gas', () => {
    expect(close(M.operatorCashUsd, M.coolingSavedUsd + M.heatRevenueUsd - M.pumpUsd)).toBe(true);
    expect(M.societalUsd).toBe(M.carbonUsd);
    expect(M.cityUsd).toBe(M.gasAvoidedUsd);
    // carbon is never inside the operator figure
    expect(M.operatorCashUsd).toBeLessThan(M.coolingSavedUsd + M.heatRevenueUsd);
  });

  test('payback uses operator cash, capex = $/MW × MW + fixed', () => {
    expect(close(M.paybackYears, M.capexUsd / M.operatorCashUsd)).toBe(true);
    expect(close(M.capexUsd, 26e6)).toBe(true);
    const F = calc({ capexFixedUsd: 4e6, itMW: 10 });
    expect(close(F.capexUsd, DEFAULTS.capexUsdPerMW * 10 + 4e6)).toBe(true);
  });

  test('pumping scales with IT capacity (85 kW at 15 MW)', () => {
    expect(close(M.pumpKW, 85)).toBe(true);
    expect(close(calc({ itMW: 30 }).pumpKW, 170)).toBe(true);
  });

  test('series: year 0 is −capex, cumulative net crosses zero at payback, horizon net matches', () => {
    expect(M.series).toHaveLength(DEFAULTS.horizonYears + 1);
    expect(M.series[0].cumNetUsd).toBe(-M.capexUsd);
    const last = M.series[M.series.length - 1];
    expect(close(last.cumNetUsd, M.horizonNetUsd)).toBe(true);
    const before = M.series[Math.floor(M.paybackYears)].cumNetUsd;
    const after = M.series[Math.ceil(M.paybackYears)].cumNetUsd;
    expect(before).toBeLessThanOrEqual(0);
    expect(after).toBeGreaterThanOrEqual(0);
    expect(close(last.cumCoolingBeforeUsd - last.cumCoolingAfterUsd, DEFAULTS.horizonYears * M.coolingSavedUsd)).toBe(true);
  });

  test('energy flow conserves MW', () => {
    const e = M.energy;
    expect(close(e.itMW, e.deliveredMW + e.lossAirMW + e.lossExchangerMW + e.lossDemandMW)).toBe(true);
    expect(close(M.coolingCut, 1 - 0.08 / 0.3)).toBe(true);
  });

  test('sensitivity: higher electricity price shortens payback, higher capex lengthens it', () => {
    const elec = M.sensitivity.find((s) => s.key === 'electricityUsdPerKWh')!;
    const capex = M.sensitivity.find((s) => s.key === 'capexUsdPerMW')!;
    expect(elec.high).toBeLessThan(elec.low);
    expect(capex.high).toBeGreaterThan(capex.low);
    expect(M.sensitivity).toHaveLength(4);
  });

  test('degenerate inputs do not throw', () => {
    const Z = calc({ heatUsdPerMWh: 0, electricityUsdPerKWh: 0.03, coolingKWperKWBefore: 0.15 });
    expect(Number.isFinite(Z.operatorCashUsd)).toBe(true);
    expect(Z.paybackYears).toBeGreaterThan(0);
  });
});

describe('inputs, presets, clamping, formatting', () => {
  test('every spec key exists in DEFAULTS and defaults sit inside the range', () => {
    for (const s of INPUT_SPECS) {
      const v = DEFAULTS[s.key];
      expect(v).toBeGreaterThanOrEqual(s.min);
      expect(v).toBeLessThanOrEqual(s.max);
    }
  });
  test('presets stay in range and the enterprise preset is the default', () => {
    for (const p of PRESETS) {
      const clamped = clampInputs(p.patch);
      for (const k of Object.keys(p.patch) as (keyof typeof p.patch)[]) expect(clamped[k]).toBe(p.patch[k]);
    }
    expect(calc(PRESETS[1].patch).operatorCashUsd).toBe(calc().operatorCashUsd);
    expect(calc(PRESETS[2].patch).operatorCashUsd).toBeGreaterThan(calc(PRESETS[0].patch).operatorCashUsd);
  });
  test('clampInputs ignores junk and clamps', () => {
    const c = clampInputs({ itMW: 500, loadFactor: Number.NaN, heatUsdPerMWh: -4 });
    expect(c.itMW).toBe(100);
    expect(c.loadFactor).toBe(undefined);
    expect(c.heatUsdPerMWh).toBe(0);
  });
  test('fmtUsd', () => {
    expect(fmtUsd(4.72e6)).toBe('$4.7M');
    expect(fmtUsd(67_014)).toBe('$67k');
    expect(fmtUsd(-26e6)).toBe('−$26M');
    expect(fmtUsd(2.5e9)).toBe('$2.50B');
    expect(fmtUsd(Infinity)).toBe('—');
  });
});
