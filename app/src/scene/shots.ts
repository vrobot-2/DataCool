import { Vector3Tuple } from 'three';

/**
 * Shot definition: position, target, optional hold zone, hero anchor point, and optional FOV.
 * 
 * Shots map to scroll sections 0..8 (intro, rack, manifold, hall, plant, follow, 
 * underground, city, close) + calculator. cameraT runs continuously 0..8.
 * 
 * Three.js coordinates = (x, z, -y) of Blender world.
 */
export interface Shot {
  /** Shot identifier matching section id. */
  id: string;
  /** Camera position in three.js world (x, z, -y of Blender). */
  position: Vector3Tuple;
  /** Look-at target. */
  target: Vector3Tuple;
  /** Optional hold zone: [start, end] as fraction of this shot's t range (0..1). Camera nearly still in this zone. */
  hold?: [number, number];
  /** Hero figure anchor point in world space (where to pin the floating number). */
  heroAnchor: Vector3Tuple;
  /** Optional FOV override (degrees). Default 34. */
  fov?: number;
}

/**
 * Nine shots for the scroll story (0..8). cameraT interpolates through these.
 * 
 * Shot 0: Establish - rack + exchanger on studio stage
 * Shot 1: Rack macro - cold plates + quick disconnects  
 * Shot 2: Manifold dolly - riser + valves, pulls back
 * Shot 3: Data hall - row of racks, ceiling, headers (NEW)
 * Shot 4: Plant room - exchanger, pumps, headers (NEW)
 * Shot 5: Pipe-follow - rides supply main through wall and down (NEW)
 * Shot 6: Underground cutaway - glowing mains in earth slice (NEW)
 * Shot 7: City rise - exits ground, rises to diorama (NEW)
 * Shot 8: Close - whole diorama lit, loop closes
 */
export const SHOTS: Shot[] = [
  // Shot 0: Establish
  {
    id: 'intro',
    position: [6, 1.6, -4],
    target: [-1.5, 0.8, -0.5],
    hold: [0.3, 0.65],
    heroAnchor: [0, 0.8, 0],
    fov: 34,
  },
  // Shot 1: Rack macro - close on cold plates
  {
    id: 'rack',
    position: [-3.0, 1.2, -1.2],
    target: [-3.2, 0.8, -1.8],
    hold: [0.25, 0.6],
    heroAnchor: [-3.2, 0.8, -1.8],
    fov: 40, // Wider for macro detail
  },
  // Shot 2: Manifold dolly - pulls back along pipes
  {
    id: 'manifold',
    position: [-3.5, 1.8, -0.5],
    target: [-3.2, 1.2, -2.0],
    hold: [0.3, 0.65],
    heroAnchor: [-3.2, 1.4, -1.5],
  },
  // Shot 3: Data hall - NEW, row of racks
  {
    id: 'hall',
    position: [-8, 2.5, -5],
    target: [-6, 1.1, -3],
    hold: [0.3, 0.7],
    heroAnchor: [-6, 2.0, -3],
  },
  // Shot 4: Plant room - exchanger close-up (subject at origin)
  {
    id: 'plant',
    position: [1.6, 1.4, 2.2],
    target: [0, 0.8, 0],
    hold: [0.25, 0.65],
    heroAnchor: [0, 0.8, 0.8],
  },
  // Shot 5: Pipe-follow - descend from plant toward the underground mains
  {
    id: 'follow',
    position: [-14, 2, -14],
    target: [-30, -2, -30],
    hold: [0.2, 0.5],
    heroAnchor: [-22, 0, -22],
  },
  // Shot 6: Underground - glowing mains fan out from the plant
  {
    id: 'underground',
    position: [-70, 18, 8],
    target: [-40, -1, -30],
    hold: [0.3, 0.7],
    heroAnchor: [-45, 2, -25],
  },
  // Shot 7: City rise - pull up out of the ground toward the district
  {
    id: 'city',
    position: [260, 200, 260],
    target: [-30, 0, -30],
    hold: [0.25, 0.6],
    heroAnchor: [-30, 40, -30],
  },
  // Shot 8: Close - wide on lit diorama, different angle from shot 7
  {
    id: 'close',
    position: [-330, 240, 180],
    target: [0, 0, -40],
    hold: [0.35, 0.75],
    heroAnchor: [0, 55, -40],
  },
];

/**
 * Get shot index from cameraT (0..8).
 */
export function getShotIndex(cameraT: number): number {
  return Math.min(SHOTS.length - 1, Math.max(0, Math.floor(cameraT)));
}

/**
 * Get current shot and interpolation fraction within it.
 */
export function getCurrentShot(cameraT: number): { shot: Shot; nextShot: Shot | null; fraction: number } {
  const t = Math.max(0, Math.min(SHOTS.length - 1, cameraT));
  const index = Math.floor(t);
  const fraction = t - index;
  
  return {
    shot: SHOTS[index],
    nextShot: index < SHOTS.length - 1 ? SHOTS[index + 1] : null,
    fraction,
  };
}
