/**
 * Single source of truth for the Spec Sheet.
 * Copy, $ figures (from calc.ts), colours, metrics and camera waypoints live here.
 *
 * UPDATED for polish round: 9 scroll sections (intro, rack, manifold, hall, plant,
 * follow, underground, city, close) + calculator section. Camera driven by shots.ts,
 * but placeholder cameras kept here until ts-stage delivers the spline rig.
 */

/**
 * Coordinate convention: three.js Y-up metres. Blender (x, y, z) → three (x, z, −y).
 * Camera waypoints are placeholders until ts-stage replaces them with shots.ts.
 */
export type Vec3 = [number, number, number];

export interface CameraKey {
  position: Vec3;
  target: Vec3;
}

export interface Shot {
  id: string;
  position: Vec3;
  target: Vec3;
  /** Hold zone fraction (0..1) where camera is almost still. */
  hold?: number;
  /** Anchor point for the hero figure in 3D. */
  heroAnchor?: Vec3;
  /** Field of view override (default 34°). */
  fov?: number;
}

export interface Metric {
  label: string;
  value: number;
  unit: string;
  decimals?: number;
  /** Shown before the number, e.g. "$". */
  prefix?: string;
}

export interface SpecRow {
  key: string;
  text: string;
}

export interface PhaseData {
  /** DOM id + stable key. */
  id: string;
  /** Display index (0..8). */
  index: number;
  /** Maps to Shot index in shots.ts; placeholder cameras here until delivered. */
  shotIndex: number;
  eyebrowNo: string;
  eyebrow: string;
  /** Logical lines; rendered joined with <br>. */
  title: string[];
  lede: string;
  specs: SpecRow[];
  accent: string;
  stripTitle: string;
  metrics: [Metric, Metric];
  /** Placeholder camera until shots.ts replaces it. */
  camera: CameraKey;
}

/**
 * Re-derive all numbers from calc(DEFAULTS) so the scroll story and calculator agree.
 * Import calc for the hero figures and calculator; keep this derive() for the phases
 * array until we fully switch to importing calc outputs.
 */
import { calc, DEFAULTS, fmtUsd, fmtNum, roundTens } from './calc';

const M = calc(DEFAULTS);
const A = DEFAULTS;

const rnd = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
const fmt = (v: number, d = 0) => fmtNum(v, d);
const usd = (v: number) => fmtUsd(v);
const pct = (v: number, d = 0) => `${fmt(v * 100, d)} %`;
const $metric = (label: string, v: number, d = 1): Metric => ({
  label,
  prefix: '$',
  value: rnd(v / 1e6, d),
  unit: 'M / yr',
  decimals: d,
});

/**
 * Nine scroll sections (0..8) mapping to 9 shots (intro, rack, manifold, hall,
 * plant, follow, underground, city, close). cameraT runs continuously 0..8.
 * The calculator section follows (no 3D shot).
 */
