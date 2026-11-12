import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SHOTS, getCurrentShot } from './shots';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Ease function with hold zones: camera nearly still during hold fraction, 
 * smooth motion in the remaining range.
 */
function easeWithHold(t: number, hold?: [number, number]): number {
  if (!hold) {
    // Smoothstep ease
    return t * t * (3 - 2 * t);
  }
  
  const [holdStart, holdEnd] = hold;
  
  if (t < holdStart) {
    // Ease in to hold
    const localT = t / holdStart;
    return (localT * localT * (3 - 2 * localT)) * holdStart;
  } else if (t > holdEnd) {
    // Ease out from hold
    const localT = (t - holdEnd) / (1 - holdEnd);
    return holdEnd + (localT * localT * (3 - 2 * localT)) * (1 - holdEnd);
  } else {
    // In hold zone - very slow drift
    const holdT = (t - holdStart) / (holdEnd - holdStart);
    return holdStart + holdT * (holdEnd - holdStart);
  }
}

/**
 * Scroll-driven spline camera rig with hold zones.
 * Interpolates through SHOTS array using smooth splines for position and target.
 */
export function CameraRig({
  cameraRef,
  reducedMotion,
}: {
  cameraRef: MutableRefObject<number>;
  reducedMotion: boolean;
}) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(...SHOTS[0].target));
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
  
  // Build CatmullRom curves for smooth spline interpolation
  const positionCurve = useMemo(() => {
    const points = SHOTS.map(s => new THREE.Vector3(...s.position));
    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  }, []);
  
  const targetCurve = useMemo(() => {
    const points = SHOTS.map(s => new THREE.Vector3(...s.target));
    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  }, []);

  useFrame((_, delta) => {
    const t = clamp(cameraRef.current, 0, SHOTS.length - 1);
    const { shot, fraction } = getCurrentShot(t);
    
    // Apply hold zone easing
    const easedFraction = easeWithHold(fraction, shot.hold);
    
    // Sample curves with eased fraction
    const adjustedT = (Math.floor(t) + easedFraction) / (SHOTS.length - 1);
    
    // getPoint (not getPointAt): control point i is hit exactly at u = i/(n-1),
    // so each shot's hold zone frames the authored position/target precisely.
    positionCurve.getPoint(clamp(adjustedT, 0, 1), desiredPosition);
    targetCurve.getPoint(clamp(adjustedT, 0, 1), desiredTarget);
    
    // Apply FOV if specified
    const fov = shot.fov ?? 34;
    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - fov) > 0.1) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, fov, reducedMotion ? 1 : 0.1);
      camera.updateProjectionMatrix();
    }

    // Smooth camera motion with damping
    if (reducedMotion) {
      camera.position.copy(desiredPosition);
      target.current.copy(desiredTarget);
    } else {
      const k = 1 - Math.exp(-delta * 5.5);
      camera.position.lerp(desiredPosition, k);
      target.current.lerp(desiredTarget, k);
    }
    
    camera.lookAt(target.current);
  });

  return null;
}
