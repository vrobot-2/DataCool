/**
 * Camera for the 2D film: a scroll-driven pan/zoom across one long SVG "world".
 * t runs 0..8 (one integer per phase). Between waypoints we ease with a dwell
 * so every shot holds still for a moment, then moves.
 */
export interface Waypoint {
  /** world-space centre */
  x: number;
  y: number;
  /** visible world width (zoom: smaller = closer) */
  w: number;
}

export const WORLD = { x0: -600, x1: 5600, groundY: 700, bottomY: 3400 };

export const WAYPOINTS: Waypoint[] = [
  { x: 1650, y: 400, w: 3700 }, // 0 intro: the whole loop
  { x: 330, y: 430, w: 800 }, // 1 rack: cold plates
  { x: 560, y: 170, w: 1350 }, // 2 manifold + overhead headers
  { x: 780, y: 420, w: 1800 }, // 3 data hall row
  { x: 1960, y: 480, w: 1150 }, // 4 plant room + exchanger
  { x: 2720, y: 760, w: 1500 }, // 5 follow the pipe out and down
  { x: 3500, y: 900, w: 1900 }, // 6 underground main
  { x: 3950, y: 430, w: 2500 }, // 7 city rises
  { x: 2500, y: 540, w: 5600 }, // 8 close: whole story
];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Dwell: hold the shot for the first 28 % and last 12 %, move in between. */
export function shotEase(f: number) {
  return smooth(clamp((f - 0.28) / 0.6, 0, 1));
}

export function cameraAt(t: number): Waypoint {
  const tt = clamp(t, 0, WAYPOINTS.length - 1);
  const i = Math.min(WAYPOINTS.length - 2, Math.floor(tt));
  const s = shotEase(tt - i);
  const a = WAYPOINTS[i];
  const b = WAYPOINTS[i + 1];
  return {
    x: a.x + (b.x - a.x) * s,
    y: a.y + (b.y - a.y) * s,
    w: Math.exp(Math.log(a.w) + (Math.log(b.w) - Math.log(a.w)) * s),
  };
}

/** 0..1: the exchanger "peels away" while the camera rests on the plant (t = 4). */
export function peelAt(t: number) {
  const a = smooth(clamp((t - 3.78) / 0.32, 0, 1));
  const b = smooth(clamp((t - 4.3) / 0.32, 0, 1));
  return a * (1 - b);
}

/** 0..1 weight for a window of t (used to fade layers/effects). */
export const win = (t: number, a: number, b: number, fade = 0.5) =>
  clamp(Math.min((t - a) / fade, (b - t) / fade), 0, 1);
