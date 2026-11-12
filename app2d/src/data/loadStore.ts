/**
 * Tiny shared load-progress store (no React, no deps).
 * Producers (scene/useSceneModel) call `setProgress` while the GLB downloads/parses and
 * `setDone` when the scene is ready (or has fallen back to the procedural one).
 * The preloader subscribes through `useLoadState`-style `subscribeLoad` / `getLoad`.
 */
export interface LoadState {
  /** 0..1 */
  progress: number;
  done: boolean;
}

let state: LoadState = { progress: 0, done: false };
const listeners = new Set<() => void>();

function emit(next: LoadState) {
  if (next.progress === state.progress && next.done === state.done) return;
  state = next;
  listeners.forEach((l) => l());
}

export const getLoad = (): LoadState => state;

export function subscribeLoad(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Progress never goes backwards and is clamped to 0..1. */
export function setProgress(p: number) {
  const next = Math.min(1, Math.max(state.progress, Number.isFinite(p) ? p : 0));
  emit({ progress: next, done: state.done });
}

/** Scene ready — or failed and fell back to the procedural scene. */
export function setDone() {
  emit({ progress: 1, done: true });
}
