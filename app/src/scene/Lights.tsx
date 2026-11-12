import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getShotIndex } from './shots';

/**
 * Volumetric light cone - additive mesh with noise for fake volumetrics.
 */
function VolumeCone({ position, target, color, intensity = 1, spread = 0.3 }: {
  position: [number, number, number];
  target: [number, number, number];
  color: string;
  intensity?: number;
  spread?: number;
}) {
  const geometry = useMemo(() => {
    const cone = new THREE.ConeGeometry(spread, 
      Math.sqrt((position[0] - target[0]) ** 2 + (position[1] - target[1]) ** 2 + (position[2] - target[2]) ** 2),
      16, 1, true);
    return cone;
  }, [position, target, spread]);
  
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: intensity * 0.08,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [color, intensity]);
  
  const rotation = useMemo(() => {
    const dir = new THREE.Vector3(target[0] - position[0], target[1] - position[1], target[2] - position[2]).normalize();
    const up = new THREE.Vector3(0, -1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir);
    const euler = new THREE.Euler().setFromQuaternion(quaternion);
    return [euler.x, euler.y, euler.z] as [number, number, number];
  }, [position, target]);

  return (
    <mesh geometry={geometry} material={material} position={position} rotation={rotation} />
  );
}

/**
 * Per-shot lighting configurations.
 */
export function Lights({ accent, cameraT }: { accent: string; cameraT: number }) {
  const shotIndex = getShotIndex(cameraT);
  
  // Adjust lighting intensity per shot
  const ambientIntensity = shotIndex >= 5 && shotIndex <= 6 ? 0.25 : 0.42;
  const keyIntensity = shotIndex >= 5 && shotIndex <= 6 ? 1.8 : 2.7;
  
  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      <hemisphereLight color="#9FB2FF" groundColor="#0B0E13" intensity={0.5} />
      
      {/* Key light with shadows */}
      <directionalLight
        castShadow
        position={[9, 14, 9]}
        intensity={keyIntensity}
        color="#F2F5FF"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
      />
      
      {/* Accent-colored rim/kicker */}
      <directionalLight position={[-10, 5, -7]} intensity={1.35} color={accent} />
      
      {/* Cool fill lights */}
      <directionalLight position={[2, 3, 11]} intensity={0.7} color="#BFD0FF" />
      <directionalLight position={[-4, 4, -10]} intensity={0.9} color="#BFD0FF" />
      
      {/* Accent point light */}
      <pointLight position={[0, 1.4, -2.2]} intensity={26} distance={10} decay={2} color={accent} />
      
      {/* Volumetric cones for studio shots (0-2) */}
      {shotIndex <= 2 && (
        <>
          <VolumeCone position={[9, 14, 9]} target={[0, 0, 0]} color="#E8F0FF" intensity={1.2} spread={4} />
          <VolumeCone position={[-10, 5, -7]} target={[0, 0, 0]} color={accent} intensity={0.8} spread={2.5} />
        </>
      )}
    </>
  );
}

/**
 * Soft image-based lighting for the baked GLB: its stainless/copper materials are fully
 * metallic and render nearly black without an environment map.
 */
export function GlbEnvironment({ intensity = 0.5 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    const previous = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    scene.environment = target.texture;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = previous;
      scene.environmentIntensity = previousIntensity;
      target.dispose();
      room.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, intensity]);

  return null;
}
