"use client";

import { useSyncExternalStore } from "react";

export interface SceneStats {
  fps: number;
  frameMs: number;
  worstMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  dpr: number;
  quality: "high" | "low";
  qualityReason: "preference" | "url" | "auto";
  frameloop: "always" | "demand";
  cameraDistance: number;
  heapMB: number | null;
  width: number;
  height: number;
}

// Lives outside React so the scene can publish a few times a second without
// re-rendering anything except the overlay that subscribes.
let stats: SceneStats | null = null;
const listeners = new Set<() => void>();

export const statsStore = {
  get: () => stats,
  set(next: SceneStats) {
    stats = next;
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const useSceneStats = () => useSyncExternalStore(statsStore.subscribe, statsStore.get, () => null);
