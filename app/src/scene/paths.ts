import type { Vec3 } from '../data/phases';

/*
 * Flow / pipe paths in three coordinates, converted from pipeline/scene_layout.json
 * with Blender (x, y, z) -> three (x, z, -y).
 */

/** Rack riser (x=-3.0) top -> exchanger front port (-0.2, 1.05). Hot side. */
export const SUPPLY: Vec3[] = [
  [-3.0, 1.9, -1.52],
  [-3.0, 1.9, -1.0],
  [-3.0, 1.05, -1.0],
  [-0.2, 1.05, -1.0],
  [-0.2, 1.05, -0.664],
];

/** Rack riser (x=-3.4) <- exchanger front port (0.2, 0.5). Cold side (listed rack -> exchanger). */
export const RETURN: Vec3[] = [
  [-3.4, 0.35, -1.52],
  [-3.4, 0.35, -0.95],
  [0.2, 0.35, -0.95],
  [0.2, 0.5, -0.95],
  [0.2, 0.5, -0.664],
];

/** Hot riser up the rack rear, then the supply pipe. */
export const SUPPLY_FLOW: Vec3[] = [[-3.0, 0.3, -1.53], ...SUPPLY];

/** Return pipe from the exchanger back to the cold riser, then up the riser. */
export const RETURN_FLOW: Vec3[] = [...RETURN].reverse().concat([[-3.4, 1.55, -1.52]]);

/** One short loop per tray: cold riser -> cold plate -> hot riser. */
export const BRANCHES: Vec3[][] = Array.from({ length: 8 }, (_, i) => {
  const y = 0.25 + i * 0.18 + 0.075;
  return [
    [-3.4, y, -1.53],
    [-3.4, y, -1.8],
    [-3.2, y, -2.3],
    [-3.0, y, -1.8],
    [-3.0, y, -1.53],
  ] as Vec3[];
});

/** Primary (hot -> cold) lane through the plate pack. */
export const LANE_HOT: Vec3[] = [
  [-0.2, 1.05, -0.664],
  [-0.2, 1.05, 0.15],
  [0.2, 0.5, 0.15],
  [0.2, 0.5, -0.664],
];

/** Secondary (district water, counter-flow) lane through the plate pack. */
export const LANE_COLD: Vec3[] = [
  [-0.2, 0.5, 0.664],
  [-0.2, 0.5, -0.15],
  [0.2, 1.05, -0.15],
  [0.2, 1.05, 0.664],
];

/** District mains, fanning out from the plant centre (-30, -30) along MainX / MainY. */
export const MAINS: Vec3[][] = [
  [[-30, 0.5, -30], [90, 0.5, -30]],
  [[-30, 0.5, -30], [-150, 0.5, -30]],
  [[-30, 0.5, -30], [-30, 0.5, 90]],
  [[-30, 0.5, -30], [-30, 0.5, -150]],
];
