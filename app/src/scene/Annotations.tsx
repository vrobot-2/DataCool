import { useMemo, useRef, type CSSProperties, type ElementRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PHASES, type Vec3 } from '../data/phases';

/**
 * In-scene copy: one DOM panel per phase, pinned to a world-space point (three coords,
 * Y-up) with a leader line to the object it talks about. Panels fade in and out with the
 * scroll-driven camera parameter (cameraT is 0..5; 5 is the closing section, which reuses
 * the phase-4 camera).
 *
 * `panel` was unprojected from the desired screen position at that phase's camera key
 * (16:10, NDC in the comment), so on desktop each panel lands in empty space beside its
 * subject; on narrow screens the panel is clamped into view instead.
 */
interface Anchor {
  phase: number;
  /** World point the panel's top-left corner hangs from. */
  panel: Vec3;
  /** World point the leader line ends on. */
  target: Vec3;
  /** Typical camera distance to `panel` while its phase is active (for scale). */
  ref: number;
}

const ANCHORS: Anchor[] = [
  // exchanger top, NDC (-0.80, 0.62)
  { phase: 0, panel: [-1.1, 1.98, 1.84], target: [-0.2, 1.55, 0.1], ref: 5.4 },
  // cold plates behind the rack door, NDC (0.28, 0.55)
  { phase: 1, panel: [-3.37, 1.42, -2.28], target: [-3.2, 1.02, -2.32], ref: 1.25 },
  // rear manifold, NDC (0.22, 0.62)
  { phase: 2, panel: [-2.81, 1.84, -1.28], target: [-3.0, 1.2, -1.52], ref: 3.6 },
  // exchanger port flange, NDC (-0.82, 0.66)
  { phase: 3, panel: [-1.28, 1.39, 0.38], target: [0.2, 1.05, 0.664], ref: 3.2 },
  // central plant, NDC (-0.82, 0.66)
  { phase: 4, panel: [-88.55, 37.35, 17], target: [-30, 15, -30], ref: 185 },
  { phase: 5, panel: [-88.55, 37.35, 17], target: [-30, 15, -30], ref: 185 },
];

const MAST_H = 55;
const STRIP_H = 76;
const MARGIN = 14;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** 1 when the camera is on this phase, 0 beyond ~0.45 of a section away. */
function weight(t: number, phase: number) {
  const x = clamp(1 - (Math.abs(t - phase) - 0.12) / 0.33, 0, 1);
  return x * x * (3 - 2 * x);
}

function Note({ anchor, cameraT }: { anchor: Anchor; cameraT: MutableRefObject<number> }) {
  const phase = PHASES[anchor.phase];
  const root = useRef<HTMLDivElement>(null);
  const line = useRef<ElementRef<typeof Line>>(null);
  const dot = useRef<THREE.Mesh>(null);
  const scale = useRef(1);
  const panelPos = useMemo(() => new THREE.Vector3(...anchor.panel), [anchor]);
  const linePoints = useMemo(
    () => [new THREE.Vector3(...anchor.panel), new THREE.Vector3(...anchor.target)],
    [anchor],
  );
  const projected = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, size }) => {
    const w = weight(cameraT.current, anchor.phase);
    const on = w > 0.01;
    const el = root.current;
    if (el) {
      const narrow = size.width < 700;
      const vs = narrow ? 0.92 : clamp(size.width / 1500, 0.72, 1);
      scale.current = clamp(anchor.ref / camera.position.distanceTo(panelPos), 0.8, 1.2) * vs;
      el.style.opacity = w.toFixed(3);
      el.style.visibility = on ? 'visible' : 'hidden';
      el.style.setProperty('--s', scale.current.toFixed(3));
    }
    if (line.current) {
      line.current.visible = on;
      (line.current.material as THREE.Material).opacity = w * 0.85;
    }
    if (dot.current) {
      dot.current.visible = on;
      const d = camera.position.distanceTo(dot.current.position);
      dot.current.scale.setScalar(Math.max(0.0001, d * 0.007 * (0.4 + 0.6 * w)));
    }
  });

  const place = (obj: THREE.Object3D, camera: THREE.Camera, size: { width: number; height: number }) => {
    projected.setFromMatrixPosition(obj.matrixWorld).project(camera);
    const el = root.current;
    const pw = (el?.offsetWidth ?? 0) * scale.current;
    const ph = (el?.offsetHeight ?? 0) * scale.current;
    const narrow = size.width < 700;
    const x = clamp((projected.x * 0.5 + 0.5) * size.width, MARGIN, Math.max(MARGIN, size.width - pw - MARGIN));
    const y = narrow
      ? Math.max(size.height * 0.67, size.height - STRIP_H - ph - MARGIN)
      : clamp(
          (-projected.y * 0.5 + 0.5) * size.height,
          MAST_H + MARGIN,
          Math.max(MAST_H + MARGIN, size.height - STRIP_H - ph - MARGIN),
        );
    return [x, y] as [number, number];
  };

  const big = anchor.phase === 0 || anchor.phase === 5;
  const Heading = big ? 'h1' : 'h2';

  return (
    <>
      <Html
        position={anchor.panel}
        zIndexRange={[30, 0]}
        calculatePosition={place}
        style={{ pointerEvents: 'none' }}
      >
        <div
          ref={root}
          className={`note${big ? ' note--big' : ''}`}
          style={{ '--a': phase.accent, visibility: 'hidden', opacity: 0 } as CSSProperties}
        >
          <p className="note-eyebrow">
            <i>{phase.eyebrowNo}</i> {phase.eyebrow}
          </p>
          <Heading className="note-title">
            {phase.title.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </Heading>
          <p className="note-lede">{phase.lede}</p>
          <ul className="note-specs">
            {phase.specs.map((s) => (
              <li key={s.key}>
                <b>{s.key}</b>
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </Html>
      <Line
        ref={line}
        points={linePoints}
        color={phase.accent}
        lineWidth={1.25}
        transparent
        opacity={0}
        depthTest={false}
      />
      <mesh ref={dot} position={anchor.target} renderOrder={10}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color={phase.accent} toneMapped={false} depthTest={false} />
      </mesh>
    </>
  );
}

export function Annotations({ cameraT }: { cameraT: MutableRefObject<number> }) {
  return (
    <>
      {ANCHORS.map((a) => (
        <Note key={a.phase} anchor={a} cameraT={cameraT} />
      ))}
    </>
  );
}
