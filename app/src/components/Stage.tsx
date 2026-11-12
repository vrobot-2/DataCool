import { lazy, Suspense, type MutableRefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { SHOTS } from '../scene/shots';
import { Annotations } from '../scene/Annotations';
import { CameraRig } from '../scene/CameraRig';
import { CityAnimation } from '../scene/CityAnimation';
import { Hero } from '../scene/Hero';
import { GlbMains } from '../scene/District';
import { Flow } from '../scene/Flow';
import { GlassPipes } from '../scene/GlassPipes';
import { GlbEnvironment, Lights } from '../scene/Lights';
import { ProceduralScene } from '../scene/ProceduralScene';
import { FOG_DENSITY, HORIZON, Sky } from '../scene/Sky';
import { StudioEnvironment } from '../scene/StudioEnvironment';
import { useSceneModel } from '../scene/useSceneModel';
import { VisibilityCuller } from '../scene/useVisibilityCulling';

// Post-processing lives in its own chunk (postprocessing + effects are the heavy part).
const PostFX = lazy(() => import('../scene/PostFX'));

export function Stage({
  cameraT,
  accent,
  reducedMotion,
}: {
  cameraT: MutableRefObject<number>;
  accent: string;
  reducedMotion: boolean;
}) {
  const { model, failed } = useSceneModel();

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      camera={{
        fov: 34,
        near: 0.06,
        far: 700,
        position: SHOTS[0].position,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
      }}
    >
      <color attach="background" args={[HORIZON]} />
      {/* exponential haze: hides the ground edge, still leaves the 240 m district readable */}
      <fogExp2 attach="fog" args={[HORIZON, FOG_DENSITY]} />
      <Sky accent={accent} />
      <CameraRig cameraRef={cameraT} reducedMotion={reducedMotion} />
      <Annotations cameraT={cameraT} />
      <Hero cameraT={cameraT} reducedMotion={reducedMotion} />
      <StudioEnvironment cameraT={cameraT.current} />
      <Lights accent={accent} cameraT={cameraT.current} />
      {model ? (
        <>
          <GlbEnvironment />
          <primitive object={model} />
          <GlbMains accent={accent} />
          <VisibilityCuller cameraT={cameraT} model={model} />
        </>
      ) : failed ? (
        <ProceduralScene accent={accent} />
      ) : null}
      {(model || failed) && (
        <>
          <GlassPipes />
          <CityAnimation cameraT={cameraT} />
          <Flow cameraT={cameraT} accent={accent} reducedMotion={reducedMotion} />
        </>
      )}
      <Suspense fallback={null}>
        <PostFX cameraT={cameraT} reducedMotion={reducedMotion} />
      </Suspense>
    </Canvas>
  );
}