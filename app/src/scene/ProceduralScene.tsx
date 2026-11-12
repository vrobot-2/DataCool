import { useEffect } from 'react';
import { ContactShadows, Grid } from '@react-three/drei';
import { District } from './District';
import { Exchanger } from './Exchanger';
import { RETURN, SUPPLY } from './paths';
import { PipeRun } from './primitives';
import { Rack } from './Rack';
import { disposeTextures } from './textures';

/** Procedural stand-in for scene.glb, in the same (Blender-derived) axes. */
export function ProceduralScene({ accent }: { accent: string }) {
  useEffect(() => disposeTextures, []);

  return (
    <group>
      {/* oversized so fog, not an edge, ends the ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[1400, 1400]} />
        <meshStandardMaterial color="#0B0E15" metalness={0.15} roughness={0.94} />
      </mesh>
      <Grid
        args={[440, 440]}
        position={[0, 0.015, 0]}
        cellSize={5}
        cellThickness={0.5}
        cellColor="#1A2130"
        sectionSize={25}
        sectionThickness={0.85}
        sectionColor="#283450"
        fadeDistance={280}
        fadeStrength={1.4}
        infiniteGrid={false}
      />

      <Rack accent={accent} />
      <Exchanger accent={accent} />
      <District accent={accent} />

      {/* process loop from rack manifold to exchanger ports: hot supply, cooled return */}
      <PipeRun points={SUPPLY} color="#FF6B57" />
      <PipeRun points={RETURN} color="#7C8BFF" />

      <ContactShadows
        position={[-1.6, 0.02, -0.9]}
        scale={14}
        opacity={0.6}
        blur={2.8}
        far={4}
        resolution={512}
        color="#000000"
      />
    </group>
  );
}
