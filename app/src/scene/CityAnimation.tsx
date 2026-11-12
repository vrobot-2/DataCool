import { useState, useMemo, useRef, useEffect, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getShotIndex } from './shots';

/**
 * City heat network animation: glowing lines light up buildings as heat arrives.
 * Loads scene.meta.json for network polylines and building positions, with fallback.
 */

interface BuildingNode {
  id: string;
  position: [number, number, number];
  networkDistance: number; // Distance along network from plant (m)
}

interface NetworkSegment {
  id: string;
  points: { x: number; y: number; z: number }[] | [number, number, number][];
}

/** meta.json is Blender-space (Z-up); GLB world is three-space (x, z, -y). */
function toVec3(p: { x: number; y: number; z: number } | [number, number, number]): THREE.Vector3 {
  if (Array.isArray(p)) return new THREE.Vector3(p[0], p[1], p[2]);
  return new THREE.Vector3(p.x, p.z, -p.y);
}

interface SceneMeta {
  network?: {
    polylines: NetworkSegment[];
  };
  buildings?: BuildingNode[];
}

const AMBER = '#FFB45C';

/**
 * Animated network line - grows from plant to building.
 */
function NetworkLine({ points, progress }: { points: { x: number; y: number; z: number }[] | [number, number, number][]; progress: number }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      points.map(toVec3),
      false,
      'catmullrom',
      0.1
    );
    const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.15, 8, false);
    return tubeGeo;
  }, [points]);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(AMBER),
      transparent: true,
      opacity: 0.8,
      emissive: new THREE.Color(AMBER),
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.0,
    });
  }, []);

  // Clip the geometry based on progress
  const mesh = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (mesh.current) {
      mesh.current.scale.z = Math.max(0.001, progress);
    }
  });

  return (
    <mesh ref={mesh} geometry={geometry} material={material} />
  );
}

/**
 * Building light-up indicator.
 */
function BuildingGlow({ position, active }: { position: [number, number, number]; active: boolean }) {
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(AMBER),
      transparent: true,
      opacity: active ? 0.6 : 0,
      emissive: new THREE.Color(AMBER),
      emissiveIntensity: active ? 3.0 : 0,
      roughness: 0.5,
      metalness: 0.0,
    });
  }, [active]);

  return (
    <mesh position={position}>
      <sphereGeometry args={[2, 8, 8]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/**
 * City network animation controller.
 */
export function CityAnimation({ cameraT }: { cameraT: MutableRefObject<number> }) {
  const [meta, setMeta] = useState<SceneMeta | null>(null);
  const shotIndex = getShotIndex(cameraT.current);

  // Load scene.meta.json if available
  useEffect(() => {
    fetch('/models/scene.meta.json')
      .then(res => res.ok ? res.json() : null)
      .then(data => setMeta(data))
      .catch(() => setMeta(null));
  }, []);

  // Fallback network if meta.json doesn't exist
  const fallbackNetwork: NetworkSegment[] = useMemo(() => [
    {
      id: 'main_x',
      points: [
        [-30, 0.1, -30],   // Plant center
        [-80, 0.1, -30],
        [-100, 0.1, -30],
      ],
    },
    {
      id: 'main_z',
      points: [
        [-30, 0.1, -30],
        [-30, 0.1, -80],
        [-30, 0.1, -100],
      ],
    },
  ], []);

  const fallbackBuildings: BuildingNode[] = useMemo(() => [
    { id: 'b1', position: [-80, 0, -30], networkDistance: 50 },
    { id: 'b2', position: [-100, 0, -30], networkDistance: 70 },
    { id: 'b3', position: [-30, 0, -80], networkDistance: 50 },
    { id: 'b4', position: [-30, 0, -100], networkDistance: 70 },
  ], []);

  const network = meta?.network?.polylines || fallbackNetwork;
  const buildings = meta?.buildings || fallbackBuildings;

  // Animation progress: heat leaves the plant during the pipe-follow shot,
  // spreads underground, and reaches the whole district by the close.
  const progress = useMemo(() => {
    return Math.min(1, Math.max(0, (cameraT.current - 4.5) / 3.5));
  }, [cameraT.current]);

  // Calculate which buildings are lit based on heat propagation
  const activeBuildingIds = useMemo(() => {
    const maxDistance = progress * 120; // Heat travels 120m at full progress
    return new Set(buildings.filter(b => b.networkDistance <= maxDistance).map(b => b.id));
  }, [progress, buildings]);

  // Render from the pipe-follow shot onward: the mains are underground first,
  // then rise into the district (continuity with shots 5-8).
  if (shotIndex < 5) return null;

  return (
    <group position={[0, 0, 0]}>
      {/* Network lines */}
      {network.map(segment => (
        <NetworkLine key={segment.id} points={segment.points} progress={progress} />
      ))}
      
      {/* Building glows */}
      {buildings.map(building => {
        const [bx, by, bz] = building.position;
        return (
          <BuildingGlow
            key={building.id}
            position={[bx, bz, -by]}
            active={activeBuildingIds.has(building.id)}
          />
        );
      })}
    </group>
  );
}
