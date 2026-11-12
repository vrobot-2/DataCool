import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { setDone, setProgress } from '../data/loadStore';
import { applyWindowsToGlb } from './windows';

const MATERIAL_TEXTURE_KEYS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
  'alphaMap',
  'bumpMap',
  'envMap',
  'lightMap',
] as const;

/** Blender names: `environment__Ground` (600 m) and `district__Ground` (240 m slab). */
const GROUND_NAME = /^(environment|district[_ ]*ground)/i;

/** Release GPU resources held by a loaded glTF scene graph. */
function disposeObject(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => materials.add(m));
    else if (mat) materials.add(mat);
  });
  materials.forEach((material) => {
    const record = material as unknown as Record<string, unknown>;
    for (const key of MATERIAL_TEXTURE_KEYS) {
      const texture = record[key];
      if (texture instanceof THREE.Texture) texture.dispose();
    }
    material.dispose();
  });
}

/**
 * Loads `/models/scene.glb` (baked by pipeline/export_glb.py: Blender Z-up -> three Y-up,
 * i.e. Blender (x, y, z) => three (x, z, -y), metres).
 * Materials authored in Blender are kept as-is; only shadow flags are set.
 * `failed` flips to true if the file is missing or cannot be parsed, so the caller can
 * render the procedural fallback.
 */
export function useSceneModel() {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const base = import.meta.env.BASE_URL;
    const loader = new GLTFLoader();

    const fail = () => {
      if (!alive) return;
      setFailed(true);
      setDone(); // procedural fallback is ready
    };

    // Stream the download so the preloader can show real progress (0..0.9; parse is the rest).
    const download = async (): Promise<ArrayBuffer> => {
      const res = await fetch(`${base}models/scene.glb`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`scene.glb ${res.status}`);
      const total = Number(res.headers.get('Content-Length')) || 0;
      if (!res.body || !total) return res.arrayBuffer();
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        setProgress((loaded / total) * 0.9);
      }
      const out = new Uint8Array(loaded);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
      }
      return out.buffer;
    };

    download()
      .then((buffer) => {
        loader.parse(
          buffer,
          `${base}models/`,
          (gltf) => {
            if (!alive) {
              disposeObject(gltf.scene);
              return;
            }
            gltf.scene.traverse((object) => {
              const mesh = object as THREE.Mesh;
              if (mesh.isMesh) {
                // Huge ground slabs only receive shadows (they would swamp the shadow frustum).
                mesh.castShadow = !GROUND_NAME.test(mesh.name);
                mesh.receiveShadow = true;
              }
            });
            applyWindowsToGlb(gltf.scene);
            setModel(gltf.scene);
            setDone();
          },
          fail,
        );
      })
      .catch(fail);

    return () => {
      alive = false;
    };
  }, []);

  // Dispose the model when it is replaced or the owner unmounts.
  useEffect(() => {
    if (!model) return;
    return () => disposeObject(model);
  }, [model]);

  return { model, failed };
}
