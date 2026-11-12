import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Fog / horizon colour. The dome fades to exactly this at the horizon so the ground melts into it. */
export const HORIZON = '#10131F';
export const FOG_DENSITY = 0.003;

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main(){
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uZenith, uMid, uHorizon, uGlow;
  varying vec3 vDir;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    float h = vDir.y;
    float up = smoothstep(0.0, 0.85, h);
    vec3 col = mix(uMid, uZenith, pow(up, 0.65));
    col = mix(uHorizon, col, smoothstep(0.0, 0.16, h));
    // warm dusk band hugging the horizon, tinted by the active phase accent
    float band = exp(-pow((h - 0.05) / 0.07, 2.0)) * smoothstep(-0.02, 0.03, h);
    col += uGlow * band * 0.55;
    col += (hash(gl_FragCoord.xy) - 0.5) / 255.0; // dither: no banding in the gradient
    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * Gradient sky dome + sparse star field, centred on the camera so the horizon never moves.
 * Replaces the flat background; fog (see FOG_DENSITY) hides the ground edge.
 */
export function Sky({ accent }: { accent: string }) {
  const group = useRef<THREE.Group>(null);
  const { material, stars } = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color('#080A18') },
        uMid: { value: new THREE.Color('#0E1228') },
        uHorizon: { value: new THREE.Color(HORIZON) },
        uGlow: { value: new THREE.Color('#5A3A4A') },
      },
    });
    const n = 1400;
    const pos = new Float32Array(n * 3);
    let s = 1337;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const y = 0.06 + rnd() * 0.94; // upper hemisphere only
      const phi = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(phi) * r * 560, y * 560, Math.sin(phi) * r * 560], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.PointsMaterial({
      color: '#BFD0FF',
      size: 1.3,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      fog: false,
    });
    return { material: mat, stars: new THREE.Points(geo, pm) };
  }, []);

  const glowTarget = useMemo(
    () => new THREE.Color('#5A3A4A').lerp(new THREE.Color(accent), 0.45),
    [accent],
  );

  useEffect(
    () => () => {
      material.dispose();
      stars.geometry.dispose();
      (stars.material as THREE.Material).dispose();
    },
    [material, stars],
  );

  useFrame(({ camera }, delta) => {
    group.current?.position.copy(camera.position);
    (material.uniforms.uGlow.value as THREE.Color).lerp(glowTarget, 1 - Math.exp(-delta * 2));
  });

  return (
    <group ref={group} renderOrder={-10}>
      <mesh frustumCulled={false} renderOrder={-10}>
        <sphereGeometry args={[600, 32, 16]} />
        <primitive object={material} attach="material" />
      </mesh>
      <primitive object={stars} renderOrder={-9} frustumCulled={false} />
    </group>
  );
}
