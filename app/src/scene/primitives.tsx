import { useMemo } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '../data/phases';

export function Beam({
  from,
  to,
  radius,
  color,
  emissive = 1.1,
}: {
  from: Vec3;
  to: Vec3;
  radius: number;
  color: string;
  emissive?: number;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    const len = direction.length();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    return { position: mid, quaternion: q, length: len };
  }, [from, to]);

  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, length, 10, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissive}
        roughness={0.38}
        metalness={0.55}
        toneMapped={false}
      />
    </mesh>
  );
}

export function Cable({
  points,
  color,
  radius = 0.032,
  accent = 0.55,
}: {
  points: Vec3[];
  color: string;
  radius?: number;
  accent?: number;
}) {
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
    [points],
  );
  return (
    <mesh castShadow>
      <tubeGeometry args={[curve, 48, radius, 8, false]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={accent}
        metalness={0.7}
        roughness={0.3}
      />
    </mesh>
  );
}

/**
 * Straight-segment pipe run with spherical elbows and flanges at both ends: the
 * procedural twin of the Blender loop pipes (pipeline/assemble.py build_pipe_run).
 */
export function PipeRun({
  points,
  color,
  radius = 0.05,
  elbowRadius = 0.06,
  flangeRadius = 0.09,
  flangeThickness = 0.036,
  emissive = 0.55,
}: {
  points: Vec3[];
  color: string;
  radius?: number;
  elbowRadius?: number;
  flangeRadius?: number;
  flangeThickness?: number;
  emissive?: number;
}) {
  const flanges = useMemo(() => {
    const make = (p: Vec3, other: Vec3) => {
      const dir = new THREE.Vector3(...p).sub(new THREE.Vector3(...other)).normalize();
      return {
        position: p,
        quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir),
      };
    };
    return [
      make(points[0], points[1]),
      make(points[points.length - 1], points[points.length - 2]),
    ];
  }, [points]);

  return (
    <group>
      {points.slice(0, -1).map((p, i) => (
        <Beam
          key={`seg-${i}`}
          from={p}
          to={points[i + 1]}
          radius={radius}
          color={color}
          emissive={emissive}
        />
      ))}
      {points.slice(1, -1).map((p, i) => (
        <mesh key={`elbow-${i}`} position={p} castShadow>
          <sphereGeometry args={[elbowRadius, 14, 10]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={emissive}
            metalness={0.55}
            roughness={0.38}
            toneMapped={false}
          />
        </mesh>
      ))}
      {flanges.map((f, i) => (
        <mesh key={`flange-${i}`} position={f.position} quaternion={f.quaternion} castShadow>
          <cylinderGeometry args={[flangeRadius, flangeRadius, flangeThickness, 24]} />
          <meshStandardMaterial color="#8D97A6" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}
