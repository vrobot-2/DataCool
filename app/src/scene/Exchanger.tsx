import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { useMaterialMaps } from './textures';

const PLATE_COUNT = 72;
const PLATE_PITCH = 0.0071;
const PLATE_START = -0.253;

/**
 * Procedural plate exchanger at the origin. The plate pack and ports run along three Z
 * (= Blender Y); ports at x = +-0.2, heights 0.5 / 1.05, as in the Blender asset.
 */
export function Exchanger({ accent }: { accent: string }) {
  const { metal, plate } = useMaterialMaps();
  const plates = useRef<THREE.InstancedMesh>(null);

  // 72 plates as one instanced draw call, alternating tint, chevron normal map
  useLayoutEffect(() => {
    const mesh = plates.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    for (let i = 0; i < PLATE_COUNT; i++) {
      dummy.position.set(0, 0.9, PLATE_START + i * PLATE_PITCH);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tint.set(i % 2 ? '#9AA4B2' : '#BAC3CE'));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  return (
    <group>
      {/* plate pack */}
      <instancedMesh ref={plates} args={[undefined, undefined, PLATE_COUNT]} castShadow receiveShadow>
        <boxGeometry args={[0.73, 1.27, 0.0056]} />
        <meshStandardMaterial color="#ffffff" metalness={0.9} roughness={0.3} {...plate} />
      </instancedMesh>

      {/* end frames */}
      {[-0.69, 0.69].map((z) => (
        <mesh key={z} position={[0, 0.86, z]} castShadow receiveShadow>
          <boxGeometry args={[0.86, 1.35, 0.07]} />
          <meshStandardMaterial color="#39414E" metalness={0.8} roughness={0.38} {...metal} />
        </mesh>
      ))}
      {/* tie rods + nuts */}
      {[-0.36, 0.36].map((x) =>
        [0.38, 1.34].map((y) => (
          <group key={`${x}-${y}`}>
            <mesh position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.021, 0.021, 1.5, 12]} />
              <meshStandardMaterial color="#C6CDD8" metalness={0.95} roughness={0.2} />
            </mesh>
            {[-0.72, 0.72].map((z) => (
              <mesh key={z} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.038, 0.038, 0.035, 6]} />
                <meshStandardMaterial color="#5A6372" metalness={0.9} roughness={0.3} />
              </mesh>
            ))}
          </group>
        )),
      )}
      {/* skid */}
      {[-0.31, 0.31].map((x) => (
        <mesh key={x} position={[x, 0.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.11, 0.16, 1.15]} />
          <meshStandardMaterial color="#262D38" metalness={0.7} roughness={0.5} {...metal} />
        </mesh>
      ))}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.07, 0.24]} />
        <meshStandardMaterial color="#222933" metalness={0.7} roughness={0.5} />
      </mesh>

      {/* ports: four faces, x = ±0.2, heights 0.5 / 1.05, along z */}
      {[-0.2, 0.2].map((x) =>
        [0.5, 1.05].map((y) =>
          [-1, 1].map((side) => (
            <group key={`${x}-${y}-${side}`} position={[x, y, side * 0.62]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.072, 0.072, 0.3, 20]} />
                <meshStandardMaterial color="#B4BDC9" metalness={0.92} roughness={0.24} />
              </mesh>
              <mesh position={[0, side * 0.14, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.138, 0.138, 0.028, 24]} />
                <meshStandardMaterial color="#8D97A6" metalness={0.9} roughness={0.3} />
              </mesh>
              <mesh position={[0, side * 0.155, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.102, 0.006, 8, 28]} />
                <meshStandardMaterial
                  color={accent}
                  emissive={accent}
                  emissiveIntensity={1.5}
                  toneMapped={false}
                />
              </mesh>
            </group>
          )),
        ),
      )}

      {/* nameplate + accent edge */}
      <mesh position={[0.31, 0.72, 0.735]}>
        <boxGeometry args={[0.16, 0.09, 0.008]} />
        <meshStandardMaterial color="#1A2029" metalness={0.6} roughness={0.45} />
      </mesh>
      <mesh position={[0.37, 0.9, 0]}>
        <boxGeometry args={[0.008, 1.24, 0.55]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.9}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
