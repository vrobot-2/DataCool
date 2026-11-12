import { useMemo } from 'react';
import * as THREE from 'three';
import { TubeGeometry } from 'three';
import { CatmullRomCurve3 } from 'three';

/**
 * Glass pipe overlays - translucent tubes with color bands for supply/return.
 * Renders over the baked opaque pipes with transmission for "flow inside" effect.
 */

interface PipeSegment {
  points: [number, number, number][];
  color: string;
  radius: number;
}

const INDIGO = '#7C8BFF'; // Cold/supply
const CRIMSON = '#FF6B57'; // Hot/return

/**
 * Main loop pipes from rack to exchanger - replace baked opaque copper.
 */
const LOOP_SEGMENTS: PipeSegment[] = [
  // Supply (cold, indigo) - from rack rear manifold to exchanger port
  {
    points: [
      [-3.2, 1.8, -2.0],  // Rack manifold connection
      [-3.0, 1.8, -1.5],
      [-2.0, 1.8, -0.8],
      [-1.0, 1.5, -0.3],
      [0, 1.05, 0],        // Exchanger top port
    ],
    color: INDIGO,
    radius: 0.05,
  },
  // Return (hot, crimson) - from exchanger to rack
  {
    points: [
      [0, 0.5, 0],         // Exchanger bottom port
      [-0.8, 0.5, -0.3],
      [-1.8, 0.7, -0.8],
      [-2.8, 1.0, -1.5],
      [-3.2, 1.2, -2.0],   // Rack manifold connection
    ],
    color: CRIMSON,
    radius: 0.05,
  },
];

function GlassPipe({ points, color, radius }: PipeSegment) {
  const geometry = useMemo(() => {
    const curve = new CatmullRomCurve3(
      points.map(p => new THREE.Vector3(...p)),
      false,
      'catmullrom',
      0.3
    );
    return new TubeGeometry(curve, 64, radius, 16, false);
  }, [points, radius]);

  const material = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.4,
      roughness: 0.1,
      metalness: 0.0,
      transmission: 0.6,
      thickness: 0.5,
      envMapIntensity: 1.0,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.15,
    });
  }, [color]);

  return <mesh geometry={geometry} material={material} />;
}

/**
 * Color band markers every ~0.5m for visual clarity.
 */
function BandMarker({ position, color, radius }: {
  position: [number, number, number];
  color: string;
  radius: number;
}) {
  return (
    <mesh position={position}>
      <torusGeometry args={[radius * 1.1, radius * 0.15, 8, 16]} />
      <meshStandardMaterial
        color={color}
        roughness={0.3}
        metalness={0.8}
        emissive={color}
        emissiveIntensity={0.2}
      />
    </mesh>
  );
}

export function GlassPipes() {
  return (
    <group>
      {LOOP_SEGMENTS.map((segment, i) => (
        <GlassPipe key={i} points={segment.points} color={segment.color} radius={segment.radius} />
      ))}
      
      {/* Color bands on supply pipe */}
      <BandMarker position={[-3.1, 1.8, -1.8]} color={INDIGO} radius={0.05} />
      <BandMarker position={[-2.5, 1.8, -1.2]} color={INDIGO} radius={0.05} />
      <BandMarker position={[-1.5, 1.65, -0.6]} color={INDIGO} radius={0.05} />
      
      {/* Color bands on return pipe */}
      <BandMarker position={[-0.6, 0.5, -0.25]} color={CRIMSON} radius={0.05} />
      <BandMarker position={[-1.5, 0.7, -0.7]} color={CRIMSON} radius={0.05} />
      <BandMarker position={[-2.5, 1.0, -1.3]} color={CRIMSON} radius={0.05} />
    </group>
  );
}
