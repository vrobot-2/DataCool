import * as THREE from 'three';

/**
 * World-space lit-window overlay for MeshStandardMaterial: adds emissive window grids on
 * near-vertical faces above ground, with no UVs or textures required. Works on the baked
 * GLB district (any material named like "concrete") and on the procedural buildings.
 */
export function patchWindows(
  shader: { vertexShader: string; fragmentShader: string },
  intensity = 1.1,
) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWinP;\nvarying vec3 vWinN;')
    .replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvWinP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWinN = normalize(mat3(modelMatrix) * objectNormal);',
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
varying vec3 vWinP;
varying vec3 vWinN;
float dcHash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }`,
    )
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
{
  float side = 1.0 - smoothstep(0.2, 0.45, abs(vWinN.y));
  float along = abs(vWinN.x) > abs(vWinN.z) ? vWinP.z : vWinP.x;
  vec2 cell = vec2(along / 3.4, vWinP.y / 3.6);
  vec2 id = floor(cell);
  vec2 f = fract(cell);
  float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.78);
  float bld = dcHash(floor(vWinP.xz / 9.0));
  float lit = step(0.58 - 0.2 * bld, dcHash(id + bld * 31.0));
  win *= lit * side * smoothstep(2.5, 4.0, vWinP.y);
  vec3 warm = mix(vec3(1.0, 0.68, 0.34), vec3(0.72, 0.86, 1.0), dcHash(id * 1.7 + bld));
  totalEmissiveRadiance += warm * win * ${intensity.toFixed(2)} * (0.6 + 0.8 * dcHash(id + 7.0));
}`,
    );
}

/** Spread onto a procedural <meshStandardMaterial>. */
export const windowMaterialProps = {
  onBeforeCompile: (shader: THREE.WebGLProgramParametersWithUniforms) => patchWindows(shader),
  customProgramCacheKey: () => 'dc-windows',
};

/** Apply to the GLB district materials (names containing "concrete"). */
export function applyWindowsToGlb(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !/district/i.test(mesh.name)) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!/concrete/i.test(mat.name) || !(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
      mat.onBeforeCompile = (shader) => patchWindows(shader);
      mat.customProgramCacheKey = windowMaterialProps.customProgramCacheKey;
      mat.needsUpdate = true;
    }
  });
}
