import { useMemo } from 'react';
import * as THREE from 'three';

/*
 * Runtime procedural textures (<= 512 px, greyscale, cached). Used by the procedural
 * fallback scene; the GLB carries its own baked textures. Window lights are done in a
 * world-space shader patch instead of an atlas (see windows.ts), which needs no UVs.
 */

const cache = new Map<string, THREE.Texture>();

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function canvasTexture(
  key: string,
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit as THREE.CanvasTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

/** Brushed metal: horizontal streaks. Used as roughness (G channel) and bump. */
export function brushedMetalTexture() {
  return canvasTexture('brushed', 512, (ctx, n) => {
    const r = rng(11);
    ctx.fillStyle = '#d2d2d2';
    ctx.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) {
      const g = 150 + Math.floor(r() * 105);
      ctx.fillStyle = `rgba(${g},${g},${g},${0.15 + r() * 0.3})`;
      const w = 40 + r() * 360;
      const x = r() * n;
      const y = r() * n;
      ctx.fillRect(x, y, w, 1);
      ctx.fillRect(x - n, y, w, 1); // wrap so it tiles
    }
  });
}

/** Concrete: fine grain plus soft blotches. */
export function concreteTexture() {
  return canvasTexture('concrete', 512, (ctx, n) => {
    const r = rng(23);
    const img = ctx.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const g = 175 + Math.floor(r() * 80);
      img.data.set([g, g, g, 255], i * 4);
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 160; i++) {
      const x = r() * n;
      const y = r() * n;
      const rad = 12 + r() * 60;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const g = r() > 0.5 ? 255 : 120;
      grd.addColorStop(0, `rgba(${g},${g},${g},0.12)`);
      grd.addColorStop(1, `rgba(${g},${g},${g},0)`);
      ctx.fillStyle = grd;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
}

/** Herringbone chevron normal map for plate-exchanger plates (10 chevron rows per tile). */
export function chevronNormalTexture() {
  return canvasTexture('chevron', 256, (ctx, n) => {
    const rows = 10;
    const slope = 5;
    const height = (x: number, y: number) => {
      const v = y * rows + Math.abs(x - 0.5) * slope;
      return Math.abs(v - Math.floor(v) - 0.5) * 2;
    };
    const img = ctx.createImageData(n, n);
    const e = 1 / n;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = i / n;
        const y = j / n;
        const dx = (height(x + e, y) - height(x - e, y)) / (2 * e);
        const dy = (height(x, y + e) - height(x, y - e)) / (2 * e);
        const s = 0.012;
        const nx = -dx * s;
        const ny = dy * s; // canvas y is flipped relative to uv v
        const inv = 1 / Math.hypot(nx, ny, 1);
        img.data.set(
          [(nx * inv * 0.5 + 0.5) * 255, (ny * inv * 0.5 + 0.5) * 255, (inv * 0.5 + 0.5) * 255, 255],
          (j * n + i) * 4,
        );
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

export function disposeTextures() {
  cache.forEach((t) => t.dispose()); // three re-uploads on next use, so the cache stays valid
}

/** Spreadable material props. */
export function useMaterialMaps() {
  return useMemo(() => {
    const brushed = brushedMetalTexture();
    const concrete = concreteTexture();
    const chevron = chevronNormalTexture();
    return {
      metal: { roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.5 },
      concrete: { roughnessMap: concrete, bumpMap: concrete, bumpScale: 0.8 },
      plate: { normalMap: chevron, normalScale: new THREE.Vector2(0.7, 0.7) },
    };
  }, []);
}
