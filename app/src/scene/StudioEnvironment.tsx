import { useMemo } from 'react';
import { Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { getShotIndex } from './shots';

/**
 * Per-shot environment configuration.
 * Studio stage for rack/manifold, industrial for hall/plant, cutaway for underground, dusk for city.
 */
interface EnvConfig {
  /** Environment preset or custom. */
  preset?: 'studio' | 'warehouse' | 'dawn' | 'sunset';
  /** Lightformer intensity multiplier. */
  intensity: number;
  /** Color tint for environment. */
  tint: string;
  /** Whether to show studio floor reflections. */
  floor: boolean;
}

const ENV_CONFIGS: EnvConfig[] = [
  // 0: Establish - studio
  { preset: 'studio', intensity: 1.0, tint: '#E0E8FF', floor: true },
  // 1: Rack macro - studio, brighter
  { preset: 'studio', intensity: 1.2, tint: '#E8F0FF', floor: true },
  // 2: Manifold - studio with accent
  { preset: 'studio', intensity: 1.0, tint: '#D8E4FF', floor: true },
  // 3: Hall - warehouse/industrial
  { preset: 'warehouse', intensity: 0.8, tint: '#C8D4E8', floor: false },
  // 4: Plant - industrial
  { preset: 'warehouse', intensity: 0.9, tint: '#D0DCF0', floor: false },
  // 5: Pipe-follow - dark
  { intensity: 0.4, tint: '#8090A8', floor: false },
  // 6: Underground - very dark
  { intensity: 0.3, tint: '#606878', floor: false },
  // 7: City rise - warm dusk
  { preset: 'sunset', intensity: 1.2, tint: '#FFE8D0', floor: false },
  // 8: Close - dusk
  { preset: 'sunset', intensity: 1.0, tint: '#FFE0C8', floor: false },
];

/**
 * Studio environment with Lightformers - no plain backgrounds.
 */
export function StudioEnvironment({ cameraT }: { cameraT: number }) {
  const shotIndex = getShotIndex(cameraT);
  const config = ENV_CONFIGS[shotIndex] || ENV_CONFIGS[0];
  
  const tintColor = useMemo(() => new THREE.Color(config.tint), [config.tint]);

  return (
    <>
      <Environment resolution={256} background={false}>
        {/* Top softbox - key light */}
        <Lightformer
          form="rect"
          intensity={config.intensity * 3}
          color={tintColor}
          position={[0, 8, 0]}
          rotation-x={Math.PI / 2}
          scale={[8, 8, 1]}
        />
        
        {/* Rim light - warm accent */}
        <Lightformer
          form="rect"
          intensity={config.intensity * 2}
          color="#FFE0C8"
          position={[-8, 4, -4]}
          rotation-y={Math.PI / 4}
          scale={[4, 6, 1]}
        />
        
        {/* Fill strips */}
        <Lightformer
          form="rect"
          intensity={config.intensity * 1.5}
          color={tintColor}
          position={[6, 2, 4]}
          rotation-y={-Math.PI / 3}
          scale={[2, 8, 1]}
        />
        
        <Lightformer
          form="rect"
          intensity={config.intensity * 1.2}
          color="#D0E0FF"
          position={[-4, 3, 6]}
          rotation-y={Math.PI / 6}
          scale={[3, 6, 1]}
        />
        
        {/* Ambient fill - prevents black holes */}
        <Lightformer
          form="ring"
          intensity={config.intensity * 0.8}
          color={tintColor}
          position={[0, 0, -10]}
          scale={[10, 10, 1]}
        />
      </Environment>
      
      {/* Studio floor - glossy reflections for rack/manifold shots */}
      {config.floor && (
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[600, 600]} />
          <MeshReflectorMaterial
            blur={[400, 100]}
            resolution={512}
            mixBlur={0.8}
            mixStrength={0.35}
            roughness={0.6}
            depthScale={1.1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.2}
            color="#0B0E13"
            metalness={0.4}
            mirror={0.35}
          />
        </mesh>
      )}
    </>
  );
}
