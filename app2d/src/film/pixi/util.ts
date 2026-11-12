import { Texture } from 'pixi.js';

export type P = [number, number];

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Polyline with rounded corners, sampled (quadratic corners, `seg` samples each). */
export function roundedPoints(pts: P[], r = 26, seg = 8): P[] {
  if (r <= 0 || pts.length < 3) return pts.slice();
  const out: P[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(cx - px, cy - py);
    const l2 = Math.hypot(nx - cx, ny - cy);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ax = cx - ((cx - px) / l1) * rr;
    const ay = cy - ((cy - py) / l1) * rr;
    const bx = cx + ((nx - cx) / l2) * rr;
    const by = cy + ((ny - cy) / l2) * rr;
    out.push([ax, ay]);
    for (let k = 1; k < seg; k++) {
      const t = k / seg;
      const u = 1 - t;
      out.push([u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by]);
    }
    out.push([bx, by]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export interface Path {
  pts: P[];
  cum: number[];
  length: number;
}

export function makePath(pts: P[]): Path {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return { pts, cum, length: cum[cum.length - 1] };
}

/** Position at arc length s (clamped); writes into `out`. */
export function pathAt(path: Path, s: number, out: P): void {
  const { pts, cum } = path;
  if (s <= 0) {
    out[0] = pts[0][0];
    out[1] = pts[0][1];
    return;
  }
  if (s >= path.length) {
    const l = pts[pts.length - 1];
    out[0] = l[0];
    out[1] = l[1];
    return;
  }
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const f = (s - cum[i - 1]) / seg;
  out[0] = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f;
  out[1] = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f;
}

/** Texture from a 2D canvas drawing (gradients, soft dots). */
export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx);
  return Texture.from(c);
}

export const hex = (s: string) => parseInt(s.replace('#', ''), 16);
