import { useEffect, useMemo, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vec3 } from '../data/phases';
import {
  BRANCHES,
  LANE_COLD,
  LANE_HOT,
  MAINS,
  RETURN_FLOW,
  SUPPLY_FLOW,
} from './paths';

/*
 * GPU particle streams. One THREE.Points per path; the position along the polyline is
 * computed in the vertex shader from a time uniform, so there is no per-frame React or
 * buffer work. Intensity follows the scroll camera parameter.
 */

const MAX_PTS = 6;
const INDIGO = '#7C8BFF';
const CRIMSON = '#FF6B57';
const AMBER = '#FFB45C';

const VERT = /* glsl */ `
  #define MAXP ${MAX_PTS}
  uniform vec3 uP[MAXP];
  uniform float uC[MAXP];
  uniform int uN;
  uniform float uLen, uTime, uSpeed, uSize, uScale, uSpread, uIntensity;
  attribute float aSeed;
  varying float vT;
  varying float vAlpha;
  float h11(float n){ return fract(sin(n * 127.1) * 43758.5453); }
  vec3 pathAt(float d){
    for(int i = 0; i < MAXP - 1; i++){
      if(i >= uN - 1) break;
      if(d <= uC[i + 1]){
        float f = (d - uC[i]) / max(uC[i + 1] - uC[i], 1e-4);
        return mix(uP[i], uP[i + 1], f);
      }
    }
    return uP[uN - 1];
  }
  void main(){
    float t = fract(aSeed + uTime * uSpeed / uLen);
    vec3 p = pathAt(t * uLen);
    p += (vec3(h11(aSeed * 17.3), h11(aSeed * 31.7), h11(aSeed * 53.1)) - 0.5) * uSpread;
    vT = t;
    vAlpha = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.95, t) * uIntensity;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = max(1.0, uSize * uScale / max(-mv.z, 0.1) * (0.6 + 0.8 * h11(aSeed * 7.7)));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColA, uColB;
  uniform float uIntensity;
  varying float vT;
  varying float vAlpha;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    vec3 col = mix(uColA, uColB, smoothstep(0.0, 1.0, vT)) * (1.2 + uIntensity);
    gl_FragColor = vec4(col, a * vAlpha);
  }
`;

interface StreamProps {
  path: Vec3[];
  cameraT: MutableRefObject<number>;
  /** Phase index at which the stream is brightest. */
  focus: number;
  colorA: string;
  colorB: string;
  /** Particles per metre of path. */
  density?: number;
  /** Metres per second. */
  speed?: number;
  /** World size of a particle in metres. */
  size?: number;
  /** Lateral jitter box in metres. */
  spread?: number;
  /** Draw through geometry (for lanes hidden inside the plate pack). */
  xray?: boolean;
  /** Shot index range [min, max] in which this stream is visible (default: all). */
  shots?: [number, number];
  reducedMotion: boolean;
}

function Stream({
  path,
  cameraT,
  focus,
  colorA,
  colorB,
  density = 70,
  speed = 0.9,
  size = 0.028,
  spread = 0.05,
  xray = false,
  shots,
  reducedMotion,
}: StreamProps) {
  const { geometry, material } = useMemo(() => {
    const pts = path.slice(0, MAX_PTS).map((p) => new THREE.Vector3(...p));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const length = cum[cum.length - 1];
    const n = pts.length;
    while (pts.length < MAX_PTS) {
      pts.push(pts[n - 1].clone());
      cum.push(length);
    }
    const count = Math.min(900, Math.max(24, Math.round(length * density)));
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = (i + 0.5) / count;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: !xray,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uP: { value: pts },
        uC: { value: cum },
        uN: { value: n },
        uLen: { value: Math.max(length, 1e-3) },
        uTime: { value: 0 },
        uSpeed: { value: speed },
        uSize: { value: size },
        uScale: { value: 600 },
        uSpread: { value: spread },
        uIntensity: { value: 0.2 },
        uColA: { value: new THREE.Color(colorA) },
        uColB: { value: new THREE.Color(colorB) },
      },
    });
    return { geometry: geo, material: mat };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, density, speed, size, spread, xray, colorA, colorB]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ clock, size: view, camera, gl }, delta) => {
    const u = material.uniforms;
    u.uTime.value = reducedMotion ? 3 : clock.elapsedTime;
    const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
    u.uScale.value = (view.height * gl.getPixelRatio()) / (2 * Math.tan(fov / 2));
    const d = (cameraT.current - focus) / 0.95;
    let target = 0.14 + 0.86 * Math.exp(-d * d);
    if (shots) {
      const idx = Math.floor(cameraT.current);
      if (idx < shots[0] || idx > shots[1]) target = 0;
    }
    u.uIntensity.value += (target - u.uIntensity.value) * (1 - Math.exp(-delta * 4));
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
}

export function Flow({
  cameraT,
  accent,
  reducedMotion,
}: {
  cameraT: MutableRefObject<number>;
  accent: string;
  reducedMotion: boolean;
}) {
  const common = { cameraT, reducedMotion };
  const district = useMemo(() => new THREE.Color(AMBER).lerp(new THREE.Color(accent), 0.25).getStyle(), [accent]);
  return (
    <group>
      {/* 4.2 L/s through a DN100 loop is ~0.5 m/s; scaled up slightly so motion reads */}
      <Stream {...common} path={SUPPLY_FLOW} focus={2} colorA={CRIMSON} colorB={CRIMSON} speed={0.9} />
      <Stream {...common} path={RETURN_FLOW} focus={2} colorA={INDIGO} colorB={INDIGO} speed={0.9} />
      {BRANCHES.map((p, i) => (
        <Stream
          key={i}
          {...common}
          path={p}
          focus={1}
          colorA={INDIGO}
          colorB={CRIMSON}
          density={90}
          speed={0.5}
          size={0.022}
          spread={0.02}
        />
      ))}
      <Stream {...common} path={LANE_HOT} focus={3} colorA={CRIMSON} colorB={INDIGO} xray spread={0.09} density={140} size={0.03} />
      <Stream {...common} path={LANE_COLD} focus={3} colorA={INDIGO} colorB={AMBER} xray spread={0.09} density={140} size={0.03} />
      {MAINS.map((p, i) => (
        <Stream
          key={`m${i}`}
          {...common}
          path={p}
          focus={6}
          shots={[5, 8]}
          colorA={AMBER}
          colorB={district}
          density={3}
          speed={9}
          size={0.7}
          spread={0.5}
        />
      ))}
    </group>
  );
}
