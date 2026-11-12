import { useMaterialMaps } from './textures';

const TRAY_COUNT = 8;

/**
 * Procedural rack. Local frame: front (door, cold plates) at -Z, rear manifold at +Z.
 * Placed at three (-3.2, 0, -2.0) = Blender (-3.2, +2.0, 0) via (x, y, z) -> (x, z, -y);
 * the Blender asset's 180 deg turn puts its front toward Blender +Y = three -Z, which is
 * exactly this local frame, so no extra rotation is needed.
 */
export function Rack({ accent }: { accent: string }) {
  const { metal } = useMaterialMaps();
  const trays = Array.from({ length: TRAY_COUNT }, (_, i) => 0.25 + i * 0.18);
  const slats = Array.from({ length: 6 }, (_, i) => 0.45 + i * 0.27);

  return (
    <group position={[-3.2, 0, -2.0]}>
      {/* frame uprights */}
      {[-0.26, 0.26].map((x) =>
        [-0.46, 0.46].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 1.1, z]} castShadow receiveShadow>
            <boxGeometry args={[0.04, 2.2, 0.04]} />
            <meshStandardMaterial color="#3A4250" metalness={0.75} roughness={0.42} {...metal} />
          </mesh>
        )),
      )}
      {/* top / bottom rails */}
      {[0.05, 2.15].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.56, 0.05, 0.96]} />
          <meshStandardMaterial color="#2C333F" metalness={0.7} roughness={0.5} {...metal} />
        </mesh>
      ))}
      {/* shelves */}
      {[0.62, 1.02, 1.42].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.52, 0.018, 0.92]} />
          <meshStandardMaterial color="#262D38" metalness={0.65} roughness={0.55} {...metal} />
        </mesh>
      ))}
      {/* server trays + cold plates */}
      {trays.map((y, i) => (
        <group key={y}>
          <mesh position={[0, y, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.48, 0.07, 0.9]} />
            <meshStandardMaterial
              color={i % 2 ? '#151A22' : '#1A212B'}
              metalness={0.55}
              roughness={0.48}
              {...metal}
            />
          </mesh>
          <mesh position={[0, y + 0.048, -0.3]} castShadow>
            <boxGeometry args={[0.14, 0.018, 0.14]} />
            <meshStandardMaterial
              color="#6F7889"
              metalness={0.9}
              roughness={0.22}
              emissive={accent}
              emissiveIntensity={0.9}
            />
          </mesh>
        </group>
      ))}
      {/* front door frame + slats */}
      {[-0.275, 0.275].map((x) => (
        <mesh key={x} position={[x, 1.1, -0.492]} castShadow>
          <boxGeometry args={[0.03, 2.1, 0.025]} />
          <meshStandardMaterial color="#454D5B" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {slats.map((y) => (
        <mesh key={y} position={[0, y, -0.49]} castShadow>
          <boxGeometry args={[0.52, 0.022, 0.012]} />
          <meshStandardMaterial color="#303845" metalness={0.65} roughness={0.5} {...metal} />
        </mesh>
      ))}
      {/* rear manifold pipes */}
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} position={[x, 1.05, 0.47]} castShadow>
          <cylinderGeometry args={[0.027, 0.027, 2.0, 16]} />
          <meshStandardMaterial color="#8A93A3" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
      {/* branches + hot accents */}
      {trays.map((y, i) => (
        <group key={`branch-${y}`}>
          <mesh position={[0.2, y + 0.04, 0.22]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.5, 8]} />
            <meshStandardMaterial color="#7C8697" metalness={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[0.2, y + 0.04, -0.02]}>
            <sphereGeometry args={[0.02, 10, 8]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={1.8}
              toneMapped={false}
            />
          </mesh>
          {i % 2 === 0 && (
            <mesh position={[-0.2, y + 0.04, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.5, 8]} />
              <meshStandardMaterial color="#7C8697" metalness={0.85} roughness={0.3} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
