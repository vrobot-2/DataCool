import type { Vec3 } from '../data/phases';
import { Beam } from './primitives';
import { useMaterialMaps } from './textures';
import { windowMaterialProps } from './windows';

/**
 * The Blender district is offset so the central plant sits at three (-30, 0, -30)
 * (Blender (-30, +30)); the slab is 240 m square around that point and the hero equipment
 * stays at the origin. Everything below is authored in district-local coordinates and
 * placed with this offset, for both the procedural fallback and the GLB overlay.
 */
export const DISTRICT_ORIGIN: Vec3 = [-30, 0, -30];

/** Nearest buildings must stay at least this far from the hero equipment at the origin. */
const CLEARANCE = 35;

interface Block {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

const BLOCKS: Block[] = (() => {
  const blocks: Block[] = [];
  const grid = [-95, -55, 55, 95];
  grid.forEach((x, xi) =>
    grid.forEach((z, zi) => {
      const seed = Math.abs(Math.sin((xi + 1) * 12.9898 + (zi + 1) * 78.233));
      const w = 16 + ((xi * 7 + zi * 11) % 3) * 7;
      const d = 16 + ((xi + zi * 2) % 3) * 6;
      const h = 16 + Math.round(seed * 48);
      blocks.push({ x, z, w, d, h });
    }),
  );
  blocks.push({ x: 0, z: -108, w: 32, d: 24, h: 56 });
  blocks.push({ x: 0, z: 108, w: 24, d: 18, h: 40 });
  return blocks.filter((b) => {
    const wx = b.x + DISTRICT_ORIGIN[0];
    const wz = b.z + DISTRICT_ORIGIN[2];
    const dx = Math.max(Math.abs(wx) - b.w / 2, 0);
    const dz = Math.max(Math.abs(wz) - b.d / 2, 0);
    return Math.hypot(dx, dz) >= CLEARANCE;
  });
})();

/** Glowing trunk mains at grade: MainX / MainY crossing under the plant, +-120 m. */
export function SurfaceMains({ accent }: { accent: string }) {
  return (
    <>
      <Beam from={[0, 0.09, -120]} to={[0, 0.09, 120]} radius={0.22} color={accent} emissive={1.5} />
      <Beam from={[-120, 0.09, 0]} to={[120, 0.09, 0]} radius={0.22} color={accent} emissive={1.5} />
    </>
  );
}

/** Mains overlay for the baked GLB, whose real mains are buried under the opaque slab. */
export function GlbMains({ accent }: { accent: string }) {
  return (
    <group position={DISTRICT_ORIGIN}>
      <SurfaceMains accent={accent} />
    </group>
  );
}

export function District({ accent }: { accent: string }) {
  const { concrete } = useMaterialMaps();
  return (
    <group position={DISTRICT_ORIGIN}>
      {BLOCKS.map((b, i) => (
        <group key={`${b.x}-${b.z}`} position={[b.x, 0, b.z]}>
          <mesh position={[0, b.h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial
              color="#10151E"
              metalness={0.3}
              roughness={0.78}
              {...concrete}
              {...windowMaterialProps}
            />
          </mesh>
          {i % 3 === 0 && (
            <mesh position={[b.w * 0.18, b.h * 0.8, 0]} castShadow>
              <boxGeometry args={[b.w * 0.55, b.h * 0.4, b.d * 0.62]} />
              <meshStandardMaterial
                color="#151B25"
                metalness={0.35}
                roughness={0.7}
                {...concrete}
                {...windowMaterialProps}
              />
            </mesh>
          )}
          <mesh position={[b.w / 2 + 0.12, b.h * 0.72, 0]}>
            <boxGeometry args={[0.08, 0.45, b.d * 0.55]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={1.4}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, b.h + 0.5, 0]}>
            <boxGeometry args={[Math.max(1.2, b.w * 0.14), 1, Math.max(1.2, b.d * 0.14)]} />
            <meshStandardMaterial color="#232C39" metalness={0.6} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* central plant: 30 x 30 x 15 m box at the district centre, four stacks up to ~23 m */}
      <group>
        <mesh position={[0, 7.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[30, 15, 30]} />
          <meshStandardMaterial color="#141B25" metalness={0.45} roughness={0.62} {...concrete} />
        </mesh>
        <mesh position={[0, 15.2, 0]}>
          <boxGeometry args={[24, 0.4, 24]} />
          <meshStandardMaterial color="#1C2531" metalness={0.6} roughness={0.5} />
        </mesh>
        {[-12, 12].map((x) =>
          [-12, 12].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 19, z]} castShadow>
              <cylinderGeometry args={[1.5, 1.5, 8, 16]} />
              <meshStandardMaterial color="#3B4454" metalness={0.7} roughness={0.4} />
            </mesh>
          )),
        )}
        <mesh position={[0, 8, 15.2]}>
          <boxGeometry args={[15, 0.5, 0.1]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* warm mains fanning out under the streets */}
      <SurfaceMains accent={accent} />
      <Beam from={[-55, 0.09, 0]} to={[-55, 0.09, -55]} radius={0.12} color={accent} emissive={1.2} />
      <Beam from={[55, 0.09, 0]} to={[55, 0.09, 55]} radius={0.12} color={accent} emissive={1.2} />
      <Beam from={[0, 0.09, 0]} to={[0, 0.09, 55]} radius={0.12} color={accent} emissive={1.2} />

      {/* courtyard beacons where the loop meets the district */}
      {[
        [-55, -55],
        [55, -55],
        [55, 55],
        [-55, 55],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.35, z]}>
          <cylinderGeometry args={[0.55, 0.75, 0.7, 16]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
