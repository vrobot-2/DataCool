import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MutableRefObject } from 'react';

/**
 * Shot-based visibility culling for the GLB scene graph.
 *
 * Node contract (baked GLB): district__baked, district__Ground, environment__Ground,
 * exchanger__baked, loops__baked, rack__baked (+ rack__rack_01..10 instance groups,
 * scale-0 in the GLB - hall framing comes from rack__baked).
 *
 * One subject set per shot prevents cross-shot bleed (continuity bugs):
 * 0-2 studio rack+exchanger, 3 hall, 4 plant exchanger, 5-6 loops,
 * 7-8 district. Runs per-frame off cameraT, no React re-render.
 */

const NODES = ['rack__baked', 'exchanger__baked', 'loops__baked', 'district__baked', 'district__Ground'] as const;

const SHOT_SUBJECTS: Record<number, string[]> = {
  0: ['rack__baked', 'exchanger__baked', 'loops__baked'],
  1: ['rack__baked', 'loops__baked'],
  2: ['rack__baked', 'exchanger__baked', 'loops__baked'],
  3: ['rack__baked', 'exchanger__baked', 'loops__baked'],
  4: ['exchanger__baked', 'loops__baked'],
  5: ['loops__baked'],
  6: ['loops__baked'],
  7: ['district__baked', 'district__Ground'],
  8: ['district__baked', 'district__Ground'],
};

export function VisibilityCuller({
  cameraT,
  model,
}: {
  cameraT: MutableRefObject<number>;
  model: THREE.Group | null;
}) {
  const applied = useRef(-1);

  useFrame(() => {
    if (!model) return;
    const idx = Math.min(8, Math.max(0, Math.floor(cameraT.current)));
    if (idx === applied.current) return;
    applied.current = idx;

    const on = new Set(SHOT_SUBJECTS[idx]);
    for (const name of NODES) {
      const node = model.getObjectByName(name);
      if (node) node.visible = on.has(name);
    }
    // Instance groups are scale-0 duplicates; keep them hidden always.
    for (let i = 1; i <= 10; i++) {
      const g = model.getObjectByName('rack__rack_' + String(i).padStart(2, '0'));
      if (g) g.visible = false;
    }
  });

  return null;
}
