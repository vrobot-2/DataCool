import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';

/** Bloom strength per phase: thin district mains need more than the macro shots. */
const BLOOM_BY_PHASE = [0.8, 1.0, 0.9, 1.1, 1.5];

type Level = 0 | 1 | 2; // 0 = no post, 1 = bloom+SMAA, 2 = full

/**
 * Post-processing chain (lazy chunk). The composer renders to float targets, so the
 * ToneMapping effect is the only tone map; the renderer's own tone mapping is switched off
 * while it is active and restored on unmount / when degraded to level 0.
 */
export default function PostFX({
  cameraT,
  reducedMotion,
  quality = 'auto',
}: {
  cameraT: MutableRefObject<number>;
  reducedMotion: boolean;
  quality?: 'auto' | 'high' | 'low';
}) {
  const { gl, setDpr } = useThree();
  const [level, setLevel] = useState<Level>(quality === 'low' ? 1 : 2);
  const bloom = useRef<{ intensity: number } | null>(null);
  const offset = useMemo(() => new THREE.Vector2(0.0005, 0.0006), []);

  useEffect(() => {
    if (quality === 'low') setLevel(1);
    else if (quality === 'high') setLevel(2);
  }, [quality]);

  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, level === 2 ? 1.75 : 1);
    setDpr(dpr);
  }, [level, setDpr]);

  useEffect(() => {
    if (level === 0) return;
    const previous = gl.toneMapping;
    gl.toneMapping = THREE.NoToneMapping;
    return () => {
      gl.toneMapping = previous;
    };
  }, [gl, level]);

  useFrame((_, delta) => {
    if (!bloom.current) return;
    const t = Math.min(BLOOM_BY_PHASE.length - 1, Math.max(0, cameraT.current));
    const i = Math.min(BLOOM_BY_PHASE.length - 2, Math.floor(t));
    const target = BLOOM_BY_PHASE[i] + (BLOOM_BY_PHASE[i + 1] - BLOOM_BY_PHASE[i]) * (t - i);
    bloom.current.intensity += (target - bloom.current.intensity) * (1 - Math.exp(-delta * 4));
  });

  const monitor =
    quality === 'auto' ? (
      <PerformanceMonitor
        flipflops={2}
        onDecline={() => setLevel((l) => (Math.max(0, l - 1) as Level))}
        onFallback={() => setLevel(0)}
      />
    ) : null;

  if (level === 0) return monitor;

  const effects = [
    <Bloom
      key="bloom"
      ref={bloom as never}
      mipmapBlur
      luminanceThreshold={0.85}
      luminanceSmoothing={0.25}
      intensity={0.9}
      radius={0.7}
    />,
    <Vignette key="vig" offset={0.28} darkness={0.55} eskil={false} />,
  ];
  if (level === 2 && !reducedMotion) {
    effects.push(
      <ChromaticAberration
        key="ca"
        offset={offset}
        radialModulation={false}
        modulationOffset={0}
      />,
      <Noise key="noise" blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.12} />,
    );
  }
  if (level === 1) effects.push(<SMAA key="smaa" />);
  effects.push(<ToneMapping key="tm" mode={ToneMappingMode.ACES_FILMIC} />);

  return (
    <>
      {monitor}
      <EffectComposer multisampling={level === 2 ? 4 : 0} depthBuffer>
        {effects}
      </EffectComposer>
    </>
  );
}