export const PHASES: PhaseData[] = [
  {
    id: 'intro',
    index: 0,
    shotIndex: 0,
    eyebrowNo: '00',
    eyebrow: 'System overview',
    title: ['Every rack is a radiator.', 'Now it pays.'],
    lede: `A ${A.itMW} MW campus turns its waste heat into ${usd(M.operatorCashUsd)} a year in operator cash benefit: cooling power it stops buying, heat it sells, minus pumping.`,
    specs: [
      { key: '01', text: 'Direct-to-chip capture at 85 °C source temperature' },
      { key: '02', text: `Sealed loop moves ${fmt(M.heatMWth, 1)} MW of heat to the city` },
      { key: '03', text: `${usd(M.operatorCashUsd)} / yr modelled · ${fmt(M.paybackYears, 1)} yr payback` },
    ],
    accent: '#7C8BFF',
    stripTitle: 'System overview',
    metrics: [
      { label: 'IT load', value: A.itMW, unit: 'MW' },
      $metric('Operator cash', M.operatorCashUsd),
    ],
    camera: { position: [4.4, 1.6, 3.9], target: [0, 0.9, 0] },
  },
  {
    id: 'rack',
    index: 1,
    shotIndex: 1,
    eyebrowNo: '01',
    eyebrow: 'Capture',
    title: ['Direct-to-chip capture'],
    lede: `Coolant runs across the hottest silicon, not the room. With ${pct(A.captureFraction)} of the heat in liquid, cooling drops from ${A.coolingKWperKWBefore} to 0.08 kW per kW of IT.`,
    specs: [
      { key: '01', text: 'Micro-channel cold plates on CPU / GPU packages' },
      { key: '02', text: `${fmt(M.coolingSavedMWh)} MWh / yr of cooling electricity avoided` },
      { key: '03', text: `${usd(M.coolingSavedUsd)} / yr saved at $${A.electricityUsdPerKWh.toFixed(2)} / kWh` },
    ],
    accent: '#FF6B57',
    stripTitle: 'Direct-to-chip',
    metrics: [
      { label: 'Heat captured', value: A.captureFraction * 100, unit: '%' },
      $metric('Cooling saved', M.coolingSavedUsd),
    ],
    camera: { position: [-3.2, 1.35, -3.55], target: [-3.2, 1.2, -2.2] },
  },
  {
    id: 'manifold',
    index: 2,
    shotIndex: 2,
    eyebrowNo: '02',
    eyebrow: 'Transport',
    title: ['High-velocity extraction'],
    lede: `Sealed conduits carry ${fmt(M.heatMWth, 1)} MW at ${fmt(M.flowLps)} L/s on a 40 K delta. Nothing evaporates, and nothing touches the electronics.`,
    specs: [
      { key: '01', text: 'Closed-loop manifold, zero evaporation' },
      { key: '02', text: `${fmt(M.flowLps, 1)} L/s per rack moving ${fmt(M.heatMWth, 1)} MW` },
      { key: '03', text: `Pumping ${fmt(M.pumpKW, 0)} kW · ${usd(M.pumpUsd)} / yr` },
    ],
    accent: '#8FA2FF',
    stripTitle: 'High-velocity',
    metrics: [
      { label: 'Loop flow', value: rnd(M.flowLps), unit: 'L/s' },
      $metric('Pumping cost', M.pumpUsd, 2),
    ],
    camera: { position: [-3.2, 1.35, 2.35], target: [-3.2, 1.15, -1.5] },
  },
  {
    id: 'hall',
    index: 3,
    shotIndex: 3,
    eyebrowNo: '03',
    eyebrow: 'Data hall',
    title: ['At scale'],
    lede: `Ten racks in two rows, each capturing heat. The overhead headers collect ${fmt(M.capturedMWth, 1)} MW and route it to the plant room.`,
    specs: [
      { key: '01', text: '10 racks × cold aisle + hot aisle layout' },
      { key: '02', text: `${fmt(M.capturedMWth, 1)} MW of heat captured at the plates` },
      { key: '03', text: `Overhead insulated headers carry flow to the exchanger` },
    ],
    accent: '#7C8BFF',
    stripTitle: 'Data hall',
    metrics: [
      { label: 'Heat captured', value: rnd(M.capturedMWth, 1), unit: 'MW' },
      { label: 'Racks', value: 10, unit: '' },
    ],
    camera: { position: [-10, 2, -8], target: [-3, 1, -2] },
  },
  {
    id: 'plant',
    index: 4,
    shotIndex: 4,
    eyebrowNo: '04',
    eyebrow: 'Exchange',
    title: ['The exchange'],
    lede: `Two loops share a wall and nothing else. ${pct(0.964, 1)} of the captured heat crosses over; zero fluid crosses with it.`,
    specs: [
      { key: '01', text: 'Counter-flow plate core, 72 plates' },
      { key: '02', text: `${fmt(M.heatMWh)} MWh / yr sold at $${A.heatUsdPerMWh} / MWh` },
      { key: '03', text: `${usd(M.heatRevenueUsd)} / yr heat revenue` },
    ],
    accent: '#FFC266',
    stripTitle: 'The exchange',
    metrics: [
      { label: 'Effectiveness', value: 96.4, unit: '%', decimals: 1 },
      $metric('Heat revenue', M.heatRevenueUsd),
    ],
    camera: { position: [1.5, 2.2, 2.35], target: [0, 0.85, 0] },
  },
  {
    id: 'follow',
    index: 5,
    shotIndex: 5,
    eyebrowNo: '05',
    eyebrow: 'Pipe-follow',
    title: ['Into the ground'],
    lede: `The supply main carries ${fmt(M.heatDeliveredMWh)} MWh / yr of heat through the wall, down into the earth, and under the street.`,
    specs: [
      { key: '01', text: 'Insulated supply main from plant room to mains' },
      { key: '02', text: `${fmt(M.heatDeliveredMWh)} MWh / yr delivered to the city` },
      { key: '03', text: 'Camera follows the pipe as it descends' },
    ],
    accent: '#FFB45C',
    stripTitle: 'Pipe-follow',
    metrics: [
      { label: 'Heat delivered', value: rnd(M.heatDeliveredMWh / 1000, 1), unit: 'GWh / yr' },
      { label: 'Flow', value: rnd(M.flowLps), unit: 'L/s' },
    ],
    camera: { position: [2, -3, 1], target: [0, -6, 0] },
  },
  {
    id: 'underground',
    index: 6,
    shotIndex: 6,
    eyebrowNo: '06',
    eyebrow: 'Underground',
    title: ['The mains'],
    lede: `Warm mains fan out under the street at −6 m. About ${fmt(M.mainsKm, 1)} km of pipe, glowing with heat, ready to deliver to ${fmt(roundTens(M.homes))} homes.`,
    specs: [
      { key: '01', text: `≈ ${fmt(M.mainsKm, 1)} km of insulated district heating mains` },
      { key: '02', text: `${fmt(M.co2Tonnes)} t CO₂ / yr avoided vs. gas boilers` },
      { key: '03', text: `${usd(M.gasAvoidedUsd)} / yr city gas bill avoided` },
    ],
    accent: '#FFB45C',
    stripTitle: 'Underground',
    metrics: [
      { label: 'Mains', value: rnd(M.mainsKm, 1), unit: 'km' },
      $metric('Gas avoided', M.gasAvoidedUsd),
    ],
    camera: { position: [15, -6, 10], target: [0, -6, 0] },
  },
  {
    id: 'city',
    index: 7,
    shotIndex: 7,
    eyebrowNo: '07',
    eyebrow: 'Reuse',
    title: ['District energy'],
    lede: `As the heat arrives, buildings light up. About ${fmt(roundTens(M.homes))} homes get heat, and the city stops burning ${usd(M.gasAvoidedUsd)} of gas a year.`,
    specs: [
      { key: '01', text: `${fmt(roundTens(M.homes))} homes heated with waste data-centre heat` },
      { key: '02', text: `${fmt(M.co2Tonnes)} t CO₂ / yr avoided` },
      { key: '03', text: `${usd(M.carbonUsd)} / yr carbon value at $${A.carbonUsdPerT} / t` },
    ],
    accent: '#FFB45C',
    stripTitle: 'District energy',
    metrics: [
      { label: 'Homes heated', value: roundTens(M.homes), unit: '' },
      $metric('Carbon value', M.carbonUsd),
    ],
    camera: { position: [90, 110, 80], target: [-30, 0, -30] },
  },
  {
    id: 'close',
    index: 8,
    shotIndex: 8,
    eyebrowNo: '—',
    eyebrow: 'The loop closes',
    title: [`${usd(M.operatorCashUsd)} / yr.`, 'From heat we used to throw away.'],
    lede: `Cooling saved ${usd(M.coolingSavedUsd)} + heat sold ${usd(M.heatRevenueUsd)} − pumping ${usd(M.pumpUsd)} = ${usd(M.operatorCashUsd)} / yr. Payback in ${fmt(M.paybackYears, 1)} years.`,
    specs: [
      { key: '→', text: 'Modelled · assumptions editable in calculator' },
    ],
    accent: '#FFB45C',
    stripTitle: 'The loop closes',
    metrics: [
      { label: 'Payback', value: rnd(M.paybackYears, 1), unit: 'yr', decimals: 1 },
      $metric('Annual cash', M.operatorCashUsd),
    ],
    camera: { position: [90, 110, 80], target: [-30, 0, -30] },
  },
];

/**
 * Placeholder: Nine camera keys (one per shot). ts-stage will replace this with
 * a spline rig driven by shots.ts waypoints and hold zones.
 */
export const SHOTS: Shot[] = PHASES.map((p) => ({
  id: p.id,
  position: p.camera.position,
  target: p.camera.target,
  hold: 0.35,
}));

/** Continuous camera parameter runs 0..8 across the 9 scroll sections. */
export const PHASE_COUNT = 9;
